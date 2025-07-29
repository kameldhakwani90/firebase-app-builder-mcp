import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { logger, ProgressUpdate } from './logger.js';

export interface ProgressBarOptions {
  width: number;
  completeChar: string;
  incompleteChar: string;
  showPercentage: boolean;
  showTime: boolean;
}

export class ProgressUI {
  private options: ProgressBarOptions;
  private currentUpdate?: ProgressUpdate;
  private displayTimer?: NodeJS.Timeout;
  private startTime: number;
  private isDisplaying: boolean = false;

  constructor(options: Partial<ProgressBarOptions> = {}) {
    this.options = {
      width: 40,
      completeChar: '█',
      incompleteChar: '░',
      showPercentage: true,
      showTime: true,
      ...options
    };
    
    this.startTime = Date.now();
    this.setupProgressMonitoring();
  }

  private setupProgressMonitoring(): void {
    // S'abonner aux mises à jour de progression du logger
    logger.onProgress((update: ProgressUpdate) => {
      this.updateProgress(update);
    });
  }

  updateProgress(update: ProgressUpdate): void {
    this.currentUpdate = update;
    
    if (!this.isDisplaying) {
      this.startDisplay();
    }
  }

  private startDisplay(): void {
    this.isDisplaying = true;
    
    // Clear console et afficher l'interface
    this.displayTimer = setInterval(() => {
      this.renderProgressInterface();
    }, 500); // Mise à jour toutes les 500ms
  }

  private stopDisplay(): void {
    if (this.displayTimer) {
      clearInterval(this.displayTimer);
      this.displayTimer = undefined;
    }
    this.isDisplaying = false;
  }

  private renderProgressInterface(): void {
    if (!this.currentUpdate) return;

    // Clear console
    console.clear();
    
    // Header
    this.renderHeader();
    
    // Informations du projet
    this.renderProjectInfo();
    
    // Barre de progression globale
    this.renderGlobalProgress();
    
    // Étape actuelle
    this.renderCurrentStep();
    
    // Statistiques
    this.renderStats();
    
    // Logs récents
    this.renderRecentLogs();
    
    // Instructions
    this.renderInstructions();
  }

  private renderHeader(): void {
    try {
      // ASCII Art ultra stylé avec figlet
      const asciiTitle = figlet.textSync('FIREBASE AGENT', {
        font: 'ANSI Shadow',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      });
      
      // Gradient ultra stylé
      const gradientTitle = gradient(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'])(asciiTitle);
      console.log(gradientTitle);
      
      // Box stylé avec informations
      const headerBox = boxen(
        `${chalk.bold.cyan('🚀 Firebase App Builder Agent V2.0')}\n` +
        `${chalk.gray('Intelligence Artificielle • Migration Automatique • Tests E2E')}\n` +
        `${chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'cyan',
          backgroundColor: 'bgBlack'
        }
      );
      
      console.log(headerBox);
      
    } catch (error) {
      // Fallback si figlet échoue
      const separator = chalk.gray('═'.repeat(80));
      console.log(separator);
      console.log(gradient(['#FF6B6B', '#4ECDC4'])('                       🔥 FIREBASE APP BUILDER AGENT V2.0 🔥'));
      console.log(chalk.bold.cyan('                         Dashboard de Progression Ultra Stylé'));
      console.log(separator);
      console.log();
    }
  }

  private renderProjectInfo(): void {
    if (!this.currentUpdate) return;

    const projectName = chalk.bold.yellow(this.currentUpdate.projectName);
    const currentStep = chalk.blue(this.currentUpdate.currentStep);
    
    console.log(chalk.bold('📂 Projet:'), projectName);
    console.log(chalk.bold('🔄 Étape:'), currentStep);
    console.log();
  }

  private renderGlobalProgress(): void {
    if (!this.currentUpdate) return;

    const progress = Math.round(this.currentUpdate.progress);
    const completed = Math.round((this.options.width * progress) / 100);
    const remaining = this.options.width - completed;

    const progressBar = 
      chalk.green(this.options.completeChar.repeat(completed)) +
      chalk.gray(this.options.incompleteChar.repeat(remaining));

    console.log(chalk.bold('📊 Progression Globale:'));
    console.log(`${progressBar} ${progress}%`);
    console.log();
  }

  private renderCurrentStep(): void {
    if (!this.currentUpdate) return;

    console.log(chalk.bold('⚡ Étape Actuelle:'));
    console.log(`   ${chalk.cyan('●')} ${this.currentUpdate.message}`);
    
    // Temps écoulé pour cette étape
    const stepTime = this.formatDuration(this.currentUpdate.timeElapsed);
    console.log(`   ${chalk.gray('⏱️  Temps écoulé:')} ${stepTime}`);
    
    // Estimation temps restant
    if (this.currentUpdate.estimatedTimeRemaining) {
      const remaining = this.formatDuration(this.currentUpdate.estimatedTimeRemaining);
      console.log(`   ${chalk.gray('⏳ Temps estimé restant:')} ${remaining}`);
    }
    
    console.log();
  }

  private renderStats(): void {
    if (!this.currentUpdate) return;

    const totalTime = this.formatDuration(Date.now() - this.startTime);
    
    console.log(chalk.bold('📈 Statistiques:'));
    console.log(`   ${chalk.gray('⌚ Temps total:')} ${totalTime}`);
    console.log(`   ${chalk.gray('🎯 Projet:')} ${this.currentUpdate.projectName}`);
    console.log(`   ${chalk.gray('🔧 PID:')} ${process.pid}`);
    console.log();
  }

  private async renderRecentLogs(): Promise<void> {
    console.log(chalk.bold('📝 Logs Récents:'));
    
    try {
      const recentLogs = await logger.getRecentLogs(0.5); // 30 minutes
      const displayLogs = recentLogs.slice(0, 5); // 5 derniers logs
      
      if (displayLogs.length === 0) {
        console.log(chalk.gray('   Aucun log récent'));
      } else {
        displayLogs.forEach(log => {
          const time = chalk.gray(log.timestamp.slice(11, 19));
          let levelIcon = '';
          let levelColor = chalk.white;
          
          switch (log.level) {
            case 'DEBUG': levelIcon = '🔍'; levelColor = chalk.gray; break;
            case 'INFO': levelIcon = 'ℹ️'; levelColor = chalk.blue; break;
            case 'WARN': levelIcon = '⚠️'; levelColor = chalk.yellow; break;
            case 'ERROR': levelIcon = '❌'; levelColor = chalk.red; break;
            case 'SUCCESS': levelIcon = '✅'; levelColor = chalk.green; break;
          }
          
          const message = log.message.length > 60 ? 
            log.message.substring(0, 57) + '...' : 
            log.message;
          
          console.log(`   ${time} ${levelIcon} ${levelColor(message)}`);
        });
      }
    } catch (error) {
      console.log(chalk.red('   Erreur lors de la récupération des logs'));
    }
    
    console.log();
  }

  private renderInstructions(): void {
    const separator = chalk.gray('─'.repeat(80));
    console.log(separator);
    console.log(chalk.bold('🎮 Contrôles:'));
    console.log(`   ${chalk.cyan('Ctrl+C')} - Arrêter l'agent`);
    console.log(`   ${chalk.cyan('Q')} - Quitter le dashboard (agent continue en arrière-plan)`);
    console.log(`   ${chalk.cyan('L')} - Voir tous les logs`);
    console.log(`   ${chalk.cyan('S')} - Statistiques détaillées`);
    console.log(separator);
  }

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

  // Méthodes publiques pour contrôler l'affichage
  start(): void {
    if (!this.isDisplaying) {
      this.startDisplay();
    }
  }

  stop(): void {
    this.stopDisplay();
    console.clear();
    console.log(chalk.green('✅ Dashboard fermé - L\'agent continue en arrière-plan'));
  }

  // Affichage d'un message d'erreur critique
  showCriticalError(error: string): void {
    console.clear();
    
    const errorBox = [
      '╔══════════════════════════════════════════════════════════════════════════════╗',
      '║                                ERREUR CRITIQUE                               ║',
      '╠══════════════════════════════════════════════════════════════════════════════╣',
      `║ ${error.padEnd(76)} ║`,
      '║                                                                              ║',
      '║ L\'agent s\'est arrêté. Vérifiez les logs pour plus de détails.              ║',
      '║                                                                              ║',
      '║ Commandes utiles:                                                            ║',
      '║   firebase-app-builder continue <projet>  - Reprendre le projet             ║',
      '║   firebase-app-builder logs               - Voir les logs détaillés         ║',
      '╚══════════════════════════════════════════════════════════════════════════════╝'
    ];

    errorBox.forEach(line => console.log(chalk.red(line)));
  }

  // Affichage du succès final
  showSuccess(projectName: string, duration: number): void {
    console.clear();
    
    const successBox = [
      '╔══════════════════════════════════════════════════════════════════════════════╗',
      '║                               🎉 SUCCÈS ! 🎉                                ║',
      '╠══════════════════════════════════════════════════════════════════════════════╣',
      `║ Projet: ${projectName.padEnd(65)} ║`,
      `║ Durée: ${this.formatDuration(duration).padEnd(66)} ║`,
      '║                                                                              ║',
      '║ ✅ Migration terminée avec succès                                           ║',
      '║ ✅ Base de données PostgreSQL configurée                                    ║',
      '║ ✅ Tests utilisateur générés                                                ║',
      '║ ✅ Rapport de migration créé                                                ║',
      '║                                                                              ║',
      '║ Prochaines étapes:                                                           ║',
      '║   1. cd <projet>                                                             ║',
      '║   2. npm install                                                             ║',
      '║   3. npm run dev                                                             ║',
      '╚══════════════════════════════════════════════════════════════════════════════╝'
    ];

    successBox.forEach(line => console.log(chalk.green(line)));
    
    this.stopDisplay();
  }
}

// Instance globale de l'interface de progression
export const progressUI = new ProgressUI();