import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { logger } from './utils/logger.js';

export interface WebServerConfig {
  port: number;
  host: string;
}

export interface ProjectConfig {
  githubUrl: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  superAdmin?: {
    email: string;
    password: string;
    name: string;
  };
}

export class WebServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private clients: Set<any> = new Set();
  private config: WebServerConfig;
  private projectConfig?: ProjectConfig;
  private bridgeDir: string;

  constructor(config: WebServerConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.bridgeDir = path.join(process.cwd(), '.claude-agent-bridge');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.startTokenMonitoring();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'web-dashboard')));
  }

  private setupRoutes() {
    // Route principale - Interface de configuration
    this.app.get('/', (req, res) => {
      const indexPath = path.join(process.cwd(), 'web-dashboard', 'index.html');
      res.sendFile(indexPath);
    });

    // API pour recevoir la configuration PostgreSQL
    this.app.post('/api/postgres-config', (req, res) => {
      try {
        const config = req.body;
        this.projectConfig = {
          ...this.projectConfig,
          database: config
        } as ProjectConfig;

        // Sauvegarder dans un fichier pour l'agent
        const configPath = path.join(this.bridgeDir, 'project-config.json');
        fs.writeJsonSync(configPath, this.projectConfig);

        // Notifier tous les clients WebSocket
        this.broadcast({
          type: 'postgres-config-received',
          config: config
        });

        logger.info('Configuration PostgreSQL reçue', config);
        res.json({ success: true });
      } catch (error) {
        logger.error('Erreur sauvegarde config PostgreSQL', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour recevoir la configuration complète du projet
    this.app.post('/api/project-config', (req, res) => {
      try {
        this.projectConfig = req.body;
        
        // Sauvegarder la configuration
        const configPath = path.join(this.bridgeDir, 'project-config.json');
        fs.writeJsonSync(configPath, this.projectConfig);

        // Démarrer le processus de migration
        this.broadcast({
          type: 'project-config-received',
          config: this.projectConfig
        });

        logger.info('Configuration projet reçue', this.projectConfig);
        res.json({ success: true });
      } catch (error) {
        logger.error('Erreur sauvegarde config projet', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour tester la connexion PostgreSQL
    this.app.post('/api/postgres-test', (req, res) => {
      // TODO: Implémenter test de connexion réel
      const config = req.body;
      
      // Simulation du test (à remplacer par vraie connexion)
      setTimeout(() => {
        const success = config.host && config.username && config.password;
        this.broadcast({
          type: 'postgres-test-result',
          result: {
            success,
            message: success ? 'Connexion réussie' : 'Paramètres manquants'
          }
        });
      }, 1000);

      res.json({ success: true });
    });

    // API pour les confirmations Claude Code
    this.app.post('/api/claude-confirmation', (req, res) => {
      const { confirmed, requestId, response } = req.body;
      
      // Sauvegarder la réponse dans le bridge
      const responsePath = path.join(this.bridgeDir, `response_${requestId}.json`);
      const responseData = {
        content: response || (confirmed ? 'Confirmé' : 'Refusé'),
        tokensUsed: 100,
        confidence: 0.9,
        confirmed
      };
      
      fs.writeJsonSync(responsePath, responseData);

      this.broadcast({
        type: 'claude-confirmation-processed',
        requestId,
        confirmed,
        response
      });

      res.json({ success: true });
    });

    // API pour programmer une reprise
    this.app.post('/api/schedule-resume', (req, res) => {
      const { resumeTime, reason } = req.body;
      
      const scheduleData = {
        resumeTime: new Date(resumeTime),
        reason,
        scheduledAt: new Date()
      };

      const schedulePath = path.join(this.bridgeDir, 'scheduled-resume.json');
      fs.writeJsonSync(schedulePath, scheduleData);

      this.broadcast({
        type: 'resume-scheduled',
        data: scheduleData
      });

      logger.info('Reprise programmée', scheduleData);
      res.json({ success: true });
    });

    // API pour lister les projets existants
    this.app.get('/api/projects', (req, res) => {
      try {
        const projectsPath = path.join(process.cwd(), '..', 'firebase-migrations', 'projects.json');
        const agentStatePath = path.join(process.cwd(), '..', 'firebase-migrations', 'agent-state.json');
        
        let projects = [];
        let currentAgent = null;
        
        if (fs.existsSync(projectsPath)) {
          projects = fs.readJsonSync(projectsPath);
        }
        
        if (fs.existsSync(agentStatePath)) {
          currentAgent = fs.readJsonSync(agentStatePath);
        }
        
        res.json({ 
          success: true, 
          projects,
          currentAgent
        });
      } catch (error) {
        logger.error('Erreur lecture projets', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour continuer un projet existant
    this.app.post('/api/continue-project', (req, res) => {
      try {
        const { projectName } = req.body;
        
        const continueData = {
          action: 'continue',
          projectName,
          timestamp: Date.now()
        };

        const continuePath = path.join(this.bridgeDir, 'continue-project.json');
        fs.writeJsonSync(continuePath, continueData);

        this.broadcast({
          type: 'project-continue-requested',
          data: continueData
        });

        logger.info('Continuation projet demandée', continueData);
        res.json({ success: true });
      } catch (error) {
        logger.error('Erreur continuation projet', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour écraser un projet existant
    this.app.post('/api/overwrite-project', (req, res) => {
      try {
        const { projectName, newGithubUrl, database, superAdmin } = req.body;
        
        const overwriteData = {
          action: 'overwrite',
          projectName,
          newConfig: {
            githubUrl: newGithubUrl,
            database,
            superAdmin
          },
          timestamp: Date.now()
        };

        const overwritePath = path.join(this.bridgeDir, 'overwrite-project.json');
        fs.writeJsonSync(overwritePath, overwriteData);

        this.broadcast({
          type: 'project-overwrite-requested',
          data: overwriteData
        });

        logger.info('Écrasement projet demandé', overwriteData);
        res.json({ success: true });
      } catch (error) {
        logger.error('Erreur écrasement projet', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour supprimer un projet
    this.app.delete('/api/projects/:name', (req, res) => {
      try {
        const { name } = req.params;
        
        const deleteData = {
          action: 'delete',
          projectName: name,
          timestamp: Date.now()
        };

        const deletePath = path.join(this.bridgeDir, 'delete-project.json');
        fs.writeJsonSync(deletePath, deleteData);

        this.broadcast({
          type: 'project-delete-requested',
          data: deleteData
        });

        logger.info('Suppression projet demandée', deleteData);
        res.json({ success: true });
      } catch (error) {
        logger.error('Erreur suppression projet', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour vérifier les mises à jour
    this.app.get('/api/check-updates', async (req, res) => {
      try {
        const currentVersion = await this.getCurrentVersion();
        const latestVersion = await this.getLatestGitHubVersion();
        const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;
        
        res.json({
          success: true,
          currentVersion,
          latestVersion,
          hasUpdate,
          updateAvailable: hasUpdate
        });
      } catch (error) {
        logger.error('Erreur vérification mise à jour', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour effectuer la mise à jour
    this.app.post('/api/update-agent', async (req, res) => {
      try {
        const updateResult = await this.performUpdate();
        
        this.broadcast({
          type: 'update-completed',
          data: updateResult
        });

        res.json({ success: true, result: updateResult });
      } catch (error) {
        logger.error('Erreur mise à jour', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour obtenir la configuration système
    this.app.get('/api/system-config', (req, res) => {
      try {
        const config = {
          currentPort: this.config.port,
          projectsPath: path.join(process.cwd(), '..', 'firebase-migrations'),
          agentPath: process.cwd(),
          webInterfaceUrl: `http://${this.config.host}:${this.config.port}`,
          availablePorts: this.getAvailablePorts()
        };
        
        res.json({ success: true, config });
      } catch (error) {
        logger.error('Erreur lecture config système', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour changer le port
    this.app.post('/api/change-port', async (req, res) => {
      try {
        const { newPort } = req.body;
        
        if (newPort && newPort !== this.config.port) {
          const portChangeData = {
            oldPort: this.config.port,
            newPort: parseInt(newPort),
            timestamp: Date.now()
          };

          const portChangePath = path.join(this.bridgeDir, 'port-change.json');
          fs.writeJsonSync(portChangePath, portChangeData);

          this.broadcast({
            type: 'port-change-requested',
            data: portChangeData
          });

          res.json({ success: true, message: 'Redémarrage avec nouveau port demandé' });
        } else {
          res.json({ success: false, error: 'Port invalide ou identique' });
        }
      } catch (error) {
        logger.error('Erreur changement port', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log(chalk.green('🌐 Nouvelle connexion WebSocket'));
      this.clients.add(ws);

      // Envoyer le statut initial
      this.sendInitialStatus(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Erreur parsing message WebSocket:', error);
        }
      });

      ws.on('close', () => {
        console.log(chalk.yellow('🌐 Connexion WebSocket fermée'));
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('Erreur WebSocket:', error);
        this.clients.delete(ws);
      });
    });
  }

  private handleWebSocketMessage(ws: any, data: any) {
    switch (data.type) {
      case 'request-status':
        this.sendInitialStatus(ws);
        break;

      case 'postgres-test-connection':
        // Test de connexion PostgreSQL
        this.testPostgresConnection(data.config);
        break;

      default:
        console.log('Message WebSocket non géré:', data);
    }
  }

  private sendInitialStatus(ws: any) {
    // Lire le statut de l'agent depuis le fichier d'état
    try {
      const statePath = path.join(process.cwd(), '..', 'firebase-migrations', 'agent-state.json');
      let agentState: any = {};
      
      if (fs.existsSync(statePath)) {
        agentState = fs.readJsonSync(statePath);
      }

      ws.send(JSON.stringify({
        type: 'status-update',
        data: {
          isRunning: agentState.isRunning || false,
          projectName: agentState.projectName || null,
          currentStep: agentState.currentStep || null,
          duration: agentState.startTime ? Date.now() - agentState.startTime : 0,
          lastHeartbeat: agentState.lastHeartbeat || null
        }
      }));
    } catch (error) {
      console.error('Erreur lecture statut agent:', error);
    }
  }

  private testPostgresConnection(config: any) {
    // TODO: Implémenter vraie connexion PostgreSQL
    // Pour l'instant, simulation
    setTimeout(() => {
      const success = config.host && config.username && config.password;
      this.broadcast({
        type: 'postgres-test-result',
        result: {
          success,
          message: success ? 'Connexion PostgreSQL réussie' : 'Paramètres de connexion invalides'
        }
      });
    }, 2000);
  }

  private broadcast(data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  private startTokenMonitoring() {
    // Surveillance des tokens Claude Code
    setInterval(() => {
      this.checkClaudeTokens();
      this.checkScheduledResume();
    }, 30000); // Toutes les 30 secondes
  }

  private checkClaudeTokens() {
    // Vérifier s'il y a des messages d'épuisement de tokens
    const tokenStatusPath = path.join(this.bridgeDir, 'token-status.json');
    
    if (fs.existsSync(tokenStatusPath)) {
      try {
        const tokenStatus = fs.readJsonSync(tokenStatusPath);
        
        if (tokenStatus.exhausted) {
          this.broadcast({
            type: 'tokens-exhausted',
            data: {
              message: 'Tokens Claude Code épuisés',
              nextAvailable: tokenStatus.nextAvailable,
              suggestedResumeTime: tokenStatus.suggestedResumeTime
            }
          });
        }
      } catch (error) {
        console.error('Erreur lecture statut tokens:', error);
      }
    }
  }

  private checkScheduledResume() {
    // Vérifier s'il est temps de reprendre
    const schedulePath = path.join(this.bridgeDir, 'scheduled-resume.json');
    
    if (fs.existsSync(schedulePath)) {
      try {
        const scheduleData = fs.readJsonSync(schedulePath);
        const resumeTime = new Date(scheduleData.resumeTime);
        
        if (Date.now() >= resumeTime.getTime()) {
          // Il est temps de reprendre !
          this.broadcast({
            type: 'auto-resume-triggered',
            data: {
              message: 'Reprise automatique déclenchée',
              originalSchedule: scheduleData
            }
          });

          // Supprimer le fichier de programmation
          fs.removeSync(schedulePath);

          // Déclencher la reprise (signal pour l'agent)
          const resumeSignalPath = path.join(this.bridgeDir, 'resume-signal.json');
          fs.writeJsonSync(resumeSignalPath, {
            triggered: true,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Erreur vérification reprise programmée:', error);
      }
    }
  }

  // ===== MÉTHODES DE MISE À JOUR =====
  
  private async getCurrentVersion(): Promise<string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = await fs.readJson(packagePath);
      return packageJson.version || '0.0.0';
    } catch (error) {
      return '0.0.0';
    }
  }

  private async getLatestGitHubVersion(): Promise<string> {
    try {
      // Utiliser l'API GitHub pour obtenir la dernière release
      const response = await fetch('https://api.github.com/repos/kameldhakwani90/firebase-app-builder-mcp/releases/latest');
      if (response.ok) {
        const data = await response.json() as any;
        return data.tag_name?.replace('v', '') || '2.5.0'; // Enlever le 'v' du tag
      }
      
      // Fallback: vérifier les commits récents
      const commitsResponse = await fetch('https://api.github.com/repos/kameldhakwani90/firebase-app-builder-mcp/commits?per_page=1');
      if (commitsResponse.ok) {
        const commits = await commitsResponse.json() as any[];
        const latestCommit = commits[0];
        const commitDate = new Date(latestCommit.commit.author.date);
        
        // Générer une version basée sur la date du commit
        const year = commitDate.getFullYear();
        const month = String(commitDate.getMonth() + 1).padStart(2, '0');
        const day = String(commitDate.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
      }
      
      return '2.5.0'; // Version par défaut
    } catch (error) {
      logger.error('Erreur récupération version GitHub', error);
      return '2.5.0';
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(n => parseInt(n) || 0);
    const v2Parts = version2.split('.').map(n => parseInt(n) || 0);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  private async performUpdate(): Promise<any> {
    return new Promise((resolve, reject) => {
      logger.info('Début mise à jour agent');
      const steps: string[] = [];
      
      // Étape 1: Désinstaller l'ancienne version
      steps.push('🗑️ Désinstallation ancienne version...');
      const uninstall = spawn('npm', ['uninstall', '-g', '@kameldhakwani90/firebase-app-builder-mcp'], {
        stdio: 'pipe',
        shell: true
      });

      uninstall.on('close', (code) => {
        if (code === 0) {
          steps.push('✅ Ancienne version désinstallée');
          
          // Étape 2: Installer la nouvelle version depuis GitHub
          steps.push('📥 Installation nouvelle version depuis GitHub...');
          const install = spawn('npm', ['install', '-g', 'git+https://github.com/kameldhakwani90/firebase-app-builder-mcp.git'], {
            stdio: 'pipe',
            shell: true
          });

          install.on('close', (installCode) => {
            if (installCode === 0) {
              steps.push('✅ Nouvelle version installée avec succès');
              resolve({
                success: true,
                steps,
                message: 'Mise à jour terminée ! Redémarrez l\'agent pour utiliser la nouvelle version.'
              });
            } else {
              steps.push('❌ Erreur lors de l\'installation');
              resolve({
                success: false,
                steps,
                error: 'Échec installation nouvelle version'
              });
            }
          });

          install.on('error', (error) => {
            steps.push(`❌ Erreur installation: ${error.message}`);
            resolve({
              success: false,
              steps,
              error: error.message
            });
          });
        } else {
          steps.push('⚠️ Échec désinstallation (normale si pas installé)');
          // Continuer quand même avec l'installation
          steps.push('📥 Installation nouvelle version...');
          const install = spawn('npm', ['install', '-g', 'git+https://github.com/kameldhakwani90/firebase-app-builder-mcp.git'], {
            stdio: 'pipe',
            shell: true
          });

          install.on('close', (installCode) => {
            if (installCode === 0) {
              steps.push('✅ Installation réussie');
              resolve({
                success: true,
                steps,
                message: 'Installation terminée !'
              });
            } else {
              steps.push('❌ Erreur installation');
              resolve({
                success: false,
                steps,
                error: 'Échec installation'
              });
            }
          });
        }
      });

      // Timeout de sécurité
      setTimeout(() => {
        reject(new Error('Timeout mise à jour (5 minutes)'));
      }, 300000);
    });
  }

  private getAvailablePorts(): number[] {
    // Générer une liste de ports disponibles
    const basePorts = [3000, 3001, 3002, 3003, 3004, 3005, 8000, 8080, 8888, 9000];
    return basePorts.filter(port => port !== this.config.port);
  }

  async start(): Promise<string> {
    // Créer le répertoire bridge
    await fs.ensureDir(this.bridgeDir);

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        const url = `http://${this.config.host}:${this.config.port}`;
        console.log(chalk.green(`🌐 Interface Web lancée: ${chalk.bold.blue(url)}`));
        console.log(chalk.cyan(`📡 WebSocket Server: ws://${this.config.host}:${this.config.port}`));
        
        logger.info('Serveur Web démarré', { url, port: this.config.port });
        resolve(url);
      });

      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.config.port} déjà utilisé`));
        } else {
          reject(error);
        }
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          console.log(chalk.yellow('🌐 Serveur Web fermé'));
          resolve();
        });
      });
    });
  }

  getProjectConfig(): ProjectConfig | undefined {
    return this.projectConfig;
  }
}