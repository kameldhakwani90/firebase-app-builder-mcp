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
}

export class AgentLogger {
  private logDir: string;
  private currentLogFile: string;
  private progressCallbacks: ((update: ProgressUpdate) => void)[] = [];
  private currentProject?: string;
  private stepStartTime?: number;
  private totalSteps = 4; // analyse, migration, tests, finalisation
  private currentStepIndex = 0;

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
}

// Instance globale du logger
export const logger = new AgentLogger();