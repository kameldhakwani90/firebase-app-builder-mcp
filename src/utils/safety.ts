import { logger } from './logger.js';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

export interface SafetyConfig {
  maxRetries: number;
  timeoutMs: number;
  maxExecutionTime: number; // Temps maximum total pour un projet
  heartbeatIntervalMs: number;
  crashDetectionEnabled: boolean;
}

export interface ExecutionState {
  projectName: string;
  currentStep: string;
  startTime: number;
  lastHeartbeat: number;
  retryCount: number;
  isRunning: boolean;
  pid: number;
}

export class SafetyManager {
  private config: SafetyConfig;
  private executionState?: ExecutionState;
  private heartbeatTimer?: NodeJS.Timeout;
  private timeoutTimer?: NodeJS.Timeout;
  private stateFilePath: string;

  constructor(config: Partial<SafetyConfig> = {}) {
    this.config = {
      maxRetries: 3,
      timeoutMs: 60 * 60 * 1000, // 60 minutes par étape (Windows fix)
      maxExecutionTime: 4 * 60 * 60 * 1000, // 4 heures max par projet (Windows fix)
      heartbeatIntervalMs: 30 * 1000, // 30 secondes
      crashDetectionEnabled: true,
      ...config
    };

    this.stateFilePath = path.join(
      os.homedir(),
      'firebase-migrations',
      'agent-state.json'
    );

    // Détecter les crashes au démarrage
    this.detectPreviousCrash();
  }

  async startExecution(projectName: string, step: string): Promise<void> {
    // Vérifier si une exécution est déjà en cours
    if (this.executionState?.isRunning) {
      throw new Error(`Une exécution est déjà en cours pour le projet: ${this.executionState.projectName}`);
    }

    this.executionState = {
      projectName,
      currentStep: step,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      retryCount: 0,
      isRunning: true,
      pid: process.pid
    };

    await this.saveState();
    this.startHeartbeat();
    this.startTimeoutTimer();

    logger.info(`Démarrage sécurisé de l'exécution: ${projectName} - ${step}`, {
      maxRetries: this.config.maxRetries,
      timeoutMs: this.config.timeoutMs
    });
  }

  async updateStep(step: string): Promise<void> {
    if (!this.executionState) {
      throw new Error('Aucune exécution en cours');
    }

    this.executionState.currentStep = step;
    this.executionState.lastHeartbeat = Date.now();
    this.executionState.retryCount = 0; // Reset retry count pour nouvelle étape
    
    await this.saveState();
    
    // Restart timeout timer pour la nouvelle étape
    this.startTimeoutTimer();
    
    logger.info(`Passage à l'étape: ${step}`);
  }

  async handleError(error: Error, canRetry: boolean = true): Promise<boolean> {
    if (!this.executionState) {
      logger.error('Erreur sans contexte d\'exécution', error);
      return false;
    }

    this.executionState.retryCount++;
    await this.saveState();

    logger.error(
      `Erreur dans ${this.executionState.currentStep} (tentative ${this.executionState.retryCount}/${this.config.maxRetries})`,
      error,
      { 
        projectName: this.executionState.projectName,
        step: this.executionState.currentStep
      }
    );

    // Vérifier si on peut encore réessayer
    if (canRetry && this.executionState.retryCount < this.config.maxRetries) {
      const waitTime = Math.min(5000 * this.executionState.retryCount, 30000); // Back-off exponentiel
      logger.warn(`Nouvelle tentative dans ${waitTime}ms...`);
      await this.sleep(waitTime);
      return true; // Peut réessayer
    }

    // Arrêt définitif
    logger.error(`Arrêt après ${this.executionState.retryCount} tentatives`);
    await this.stopExecution(false);
    return false;
  }

  async stopExecution(success: boolean = true): Promise<void> {
    if (!this.executionState) return;

    const duration = Date.now() - this.executionState.startTime;
    
    if (success) {
      logger.success(`Exécution terminée avec succès: ${this.executionState.projectName}`, {
        duration,
        totalRetries: this.executionState.retryCount
      });
    } else {
      logger.error(`Exécution échouée: ${this.executionState.projectName}`, undefined, {
        duration,
        totalRetries: this.executionState.retryCount,
        lastStep: this.executionState.currentStep
      });
    }

    // Nettoyer les timers
    this.stopHeartbeat();
    this.stopTimeoutTimer();

    // Marquer comme terminé
    this.executionState.isRunning = false;
    await this.saveState();

    // Nettoyer l'état après un délai
    setTimeout(() => {
      this.cleanState();
    }, 5000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat(); // Nettoyer le précédent

    this.heartbeatTimer = setInterval(async () => {
      if (this.executionState) {
        this.executionState.lastHeartbeat = Date.now();
        await this.saveState();
        logger.debug('Heartbeat envoyé');
      }
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private startTimeoutTimer(): void {
    this.stopTimeoutTimer(); // Nettoyer le précédent

    this.timeoutTimer = setTimeout(async () => {
      if (this.executionState?.isRunning) {
        logger.error(`Timeout atteint pour l'étape: ${this.executionState.currentStep}`);
        await this.handleError(new Error('Timeout'), false);
      }
    }, this.config.timeoutMs);
  }

  private stopTimeoutTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }
  }

  private async saveState(): Promise<void> {
    if (!this.executionState) return;

    try {
      await fs.ensureDir(path.dirname(this.stateFilePath));
      await fs.writeJSON(this.stateFilePath, this.executionState, { spaces: 2 });
      console.log(`💾 État sauvegardé: ${this.stateFilePath}`);
    } catch (error: any) {
      logger.warn('Impossible de sauvegarder l\'état', error);
      console.log(`❌ Erreur sauvegarde: ${error?.message || error}`);
    }
  }

  private async cleanState(): Promise<void> {
    try {
      if (await fs.pathExists(this.stateFilePath)) {
        await fs.remove(this.stateFilePath);
        console.log(`🗑️ État nettoyé: ${this.stateFilePath}`);
      }
      this.executionState = undefined;
    } catch (error) {
      logger.debug('Erreur lors du nettoyage de l\'état', error);
      console.log(`⚠️ Erreur nettoyage état (ignorée)`);
    }
  }

  private async detectPreviousCrash(): Promise<void> {
    if (!this.config.crashDetectionEnabled) return;

    try {
      if (!(await fs.pathExists(this.stateFilePath))) return;

      const previousState: ExecutionState = await fs.readJSON(this.stateFilePath);
      
      // Vérifier si le processus précédent est encore en cours
      const isProcessRunning = this.isProcessRunning(previousState.pid);
      
      if (previousState.isRunning && !isProcessRunning) {
        logger.warn('Crash détecté dans l\'exécution précédente', {
          projectName: previousState.projectName,
          lastStep: previousState.currentStep,
          lastHeartbeat: new Date(previousState.lastHeartbeat).toISOString(),
          pid: previousState.pid
        });

        // Optionnel: proposer de reprendre automatiquement
        await this.handleCrashRecovery(previousState);
      }

    } catch (error) {
      logger.debug('Erreur lors de la détection de crash', error);
    }
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async handleCrashRecovery(crashedState: ExecutionState): Promise<void> {
    // Pour l'instant, juste logger. On pourrait ajouter une logique de récupération automatique
    logger.info(`Options de récupération disponibles pour le projet: ${crashedState.projectName}`);
    logger.info(`Utilisez: firebase-app-builder continue ${crashedState.projectName}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Méthodes publiques pour vérifier l'état
  isExecutionRunning(): boolean {
    return this.executionState?.isRunning ?? false;
  }

  getCurrentExecution(): ExecutionState | undefined {
    return this.executionState;
  }

  getExecutionDuration(): number {
    if (!this.executionState) return 0;
    return Date.now() - this.executionState.startTime;
  }

  hasExceededMaxTime(): boolean {
    return this.getExecutionDuration() > this.config.maxExecutionTime;
  }

  // Wrapper pour exécution sécurisée
  async safeExecute<T>(
    operation: () => Promise<T>,
    operationName: string,
    canRetry: boolean = true
  ): Promise<T | null> {
    try {
      logger.debug(`Début opération sécurisée: ${operationName}`);
      const result = await operation();
      logger.debug(`Opération réussie: ${operationName}`);
      return result;
    } catch (error) {
      const shouldRetry = await this.handleError(error as Error, canRetry);
      
      if (shouldRetry) {
        logger.info(`Nouvelle tentative de l'opération: ${operationName}`);
        return this.safeExecute(operation, operationName, false); // Pas de retry sur retry
      }
      
      return null;
    }
  }

  // Force cleanup pour les cas d'urgence
  async forceCleanup(): Promise<void> {
    logger.warn('Nettoyage forcé de l\'état de sécurité');
    
    this.stopHeartbeat();
    this.stopTimeoutTimer();
    
    if (this.executionState) {
      this.executionState.isRunning = false;
      await this.saveState();
    }
    
    await this.cleanState();
    this.executionState = undefined;
    
    logger.info('Nettoyage forcé terminé');
  }
}

// Instance globale du gestionnaire de sécurité
export const safetyManager = new SafetyManager();