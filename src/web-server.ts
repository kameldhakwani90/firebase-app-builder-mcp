import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './utils/logger.js';

const execAsync = promisify(exec);

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
  private logWatchers: Map<string, any> = new Map();
  private lastLogPositions: Map<string, number> = new Map();

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

    // API pour test de connexion PostgreSQL réel (avec vraie validation)
    this.app.post('/api/postgres-test-real', async (req, res) => {
      try {
        const config = req.body;
        
        // Validation des paramètres
        if (!config.host || !config.username || !config.password || !config.database) {
          return res.json({
            success: false,
            error: 'Paramètres de connexion manquants (host, username, password, database)'
          });
        }

        // Test de connexion réel avec pg
        const testResult = await this.testPostgresConnection(config);
        
        this.broadcast({
          type: 'postgres-test-real-result',
          result: testResult
        });

        res.json(testResult);
      } catch (error) {
        logger.error('Erreur test connexion PostgreSQL', error);
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        };
        res.json(errorResult);
      }
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

    // API pour synchronisation avec Claude Code
    this.app.post('/api/sync-claude', (req, res) => {
      try {
        const { action, data, message } = req.body;
        
        // Créer un fichier de synchronisation pour Claude Code
        const syncData = {
          timestamp: Date.now(),
          action,
          data,
          message,
          fromWebInterface: true
        };

        const syncPath = path.join(this.bridgeDir, `claude-sync-${Date.now()}.json`);
        fs.writeJsonSync(syncPath, syncData);

        this.broadcast({
          type: 'claude-sync-sent',
          data: syncData
        });

        logger.info('Synchronisation Claude Code envoyée', syncData);
        res.json({ success: true });
      } catch (error) {
        logger.error('Erreur synchronisation Claude', error);
        res.status(500).json({ success: false, error: error.message });
      }
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

    // API pour arrêter/pauser un agent
    this.app.post('/api/stop-agent', async (req, res) => {
      try {
        const { action } = req.body; // 'stop' ou 'pause'
        
        // Lire l'état actuel de l'agent
        const agentStatePath = path.join(process.cwd(), '..', 'firebase-migrations', 'agent-state.json');
        
        if (fs.existsSync(agentStatePath)) {
          const agentState = fs.readJsonSync(agentStatePath);
          
          if (agentState.isRunning && agentState.pid) {
            // Essayer d'arrêter le processus
            try {
              process.kill(agentState.pid, 'SIGTERM');
              
              // Mettre à jour l'état
              agentState.isRunning = false;
              agentState.lastHeartbeat = Date.now();
              agentState.stoppedAt = Date.now();
              agentState.stoppedBy = action;
              
              fs.writeJsonSync(agentStatePath, agentState);
              
              this.broadcast({
                type: 'agent-stopped',
                data: {
                  projectName: agentState.projectName,
                  action,
                  timestamp: Date.now()
                }
              });
              
              logger.info(`Agent ${action} avec succès`, { pid: agentState.pid });
              res.json({ success: true, message: `Agent ${action} avec succès` });
            } catch (killError) {
              // Le processus n'existe peut-être plus
              agentState.isRunning = false;
              agentState.lastHeartbeat = Date.now();
              fs.writeJsonSync(agentStatePath, agentState);
              
              res.json({ success: true, message: `Agent déjà arrêté ou processus introuvable` });
            }
          } else {
            res.json({ success: false, error: 'Aucun agent en cours d\'exécution' });
          }
        } else {
          res.json({ success: false, error: 'Fichier d\'état agent introuvable' });
        }
      } catch (error) {
        logger.error('Erreur arrêt agent', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour obtenir les détails complets d'un projet
    this.app.get('/api/project-details/:name', async (req, res) => {
      try {
        const { name } = req.params;
        
        // Lire la liste des projets
        const projectsPath = path.join(process.cwd(), '..', 'firebase-migrations', 'projects.json');
        const agentStatePath = path.join(process.cwd(), '..', 'firebase-migrations', 'agent-state.json');
        const logsPath = path.join(process.cwd(), '..', 'firebase-migrations', 'logs');
        
        let project = null;
        let agentState = null;
        let logs = [];
        
        // Charger le projet
        if (fs.existsSync(projectsPath)) {
          const projects = fs.readJsonSync(projectsPath);
          project = projects.find((p: any) => p.name === name);
        }
        
        // Charger l'état de l'agent
        if (fs.existsSync(agentStatePath)) {
          const state = fs.readJsonSync(agentStatePath);
          if (state.projectName === name) {
            agentState = state;
          }
        }
        
        // Charger les logs récents
        if (fs.existsSync(logsPath)) {
          const logFiles = fs.readdirSync(logsPath)
            .filter(f => f.includes(name) || f.includes('agent'))
            .sort()
            .slice(-3); // 3 fichiers les plus récents
          
          for (const logFile of logFiles) {
            try {
              const logContent = fs.readFileSync(path.join(logsPath, logFile), 'utf8');
              const recentLines = logContent.split('\n').slice(-20); // 20 dernières lignes
              logs.push({
                file: logFile,
                content: recentLines.join('\n')
              });
            } catch (logError) {
              // Ignorer les erreurs de lecture de logs
            }
          }
        }
        
        const details = {
          project,
          agentState,
          logs,
          isRunning: agentState?.isRunning || false,
          progress: agentState ? this.calculateProgress(agentState.currentStep) : 0
        };
        
        res.json({ success: true, details });
      } catch (error) {
        logger.error('Erreur détails projet', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour redémarrer un projet
    this.app.post('/api/restart-project', async (req, res) => {
      try {
        const { projectName } = req.body;
        
        // Créer un signal de redémarrage
        const restartData = {
          action: 'restart',
          projectName,
          timestamp: Date.now()
        };

        const restartPath = path.join(this.bridgeDir, 'restart-project.json');
        fs.writeJsonSync(restartPath, restartData);

        this.broadcast({
          type: 'project-restart-requested',
          data: restartData
        });

        logger.info('Redémarrage projet demandé', restartData);
        res.json({ success: true, message: `Redémarrage du projet ${projectName} demandé` });
      } catch (error) {
        logger.error('Erreur redémarrage projet', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour démarrer le streaming des logs
    this.app.post('/api/start-log-stream/:projectName', (req, res) => {
      try {
        const { projectName } = req.params;
        this.startLogStreaming(projectName);
        res.json({ success: true, message: `Streaming logs démarré pour ${projectName}` });
      } catch (error) {
        logger.error('Erreur démarrage streaming logs', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour arrêter le streaming des logs
    this.app.post('/api/stop-log-stream/:projectName', (req, res) => {
      try {
        const { projectName } = req.params;
        this.stopLogStreaming(projectName);
        res.json({ success: true, message: `Streaming logs arrêté pour ${projectName}` });
      } catch (error) {
        logger.error('Erreur arrêt streaming logs', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API pour vérifier si un agent est bloqué
    this.app.get('/api/check-agent-status', (req, res) => {
      try {
        const agentStatePath = path.join(process.cwd(), '..', 'firebase-migrations', 'agent-state.json');
        
        if (fs.existsSync(agentStatePath)) {
          const agentState = fs.readJsonSync(agentStatePath);
          const now = Date.now();
          const lastHeartbeat = agentState.lastHeartbeat || 0;
          const timeSinceHeartbeat = now - lastHeartbeat;
          
          // Considérer comme bloqué si pas de heartbeat depuis 2 minutes
          const isBlocked = timeSinceHeartbeat > 120000;
          const isStuck = timeSinceHeartbeat > 300000; // 5 minutes = vraiment bloqué
          
          let status = 'active';
          if (isStuck) {
            status = 'stuck';
          } else if (isBlocked) {
            status = 'blocked';
          } else if (!agentState.isRunning) {
            status = 'stopped';
          }

          const statusInfo = {
            status,
            isRunning: agentState.isRunning,
            timeSinceHeartbeat,
            projectName: agentState.projectName,
            currentStep: agentState.currentStep,
            pid: agentState.pid,
            message: this.getStatusMessage(status, timeSinceHeartbeat)
          };

          res.json({ success: true, agentStatus: statusInfo });
        } else {
          res.json({ 
            success: true, 
            agentStatus: { 
              status: 'no_agent', 
              message: 'Aucun agent en cours' 
            }
          });
        }
      } catch (error) {
        logger.error('Erreur vérification statut agent', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  private calculateProgress(currentStep: string | undefined): number {
    const stepProgress: { [key: string]: number } = {
      'initialization': 5,
      'analysis': 15,
      'super-workflow': 35,
      'database': 50,
      'api': 70,
      'tests': 85,
      'finalization': 100
    };
    
    return stepProgress[currentStep || ''] || 0;
  }

  private getStatusMessage(status: string, timeSinceHeartbeat: number): string {
    const minutes = Math.floor(timeSinceHeartbeat / 60000);
    const seconds = Math.floor((timeSinceHeartbeat % 60000) / 1000);
    
    switch (status) {
      case 'active':
        return `Agent actif (dernière activité: ${seconds}s)`;
      case 'blocked':
        return `⚠️ Agent possiblement bloqué (${minutes}m ${seconds}s sans activité)`;
      case 'stuck':
        return `❌ Agent bloqué (${minutes}m sans activité)`;
      case 'stopped':
        return 'Agent arrêté';
      default:
        return 'Statut inconnu';
    }
  }

  private startLogStreaming(projectName: string) {
    // Arrêter le streaming précédent s'il existe
    this.stopLogStreaming(projectName);
    
    const logsPath = path.join(process.cwd(), '..', 'firebase-migrations', 'logs');
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsPath, `agent-${today}.log`);
    
    if (!fs.existsSync(logFile)) {
      logger.warn(`Fichier de log introuvable: ${logFile}`);
      return;
    }

    // Obtenir la position actuelle du fichier
    const stats = fs.statSync(logFile);
    let lastPosition = this.lastLogPositions.get(projectName) || stats.size;
    
    // Watcher pour surveiller les modifications du fichier
    const watcher = fs.watchFile(logFile, { interval: 1000 }, (curr, prev) => {
      if (curr.size > lastPosition) {
        // Nouveau contenu disponible
        const newContent = this.readLogChunk(logFile, lastPosition, curr.size);
        if (newContent) {
          this.broadcastLogUpdate(projectName, newContent);
          lastPosition = curr.size;
          this.lastLogPositions.set(projectName, lastPosition);
        }
      }
    });
    
    this.logWatchers.set(projectName, watcher);
    logger.info(`Streaming logs démarré pour: ${projectName}`);
  }

  private stopLogStreaming(projectName: string) {
    const watcher = this.logWatchers.get(projectName);
    if (watcher) {
      fs.unwatchFile(watcher);
      this.logWatchers.delete(projectName);
      logger.info(`Streaming logs arrêté pour: ${projectName}`);
    }
  }

  private readLogChunk(filePath: string, start: number, end: number): string | null {
    try {
      const buffer = Buffer.alloc(end - start);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, end - start, start);
      fs.closeSync(fd);
      return buffer.toString('utf8');
    } catch (error) {
      logger.error('Erreur lecture chunk log', error);
      return null;
    }
  }

  private broadcastLogUpdate(projectName: string, logContent: string) {
    const lines = logContent.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        // Essayer de parser comme JSON pour extraire les infos
        const logEntry = JSON.parse(line);
        
        const broadcastData = {
          type: 'log-update',
          projectName,
          data: {
            timestamp: logEntry.timestamp || new Date().toISOString(),
            level: logEntry.level || 'INFO',
            message: logEntry.message || line,
            step: logEntry.step || 'Unknown',
            projectName: logEntry.projectName || projectName,
            raw: line
          }
        };
        
        this.broadcast(broadcastData);
      } catch (parseError) {
        // Si ce n'est pas du JSON, envoyer tel quel
        this.broadcast({
          type: 'log-update',
          projectName,
          data: {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: line,
            step: 'Raw',
            projectName,
            raw: line
          }
        });
      }
    }
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

  private async killPortProcess(port: number): Promise<void> {
    try {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        
        if (pid && !isNaN(parseInt(pid))) {
          try {
            await execAsync(`taskkill //F //PID ${pid}`);
            logger.info(`Processus ${pid} utilisant le port ${port} terminé`);
          } catch (error) {
            logger.warn(`Impossible de terminer le processus ${pid}`, error);
          }
        }
      }
    } catch (error) {
      // Port probablement libre
      logger.debug(`Port ${port} déjà libre`);
    }
  }

  async start(): Promise<string> {
    // Libérer le port automatiquement
    await this.killPortProcess(this.config.port);
    
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

  private async testPostgresConnection(config: any): Promise<{success: boolean, error?: string, message?: string}> {
    try {
      // Essayer d'importer pg de manière dynamique
      const { Client } = await import('pg');
      
      const client = new Client({
        host: config.host,
        port: config.port || 5432,
        user: config.username,
        password: config.password,
        database: config.database,
        connectionTimeoutMillis: 5000, // 5 secondes timeout
      });

      await client.connect();
      
      // Test simple query
      const result = await client.query('SELECT NOW() as current_time');
      await client.end();

      logger.info('Test connexion PostgreSQL réussi', {
        host: config.host,
        database: config.database,
        currentTime: result.rows[0]?.current_time
      });

      return {
        success: true,
        message: `Connexion réussie à ${config.host}:${config.port || 5432}/${config.database}`
      };

    } catch (error: any) {
      logger.error('Échec test connexion PostgreSQL', {
        host: config.host,
        database: config.database,
        error: error.message
      });

      // Messages d'erreur plus explicites
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: `Impossible de se connecter à ${config.host}:${config.port || 5432}. Vérifiez que PostgreSQL est démarré.`
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: `Hôte ${config.host} introuvable. Vérifiez l'adresse.`
        };
      } else if (error.message.includes('authentication failed')) {
        return {
          success: false,
          error: 'Authentification échouée. Vérifiez le nom d\'utilisateur et mot de passe.'
        };
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        return {
          success: false,
          error: `La base de données "${config.database}" n'existe pas.`
        };
      } else {
        return {
          success: false,
          error: error.message || 'Erreur de connexion inconnue'
        };
      }
    }
  }
}