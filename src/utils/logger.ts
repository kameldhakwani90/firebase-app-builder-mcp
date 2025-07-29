import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  projectName?: string;
  step?: string;
  data?: any;
  error?: any;
}

export interface ProgressUpdate {
  projectName: string;
  currentStep: string;
  progress: number; // 0-100
  message: string;
  timeElapsed: number;
  estimatedTimeRemaining?: number;
  stepDetails?: {
    currentStep: number;
    totalSteps: number;
    stepName: string;
    stepProgress: number;
  };
  stats?: {
    modelsDetected: number;
    apisGenerated: number;
    testsCreated: number;
    tokensUsed: number;
  };
}

export class AgentLogger {
  private logDir: string;
  private currentLogFile: string;
  private progressCallbacks: ((update: ProgressUpdate) => void)[] = [];
  private currentProject?: string;
  private stepStartTime?: number;
  private projectStartTime?: number;
  private totalSteps = 8; // Plus de détails
  private currentStepIndex = 0;
  private currentStats = {
    modelsDetected: 0,
    apisGenerated: 0,
    testsCreated: 0,
    tokensUsed: 0
  };
  
  private stepNames = [
    '🔍 Téléchargement & Détection',
    '🧠 Analyse Profonde avec Claude', 
    '🗄️ Génération Base de Données',
    '🔐 Authentification & Sécurité',
    '🛠️ Génération des APIs',
    '🧪 Génération & Exécution Tests',
    '⚡ Vérification & Démarrage Ports',
    '🎉 Finalisation & Rapport'
  ];

  constructor() {
    this.logDir = path.join(os.homedir(), 'firebase-migrations', 'logs');
    this.currentLogFile = path.join(this.logDir, `agent-${new Date().toISOString().slice(0, 10)}.log`);
    this.ensureLogDir();
  }

  private async ensureLogDir(): Promise<void> {
    try {
      await fs.ensureDir(this.logDir);
    } catch (error) {
      console.error('Impossible de créer le répertoire de logs:', error);
    }
  }

  async log(level: LogEntry['level'], message: string, data?: any, error?: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      projectName: this.currentProject,
      step: this.getCurrentStepName(),
      data,
      error: error ? this.serializeError(error) : undefined
    };

    // Affichage console avec couleurs
    this.displayConsoleLog(entry);

    // Écriture dans le fichier de log
    await this.writeToFile(entry);

    // Nettoyage automatique des anciens logs
    if (level === 'INFO' && message.includes('nouveau projet')) {
      this.cleanOldLogs();
    }
  }

  private displayConsoleLog(entry: LogEntry): void {
    const timestamp = chalk.gray(entry.timestamp.slice(11, 19));
    const project = entry.projectName ? chalk.cyan(`[${entry.projectName}]`) : '';
    const step = entry.step ? chalk.blue(`{${entry.step}}`) : '';
    
    let levelColor: (text: string) => string;
    let prefix: string;
    
    switch (entry.level) {
      case 'DEBUG':
        levelColor = chalk.gray;
        prefix = '🔍';
        break;
      case 'INFO':
        levelColor = chalk.blue;
        prefix = 'ℹ️';
        break;
      case 'WARN':
        levelColor = chalk.yellow;
        prefix = '⚠️';
        break;
      case 'ERROR':
        levelColor = chalk.red;
        prefix = '❌';
        break;
      case 'SUCCESS':
        levelColor = chalk.green;
        prefix = '✅';
        break;
    }

    const formattedMessage = `${timestamp} ${prefix} ${levelColor(entry.level)} ${project} ${step} ${entry.message}`;
    console.log(formattedMessage);

    // Afficher les données supplémentaires si présentes
    if (entry.data && entry.level !== 'DEBUG') {
      console.log(chalk.gray('   └─ Data:'), JSON.stringify(entry.data, null, 2));
    }

    if (entry.error) {
      console.log(chalk.red('   └─ Error:'), entry.error);
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.currentLogFile, logLine);
    } catch (error) {
      console.error('Erreur écriture log:', error);
    }
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }

  private getCurrentStepName(): string {
    const steps = ['Analyse', 'Migration', 'Tests', 'Finalisation'];
    return steps[this.currentStepIndex] || 'Inconnu';
  }

  // Méthodes de gestion du projet et des étapes
  setCurrentProject(projectName: string): void {
    this.currentProject = projectName;
    this.log('INFO', `Démarrage du projet: ${projectName}`);
  }

  startStep(stepIndex: number): void {
    this.currentStepIndex = stepIndex;
    this.stepStartTime = Date.now();
    this.log('INFO', `Début de l'étape: ${this.getCurrentStepName()}`);
  }

  updateProgress(message: string, progress?: number): void {
    if (!this.currentProject) return;

    const timeElapsed = this.stepStartTime ? Date.now() - this.stepStartTime : 0;
    const calculatedProgress = progress ?? (this.currentStepIndex / this.totalSteps) * 100;

    const update: ProgressUpdate = {
      projectName: this.currentProject,
      currentStep: this.getCurrentStepName(),
      progress: Math.min(calculatedProgress, 100),
      message,
      timeElapsed,
      estimatedTimeRemaining: this.estimateTimeRemaining(calculatedProgress, timeElapsed)
    };

    // Notifier tous les callbacks de progression
    this.progressCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        this.log('ERROR', 'Erreur dans callback de progression', undefined, error);
      }
    });

    this.log('DEBUG', `Progression: ${message}`, { progress: calculatedProgress });
  }

  private estimateTimeRemaining(progress: number, timeElapsed: number): number | undefined {
    if (progress <= 0) return undefined;
    
    const totalEstimatedTime = (timeElapsed / progress) * 100;
    return Math.max(0, totalEstimatedTime - timeElapsed);
  }

  completeStep(): void {
    const stepDuration = this.stepStartTime ? Date.now() - this.stepStartTime : 0;
    this.log('SUCCESS', `Étape terminée: ${this.getCurrentStepName()}`, { duration: stepDuration });
    this.currentStepIndex++;
  }

  // Méthodes publiques pour les logs
  debug(message: string, data?: any): Promise<void> {
    return this.log('DEBUG', message, data);
  }

  info(message: string, data?: any): Promise<void> {
    return this.log('INFO', message, data);
  }

  warn(message: string, data?: any): Promise<void> {
    return this.log('WARN', message, data);
  }

  error(message: string, error?: any, data?: any): Promise<void> {
    return this.log('ERROR', message, data, error);
  }

  success(message: string, data?: any): Promise<void> {
    return this.log('SUCCESS', message, data);
  }

  // Gestion des callbacks de progression
  onProgress(callback: (update: ProgressUpdate) => void): void {
    this.progressCallbacks.push(callback);
  }

  removeProgressCallback(callback: (update: ProgressUpdate) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  // Nettoyage des anciens logs
  private async cleanOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Garder 7 jours

      for (const file of files) {
        if (file.startsWith('agent-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.remove(filePath);
            this.log('DEBUG', `Ancien log supprimé: ${file}`);
          }
        }
      }
    } catch (error) {
      this.log('WARN', 'Erreur lors du nettoyage des logs', undefined, error);
    }
  }

  // Récupération des logs récents
  async getRecentLogs(hours: number = 24): Promise<LogEntry[]> {
    try {
      const content = await fs.readFile(this.currentLogFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const logs: LogEntry[] = [];
      for (const line of lines) {
        try {
          const entry: LogEntry = JSON.parse(line);
          if (new Date(entry.timestamp) > cutoffTime) {
            logs.push(entry);
          }
        } catch (error) {
          // Ignorer les lignes malformées
        }
      }

      return logs.reverse(); // Plus récents en premier
    } catch (error) {
      this.log('WARN', 'Impossible de lire les logs récents', undefined, error);
      return [];
    }
  }

  // Statistiques des logs
  async getLogStats(): Promise<{
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    successCount: number;
    lastError?: LogEntry;
  }> {
    const logs = await this.getRecentLogs();
    
    const stats = {
      totalLogs: logs.length,
      errorCount: logs.filter(l => l.level === 'ERROR').length,
      warnCount: logs.filter(l => l.level === 'WARN').length,
      successCount: logs.filter(l => l.level === 'SUCCESS').length,
      lastError: logs.find(l => l.level === 'ERROR')
    };

    return stats;
  }

  // Méthode pour obtenir le chemin du fichier de log
  getLogFilePath(): string {
    return this.currentLogFile;
  }

  // =================== NOUVELLES MÉTHODES TEMPS RÉEL ===================

  /**
   * Démarre une nouvelle étape avec suivi temps réel
   */
  startStep(stepIndex: number): void {
    this.currentStepIndex = stepIndex;
    this.stepStartTime = Date.now();
    
    const stepName = this.stepNames[stepIndex] || `Étape ${stepIndex + 1}`;
    console.log(chalk.bold.blue(`\n${stepName}`));
    console.log(chalk.gray('━'.repeat(60)));
    
    this.updateProgress(`Démarrage: ${stepName}`);
    this.info(`Étape ${stepIndex + 1}/${this.totalSteps} démarrée: ${stepName}`);
  }

  /**
   * Met à jour le progress de l'étape courante
   */
  updateProgress(message: string, stepProgress: number = 50): void {
    if (!this.currentProject || !this.stepStartTime || !this.projectStartTime) return;

    const timeElapsed = Date.now() - this.stepStartTime;
    const totalTimeElapsed = Date.now() - this.projectStartTime;
    const globalProgress = Math.round(((this.currentStepIndex + stepProgress / 100) / this.totalSteps) * 100);
    
    // Estimation du temps restant basée sur le progrès
    const estimatedTotalTime = totalTimeElapsed / (globalProgress / 100);
    const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - totalTimeElapsed);

    const update: ProgressUpdate = {
      projectName: this.currentProject,
      currentStep: this.stepNames[this.currentStepIndex] || `Étape ${this.currentStepIndex + 1}`,
      progress: globalProgress,
      message,
      timeElapsed: totalTimeElapsed,
      estimatedTimeRemaining,
      stepDetails: {
        currentStep: this.currentStepIndex + 1,
        totalSteps: this.totalSteps,
        stepName: this.stepNames[this.currentStepIndex] || `Étape ${this.currentStepIndex + 1}`,
        stepProgress
      },
      stats: { ...this.currentStats }
    };

    // Notifier tous les observateurs
    this.progressCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.warn('Erreur callback progress:', error);
      }
    });

    // Log console avec style
    const progressBar = this.createProgressBar(stepProgress, 20);
    console.log(chalk.cyan(`   ${message}`));
    console.log(chalk.gray(`   ${progressBar} ${stepProgress}%`));
  }

  /**
   * Termine l'étape courante
   */
  completeStep(): void {
    if (!this.stepStartTime) return;

    const duration = Date.now() - this.stepStartTime;
    const stepName = this.stepNames[this.currentStepIndex] || `Étape ${this.currentStepIndex + 1}`;
    
    console.log(chalk.green(`✅ ${stepName} terminée (${this.formatDuration(duration)})`));
    this.success(`${stepName} terminée`, { duration });
    
    this.updateProgress(`${stepName} terminée`, 100);
  }

  /**
   * Met à jour les statistiques
   */
  updateStats(stats: Partial<typeof this.currentStats>): void {
    Object.assign(this.currentStats, stats);
    
    if (stats.modelsDetected) {
      console.log(chalk.blue(`   📊 ${stats.modelsDetected} modèles détectés`));
    }
    if (stats.apisGenerated) {
      console.log(chalk.blue(`   🛠️ ${stats.apisGenerated} APIs générées`));  
    }
    if (stats.testsCreated) {
      console.log(chalk.blue(`   🧪 ${stats.testsCreated} tests créés`));
    }
    if (stats.tokensUsed) {
      console.log(chalk.blue(`   🤖 ${stats.tokensUsed} tokens Claude utilisés`));
    }
  }

  /**
   * Affiche un message d'erreur avec contexte
   */
  errorWithContext(message: string, error: any, context?: string): void {
    console.log();
    console.log(chalk.red('🚨 ERREUR DÉTECTÉE'));
    console.log(chalk.red('━'.repeat(50)));
    console.log(chalk.white(`Message: ${message}`));
    
    if (context) {
      console.log(chalk.white(`Contexte: ${context}`));
    }
    
    if (error) {
      console.log(chalk.white(`Détails: ${error.message || error}`));
      if (error.stack) {
        console.log(chalk.gray(`Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`));
      }
    }
    
    console.log(chalk.red('━'.repeat(50)));
    console.log();
    
    this.error(message, { context, error: this.serializeError(error) });
  }

  /**
   * Affiche un message de succès avec célébration
   */
  successWithCelebration(message: string, data?: any): void {
    console.log();
    console.log(chalk.green('🎉 SUCCÈS!'));
    console.log(chalk.green('━'.repeat(50)));
    console.log(chalk.white(message));
    
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        console.log(chalk.gray(`${key}: ${value}`));
      });
    }
    
    console.log(chalk.green('━'.repeat(50)));
    console.log();
    
    this.success(message, data);
  }

  /**
   * Affiche une information importante avec style
   */
  infoHighlight(message: string, data?: any): void {
    console.log();
    console.log(chalk.cyan('ℹ️ INFORMATION IMPORTANTE'));
    console.log(chalk.cyan('━'.repeat(50)));
    console.log(chalk.white(message));
    
    if (data) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
    
    console.log(chalk.cyan('━'.repeat(50)));
    console.log();
    
    this.info(message, data);
  }

  /**
   * Affiche l'état actuel du projet
   */
  showProjectStatus(): void {
    if (!this.currentProject || !this.projectStartTime) return;

    const totalTime = Date.now() - this.projectStartTime;
    const currentStepName = this.stepNames[this.currentStepIndex] || `Étape ${this.currentStepIndex + 1}`;
    const globalProgress = Math.round((this.currentStepIndex / this.totalSteps) * 100);

    console.log();
    console.log(chalk.bold.cyan('📊 ÉTAT DU PROJET'));
    console.log(chalk.cyan('━'.repeat(60)));
    console.log(chalk.white(`Projet: ${this.currentProject}`));
    console.log(chalk.white(`Temps écoulé: ${this.formatDuration(totalTime)}`));
    console.log(chalk.white(`Progression: ${globalProgress}%`));
    console.log(chalk.white(`Étape actuelle: ${currentStepName}`));
    console.log(chalk.white(`Modèles détectés: ${this.currentStats.modelsDetected}`));
    console.log(chalk.white(`APIs générées: ${this.currentStats.apisGenerated}`));
    console.log(chalk.white(`Tests créés: ${this.currentStats.testsCreated}`));
    console.log(chalk.white(`Tokens utilisés: ${this.currentStats.tokensUsed}`));
    console.log(chalk.cyan('━'.repeat(60)));
    console.log();
  }

  /**
   * Crée une barre de progression stylée
   */
  private createProgressBar(progress: number, width: number = 30): string {
    const completed = Math.round((progress / 100) * width);
    const remaining = width - completed;
    
    return chalk.green('█'.repeat(completed)) + chalk.gray('░'.repeat(remaining));
  }

  /**
   * Formate une durée en millisecondes
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Affiche un tableau de bord temps réel
   */
  showRealtimeDashboard(): void {
    // Clear console pour un affichage propre
    console.clear();
    
    // Header stylé
    console.log(chalk.bold.cyan('🚀 FIREBASE APP BUILDER AGENT - DASHBOARD TEMPS RÉEL'));
    console.log(chalk.cyan('═'.repeat(80)));
    console.log();
    
    // Informations du projet
    if (this.currentProject && this.projectStartTime) {
      const totalTime = Date.now() - this.projectStartTime;
      const globalProgress = Math.round((this.currentStepIndex / this.totalSteps) * 100);
      const progressBar = this.createProgressBar(globalProgress, 40);
      
      console.log(chalk.bold('📂 Projet:'), chalk.yellow(this.currentProject));
      console.log(chalk.bold('⏱️ Temps:'), this.formatDuration(totalTime));
      console.log(chalk.bold('📊 Progression:'));
      console.log(`   ${progressBar} ${globalProgress}%`);
      console.log();
      
      // Étape actuelle
      const currentStepName = this.stepNames[this.currentStepIndex] || `Étape ${this.currentStepIndex + 1}`;
      console.log(chalk.bold('🔄 Étape actuelle:'), chalk.cyan(currentStepName));
      console.log(chalk.bold('📈 Étape:'), `${this.currentStepIndex + 1}/${this.totalSteps}`);
      console.log();
      
      // Statistiques
      console.log(chalk.bold('📊 Statistiques:'));
      console.log(`   🏗️ Modèles détectés: ${chalk.green(this.currentStats.modelsDetected)}`);
      console.log(`   🛠️ APIs générées: ${chalk.green(this.currentStats.apisGenerated)}`);
      console.log(`   🧪 Tests créés: ${chalk.green(this.currentStats.testsCreated)}`);
      console.log(`   🤖 Tokens Claude: ${chalk.green(this.currentStats.tokensUsed)}`);
      console.log();
    }
    
    // Instructions
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.bold('🎮 Contrôles:'), chalk.gray('Ctrl+C pour arrêter • Q pour quitter le dashboard'));
    console.log(chalk.gray('━'.repeat(80)));
  }

  /**
   * Méthode pour l'ancien code de setCurrentProject
   */
  setCurrentProject(projectName: string): void {
    this.currentProject = projectName;
    this.projectStartTime = Date.now();
    this.currentStepIndex = 0;
    this.currentStats = {
      modelsDetected: 0,
      apisGenerated: 0,
      testsCreated: 0,
      tokensUsed: 0
    };
    console.log(chalk.cyan(`📂 Nouveau projet: ${projectName}`));
    this.info(`Nouveau projet démarré: ${projectName}`);
  }
}

// Instance globale du logger
export const logger = new AgentLogger();