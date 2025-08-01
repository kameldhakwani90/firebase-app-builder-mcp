import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';

export class WebSyncMonitor {
  private bridgeDir: string;
  private watchInterval: NodeJS.Timeout | null = null;
  private processedFiles: Set<string> = new Set();

  constructor() {
    this.bridgeDir = path.join(process.cwd(), '.claude-agent-bridge');
  }

  async startMonitoring(): Promise<void> {
    await fs.ensureDir(this.bridgeDir);
    
    // Surveiller les fichiers de synchronisation toutes les 2 secondes
    this.watchInterval = setInterval(() => {
      this.checkForSyncFiles();
    }, 2000);

    logger.info('Surveillance synchronisation web démarrée', { bridgeDir: this.bridgeDir });
  }

  stopMonitoring(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      logger.info('Surveillance synchronisation web arrêtée');
    }
  }

  private async checkForSyncFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.bridgeDir);
      const syncFiles = files.filter(f => f.startsWith('claude-sync-') && f.endsWith('.json'));

      for (const file of syncFiles) {
        if (!this.processedFiles.has(file)) {
          await this.processSyncFile(file);
          this.processedFiles.add(file);
        }
      }
    } catch (error) {
      // Ignorer les erreurs de lecture silencieusement
    }
  }

  private async processSyncFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.bridgeDir, filename);
      const syncData = await fs.readJson(filePath);

      // Traiter selon le type d'action
      switch (syncData.action) {
        case 'start_migration':
          this.handleStartMigration(syncData);
          break;
        case 'continue_project':
          this.handleContinueProject(syncData);
          break;
        case 'test_database':
          this.handleTestDatabase(syncData);
          break;
        default:
          logger.info('Action de synchronisation web reçue', {
            action: syncData.action,
            message: syncData.message
          });
      }

      // Nettoyer le fichier traité après 10 secondes
      setTimeout(async () => {
        try {
          await fs.remove(filePath);
          this.processedFiles.delete(filename);
        } catch (error) {
          // Ignorer les erreurs de suppression
        }
      }, 10000);

    } catch (error) {
      logger.error('Erreur traitement fichier sync', error, { filename });
    }
  }

  private handleStartMigration(syncData: any): void {
    logger.info('🚀 Démarrage migration depuis interface web', {
      githubUrl: syncData.data.githubUrl,
      hasDescription: !!syncData.data.projectDescription,
      database: syncData.data.database?.host,
      timestamp: new Date(syncData.timestamp).toISOString()
    });

    console.log(`\n🌐 Action depuis l'interface web:`);
    console.log(`   📂 Projet: ${syncData.data.githubUrl}`);
    if (syncData.data.projectDescription) {
      console.log(`   📝 Description: ${syncData.data.projectDescription.substring(0, 100)}...`);
    }
    console.log(`   🗄️  Base: ${syncData.data.database?.host}:${syncData.data.database?.port}/${syncData.data.database?.database}`);
    console.log(`   ⏰ Heure: ${new Date(syncData.timestamp).toLocaleString()}\n`);
  }

  private handleContinueProject(syncData: any): void {
    logger.info('▶️ Continuation projet depuis interface web', {
      projectName: syncData.data.projectName,
      timestamp: new Date(syncData.timestamp).toISOString()
    });

    console.log(`\n🌐 Action depuis l'interface web:`);
    console.log(`   ▶️ Continuation du projet: ${syncData.data.projectName}`);
    console.log(`   ⏰ Heure: ${new Date(syncData.timestamp).toLocaleString()}\n`);
  }

  private handleTestDatabase(syncData: any): void {
    logger.info('🔍 Test base données depuis interface web', {
      host: syncData.data.host,
      database: syncData.data.database,
      timestamp: new Date(syncData.timestamp).toISOString()
    });

    console.log(`\n🌐 Action depuis l'interface web:`);
    console.log(`   🔍 Test connexion: ${syncData.data.host}:${syncData.data.port}/${syncData.data.database}`);
    console.log(`   ⏰ Heure: ${new Date(syncData.timestamp).toLocaleString()}\n`);
  }

  // Méthode pour créer une notification vers l'interface web
  async notifyWebInterface(type: string, data: any): Promise<void> {
    try {
      const notificationData = {
        timestamp: Date.now(),
        type,
        data,
        fromAgent: true
      };

      const notifPath = path.join(this.bridgeDir, `web-notification-${Date.now()}.json`);
      await fs.writeJson(notifPath, notificationData);

      logger.info('Notification envoyée vers interface web', { type, data });
    } catch (error) {
      logger.error('Erreur envoi notification web', error);
    }
  }
}

export const webSyncMonitor = new WebSyncMonitor();