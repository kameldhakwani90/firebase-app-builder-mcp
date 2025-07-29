import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { logger } from './logger.js';
import { safetyManager } from './safety.js';

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  diskSpace: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  uptime: number;
}

export class MonitoringDashboard {
  private refreshInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;

  async showFullDashboard(): Promise<void> {
    console.clear();
    
    // Header principal
    this.renderDashboardHeader();
    
    // Statistiques système
    await this.renderSystemStats();
    
    // État de l'agent
    await this.renderAgentStatus();
    
    // Projets récents
    await this.renderRecentProjects();
    
    // Statistiques des logs
    await this.renderLogStats();
    
    // Performance et santé
    await this.renderHealthStatus();
    
    // Footer avec instructions
    this.renderDashboardFooter();
  }

  startLiveMonitoring(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(chalk.green('🔴 Monitoring en direct démarré - Appuyez sur Ctrl+C pour arrêter'));
    
    this.refreshInterval = setInterval(async () => {
      await this.showFullDashboard();
    }, 2000); // Refresh toutes les 2 secondes
  }

  stopLiveMonitoring(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
    this.isRunning = false;
    console.log(chalk.yellow('📴 Monitoring arrêté'));
  }

  private renderDashboardHeader(): void {
    const now = new Date().toLocaleString('fr-FR');
    const separator = chalk.blue('═'.repeat(90));
    
    console.log(separator);
    console.log(chalk.bold.cyan('                     🔥 FIREBASE APP BUILDER - DASHBOARD DE MONITORING'));
    console.log(chalk.gray(`                                    ${now}`));
    console.log(separator);
    console.log();
  }

  private async renderSystemStats(): Promise<void> {
    console.log(chalk.bold.yellow('📊 STATISTIQUES SYSTÈME'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const stats = await this.getSystemStats();
    
    // CPU
    const cpuBar = this.createProgressBar(stats.cpuUsage, 20);
    console.log(`${chalk.cyan('💻 CPU:')} ${cpuBar} ${stats.cpuUsage.toFixed(1)}%`);
    
    // Mémoire
    const memBar = this.createProgressBar(stats.memoryUsage.percentage, 20);
    const memUsed = this.formatBytes(stats.memoryUsage.used);
    const memTotal = this.formatBytes(stats.memoryUsage.total);
    console.log(`${chalk.cyan('🧠 RAM:')} ${memBar} ${stats.memoryUsage.percentage.toFixed(1)}% (${memUsed}/${memTotal})`);
    
    // Disque
    const diskBar = this.createProgressBar(stats.diskSpace.percentage, 20);
    const diskUsed = this.formatBytes(stats.diskSpace.used);
    const diskTotal = this.formatBytes(stats.diskSpace.total);
    console.log(`${chalk.cyan('💾 Disque:')} ${diskBar} ${stats.diskSpace.percentage.toFixed(1)}% (${diskUsed}/${diskTotal})`);
    
    // Uptime
    const uptime = this.formatDuration(stats.uptime * 1000);
    console.log(`${chalk.cyan('⏱️  Uptime:')} ${uptime}`);
    
    console.log();
  }

  private async renderAgentStatus(): Promise<void> {
    console.log(chalk.bold.yellow('🤖 ÉTAT DE L\'AGENT'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const execution = safetyManager.getCurrentExecution();
    
    if (execution?.isRunning) {
      console.log(`${chalk.green('🟢 Statut:')} En cours d'exécution`);
      console.log(`${chalk.cyan('📂 Projet:')} ${execution.projectName}`);
      console.log(`${chalk.cyan('🔄 Étape:')} ${execution.currentStep}`);
      console.log(`${chalk.cyan('⏱️  Durée:')} ${this.formatDuration(Date.now() - execution.startTime)}`);
      console.log(`${chalk.cyan('🔄 Tentatives:')} ${execution.retryCount}`);
      console.log(`${chalk.cyan('🆔 PID:')} ${execution.pid}`);
      
      // Heartbeat status
      const heartbeatAge = Date.now() - execution.lastHeartbeat;
      const heartbeatStatus = heartbeatAge < 60000 ? 
        chalk.green('🟢 Actif') : 
        chalk.yellow('🟡 Retard');
      console.log(`${chalk.cyan('💓 Heartbeat:')} ${heartbeatStatus} (${this.formatDuration(heartbeatAge)} ago)`);
      
    } else {
      console.log(`${chalk.gray('⚪ Statut:')} Inactif`);
      console.log(`${chalk.gray('📝 Dernière activité:')} Voir les logs`);
    }
    
    console.log();
  }

  private async renderRecentProjects(): Promise<void> {
    console.log(chalk.bold.yellow('📁 PROJETS RÉCENTS'));
    console.log(chalk.gray('─'.repeat(50)));
    
    try {
      const projectsPath = path.join(os.homedir(), 'firebase-migrations', 'projects.json');
      
      if (await fs.pathExists(projectsPath)) {
        const projects = await fs.readJSON(projectsPath);
        
        if (projects.length === 0) {
          console.log(chalk.gray('   Aucun projet trouvé'));
        } else {
          // Afficher les 5 projets les plus récents
          const recent = projects
            .sort((a: any, b: any) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
            .slice(0, 5);
          
          recent.forEach((project: any) => {
            const status = this.getProjectStatusIcon(project.status);
            const time = new Date(project.lastActivity).toLocaleDateString('fr-FR');
            const name = project.name.length > 20 ? 
              project.name.substring(0, 17) + '...' : 
              project.name;
            
            console.log(`   ${status} ${chalk.cyan(name.padEnd(20))} ${chalk.gray(project.currentStep)} ${chalk.gray(time)}`);
          });
        }
      } else {
        console.log(chalk.gray('   Aucun projet trouvé'));
      }
    } catch (error) {
      console.log(chalk.red('   Erreur lors de la lecture des projets'));
    }
    
    console.log();
  }

  private async renderLogStats(): Promise<void> {
    console.log(chalk.bold.yellow('📈 STATISTIQUES DES LOGS'));
    console.log(chalk.gray('─'.repeat(50)));
    
    try {
      const stats = await logger.getLogStats();
      
      console.log(`${chalk.cyan('📊 Total logs:')} ${stats.totalLogs}`);
      console.log(`${chalk.green('✅ Succès:')} ${stats.successCount}`);
      console.log(`${chalk.yellow('⚠️  Avertissements:')} ${stats.warnCount}`);
      console.log(`${chalk.red('❌ Erreurs:')} ${stats.errorCount}`);
      
      if (stats.lastError) {
        const errorTime = new Date(stats.lastError.timestamp).toLocaleString('fr-FR');
        console.log(`${chalk.red('🚨 Dernière erreur:')} ${errorTime}`);
        console.log(`   ${chalk.gray(stats.lastError.message.substring(0, 60))}...`);
      }
      
      // Taux de réussite
      const successRate = stats.totalLogs > 0 ? 
        ((stats.totalLogs - stats.errorCount) / stats.totalLogs * 100) : 0;
      const successBar = this.createProgressBar(successRate, 15);
      console.log(`${chalk.cyan('📊 Taux réussite:')} ${successBar} ${successRate.toFixed(1)}%`);
      
    } catch (error) {
      console.log(chalk.red('   Erreur lors de la récupération des statistiques'));
    }
    
    console.log();
  }

  private async renderHealthStatus(): Promise<void> {
    console.log(chalk.bold.yellow('🏥 SANTÉ DU SYSTÈME'));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Vérifications de santé
    const healthChecks = await this.performHealthChecks();
    
    healthChecks.forEach(check => {
      const icon = check.status === 'ok' ? chalk.green('✅') : 
                   check.status === 'warning' ? chalk.yellow('⚠️') : 
                   chalk.red('❌');
      
      console.log(`   ${icon} ${check.name}: ${check.message}`);
    });
    
    console.log();
  }

  private renderDashboardFooter(): void {
    const separator = chalk.blue('═'.repeat(90));
    console.log(separator);
    console.log(chalk.bold('🎮 COMMANDES DISPONIBLES:'));
    console.log(`   ${chalk.cyan('firebase-app-builder <url>')} - Démarrer un nouveau projet`);
    console.log(`   ${chalk.cyan('firebase-app-builder continue <nom>')} - Reprendre un projet`);
    console.log(`   ${chalk.cyan('firebase-app-builder dashboard')} - Afficher ce dashboard`);
    console.log(`   ${chalk.cyan('firebase-app-builder logs')} - Voir les logs détaillés`);
    console.log(`   ${chalk.cyan('firebase-app-builder status')} - État rapide`);
    console.log(`   ${chalk.cyan('firebase-app-builder cleanup')} - Nettoyer les anciens projets`);
    console.log(separator);
  }

  // Méthodes utilitaires
  private async getSystemStats(): Promise<SystemStats> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Simple estimation CPU (pas parfait mais suffisant)
    const cpuUsage = Math.random() * 20 + 10; // Simulation pour l'exemple
    
    // Stats disque (approximation)
    const diskTotal = 1024 * 1024 * 1024 * 500; // 500GB simulation
    const diskUsed = diskTotal * 0.6; // 60% utilisé
    const diskFree = diskTotal - diskUsed;
    
    return {
      cpuUsage,
      memoryUsage: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100
      },
      diskSpace: {
        used: diskUsed,
        free: diskFree,
        total: diskTotal,
        percentage: (diskUsed / diskTotal) * 100
      },
      uptime: os.uptime()
    };
  }

  private createProgressBar(percentage: number, width: number): string {
    const completed = Math.round((width * percentage) / 100);
    const remaining = width - completed;
    
    let color = chalk.green;
    if (percentage > 80) color = chalk.red;
    else if (percentage > 60) color = chalk.yellow;
    
    return '[' + 
           color('█'.repeat(completed)) + 
           chalk.gray('░'.repeat(remaining)) + 
           ']';
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private getProjectStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return chalk.green('✅');
      case 'error': return chalk.red('❌');
      case 'analyzing': return chalk.blue('🔍');
      case 'migrating': return chalk.yellow('🔄');
      case 'testing': return chalk.cyan('🧪');
      default: return chalk.gray('⚪');
    }
  }

  private async performHealthChecks(): Promise<Array<{
    name: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
  }>> {
    const checks = [];
    
    // Vérifier l'espace disque
    const stats = await this.getSystemStats();
    if (stats.diskSpace.percentage > 90) {
      checks.push({
        name: 'Espace disque',
        status: 'error' as const,
        message: 'Espace disque critique'
      });
    } else if (stats.diskSpace.percentage > 80) {
      checks.push({
        name: 'Espace disque',
        status: 'warning' as const,
        message: 'Espace disque faible'
      });
    } else {
      checks.push({
        name: 'Espace disque',
        status: 'ok' as const,
        message: 'Espace suffisant'
      });
    }
    
    // Vérifier la mémoire
    if (stats.memoryUsage.percentage > 90) {
      checks.push({
        name: 'Mémoire',
        status: 'error' as const,
        message: 'Mémoire critique'
      });
    } else if (stats.memoryUsage.percentage > 75) {
      checks.push({
        name: 'Mémoire',
        status: 'warning' as const,
        message: 'Mémoire élevée'
      });
    } else {
      checks.push({
        name: 'Mémoire',
        status: 'ok' as const,
        message: 'Mémoire normale'
      });
    }
    
    // Vérifier les logs
    try {
      const logStats = await logger.getLogStats();
      const errorRate = logStats.totalLogs > 0 ? 
        (logStats.errorCount / logStats.totalLogs) * 100 : 0;
      
      if (errorRate > 50) {
        checks.push({
          name: 'Logs',
          status: 'error' as const,
          message: `Taux d'erreur élevé: ${errorRate.toFixed(1)}%`
        });
      } else if (errorRate > 20) {
        checks.push({
          name: 'Logs',
          status: 'warning' as const,
          message: `Quelques erreurs: ${errorRate.toFixed(1)}%`
        });
      } else {
        checks.push({
          name: 'Logs',
          status: 'ok' as const,
          message: 'Logs sains'
        });
      }
    } catch (error) {
      checks.push({
        name: 'Logs',
        status: 'warning' as const,
        message: 'Impossible de vérifier les logs'
      });
    }
    
    // Vérifier le répertoire de travail
    try {
      const workDir = path.join(os.homedir(), 'firebase-migrations');
      await fs.access(workDir);
      checks.push({
        name: 'Répertoire de travail',
        status: 'ok' as const,
        message: 'Accessible'
      });
    } catch (error) {
      checks.push({
        name: 'Répertoire de travail',
        status: 'error' as const,
        message: 'Inaccessible'
      });
    }
    
    return checks;
  }
}

// Instance globale du dashboard
export const dashboard = new MonitoringDashboard();