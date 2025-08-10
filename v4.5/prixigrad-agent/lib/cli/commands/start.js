/**
 * 🎭 PRIXIGRAD.IO - Commande Start
 * 
 * Démarrage de l'interface web et du bridge server
 */

const { spawn } = require('child_process');
const path = require('path');
const open = require('open');
const SystemChecker = require('../../core/system-checker');
const BridgeServer = require('../../core/bridge-server');
const ConfigManager = require('../../core/config');
const Logger = require('../../core/logger');

class StartCommand {
  constructor() {
    this.logger = new Logger('Start');
    this.systemChecker = new SystemChecker();
    this.configManager = new ConfigManager();
    this.bridgeServer = new BridgeServer();
    this.webProcess = null;
  }

  async execute(options = {}) {
    try {
      this.logger.banner('DÉMARRAGE PRIXIGRAD.IO AGENT');

      // Chargement de la configuration
      const config = this.configManager.load();
      const webPort = options.port || config.web.port || 3001;
      const bridgePort = options.bridgePort || config.web.bridgePort || 3002;

      // Étape 1: Vérifications préliminaires
      this.logger.info('🔍 Vérifications préliminaires...');
      await this.runPreflightChecks();

      // Étape 2: Démarrage du Bridge Server
      this.logger.info('🌉 Démarrage Bridge Server...');
      const bridgeInfo = await this.startBridgeServer(bridgePort);

      // Étape 3: Démarrage de l'interface web
      this.logger.info('🌐 Démarrage Interface Web...');
      const webInfo = await this.startWebInterface(webPort, bridgePort, options);

      // Étape 4: Ouverture automatique du navigateur
      if (config.web.autoOpen && !options.noBrowser) {
        this.logger.info('🌍 Ouverture du navigateur...');
        await this.openBrowser(webInfo.url);
      }

      // Affichage du résumé
      this.showStartupSummary(webInfo, bridgeInfo);

      // Gestion propre de l'arrêt
      this.setupGracefulShutdown();

      // Maintien du processus en vie
      await this.keepAlive();

    } catch (error) {
      this.logger.error('❌ Erreur lors du démarrage', error);
      
      if (options.verbose) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
      
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Vérifications préliminaires
   */
  async runPreflightChecks() {
    // Vérification rapide des composants critiques
    const checks = await this.systemChecker.checkAll();
    
    if (checks.globalScore < 70) {
      this.logger.warn('⚠️ Score système faible, certaines fonctionnalités peuvent ne pas marcher');
    }
    
    // Claude Code OBLIGATOIRE pour PRIXIGRAD.IO
    if (!checks.claudeCode || checks.claudeCode.status !== 'ok') {
      throw new Error('Claude Code requis pour PRIXIGRAD.IO. Installez-le depuis https://claude.ai/code');
    }

    // Vérification des ports
    await this.checkPorts();
  }

  /**
   * Vérification de la disponibilité des ports
   */
  async checkPorts() {
    const config = this.configManager.load();
    const requiredPorts = [
      config.web.port || 3001,
      config.web.bridgePort || 3002
    ];

    for (const port of requiredPorts) {
      if (await this.isPortInUse(port)) {
        throw new Error(`Port ${port} déjà utilisé. Arrêtez le service ou changez le port.`);
      }
    }
  }

  /**
   * Test si un port est utilisé
   */
  async isPortInUse(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => resolve(false));
        server.close();
      });
      
      server.on('error', () => resolve(true));
    });
  }

  /**
   * Démarrage du Bridge Server
   */
  async startBridgeServer(port) {
    try {
      const bridgeInfo = await this.bridgeServer.start(port);
      
      this.logger.success(`✅ Bridge Server: ${bridgeInfo.url}`);
      
      return bridgeInfo;
    } catch (error) {
      throw new Error(`Impossible de démarrer le Bridge Server: ${error.message}`);
    }
  }

  /**
   * Démarrage de l'interface web Next.js
   */
  async startWebInterface(webPort, bridgePort, options = {}) {
    return new Promise((resolve, reject) => {
      const webPath = path.join(__dirname, '../../web');
      
      // Vérifier si l'interface web existe
      if (!require('fs').existsSync(webPath)) {
        return reject(new Error('Interface web non trouvée. Exécutez d\'abord la Phase 3.'));
      }

      // Variables d'environnement pour l'interface web
      const env = {
        ...process.env,
        PORT: webPort.toString(),
        BRIDGE_URL: `http://localhost:${bridgePort}`,
        NODE_ENV: process.env.NODE_ENV || 'production'
      };

      // Commande de démarrage selon l'environnement et options
      const isDev = options.dev || process.env.NODE_ENV === 'development';
      const command = isDev ? 'dev' : 'start';

      this.logger.debug(`Démarrage interface web: npm run ${command}`, { webPath, env: { PORT: webPort } });

      // Spawn du processus Next.js
      this.webProcess = spawn('npm', ['run', command], {
        cwd: webPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let startupComplete = false;
      let startupTimeout;

      // Gestion de la sortie
      this.webProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        // Détection du démarrage réussi
        if (output.includes('ready') || output.includes('started') || output.includes(`localhost:${webPort}`)) {
          if (!startupComplete) {
            startupComplete = true;
            clearTimeout(startupTimeout);
            
            this.logger.success(`✅ Interface Web: http://localhost:${webPort}`);
            
            resolve({
              port: webPort,
              url: `http://localhost:${webPort}`,
              process: this.webProcess
            });
          }
        }

        // Log en mode verbose
        if (process.env.PRIXIGRAD_DEBUG === 'true') {
          console.log('[WEB]', output.trim());
        }
      });

      this.webProcess.stderr.on('data', (data) => {
        const error = data.toString();
        
        // Ignorer certains warnings Next.js non critiques
        if (!error.includes('warn') && !error.includes('deprecated')) {
          this.logger.error('Erreur interface web:', error.trim());
        }
      });

      this.webProcess.on('error', (error) => {
        if (!startupComplete) {
          startupComplete = true;
          clearTimeout(startupTimeout);
          reject(new Error(`Erreur démarrage interface web: ${error.message}`));
        }
      });

      this.webProcess.on('close', (code) => {
        this.logger.warn(`Interface web fermée (code: ${code})`);
        
        if (!startupComplete && code !== 0) {
          startupComplete = true;
          clearTimeout(startupTimeout);
          reject(new Error(`Interface web fermée avec le code ${code}`));
        }
      });

      // Timeout de sécurité
      startupTimeout = setTimeout(() => {
        if (!startupComplete) {
          startupComplete = true;
          reject(new Error('Timeout démarrage interface web (30s)'));
        }
      }, 30000);
    });
  }

  /**
   * Ouverture du navigateur
   */
  async openBrowser(url) {
    try {
      await open(url);
      this.logger.success('🌍 Navigateur ouvert');
    } catch (error) {
      this.logger.warn('Impossible d\'ouvrir le navigateur automatiquement');
      this.logger.info(`Ouvrez manuellement: ${url}`);
    }
  }

  /**
   * Affichage du résumé de démarrage
   */
  showStartupSummary(webInfo, bridgeInfo) {
    this.logger.separator();
    console.log(`
🎉 PRIXIGRAD.IO Agent démarré avec succès !

🌐 Interface Web:     ${webInfo.url}
🌉 Bridge Server:     ${bridgeInfo.url}
📝 Logs:             ~/.prixigrad/logs/agent.log

🎯 UTILISATION:
• Ouvrez l'interface web pour transformer des applications
• L'interface communique automatiquement avec Claude Code
• Tous les logs sont sauvegardés pour le débogage

⚡ RACCOURCIS:
• Ctrl+C          Arrêt propre
• prixigrad logs   Voir les logs
• prixigrad status Vérifier le système
`);
    this.logger.separator();
    
    this.logger.info('🚀 Agent en cours d\'exécution... (Ctrl+C pour arrêter)');
  }

  /**
   * Configuration de l'arrêt propre
   */
  setupGracefulShutdown() {
    const shutdownHandler = async (signal) => {
      this.logger.info(`\n🛑 Signal ${signal} reçu, arrêt en cours...`);
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    
    // Gestion des erreurs non capturées
    process.on('uncaughtException', async (error) => {
      this.logger.error('Exception non capturée', error);
      await this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      this.logger.error('Promesse rejetée non gérée', reason);
      await this.cleanup();
      process.exit(1);
    });
  }

  /**
   * Nettoyage des ressources
   */
  async cleanup() {
    this.logger.info('🧹 Nettoyage des ressources...');

    // Arrêt du processus web
    if (this.webProcess && !this.webProcess.killed) {
      try {
        this.webProcess.kill('SIGTERM');
        this.logger.debug('Processus web arrêté');
      } catch (error) {
        this.logger.error('Erreur arrêt processus web', error);
      }
    }

    // Arrêt du bridge server
    try {
      await this.bridgeServer.stop();
    } catch (error) {
      this.logger.error('Erreur arrêt bridge server', error);
    }

    this.logger.success('✅ Nettoyage terminé');
  }

  /**
   * Maintien du processus en vie
   */
  async keepAlive() {
    return new Promise((resolve) => {
      // Le processus reste en vie jusqu'à réception d'un signal d'arrêt
      // La résolution se fait dans setupGracefulShutdown()
    });
  }
}

// Export de la fonction principale pour Commander.js
module.exports = async function startCommand(options) {
  const command = new StartCommand();
  await command.execute(options);
};