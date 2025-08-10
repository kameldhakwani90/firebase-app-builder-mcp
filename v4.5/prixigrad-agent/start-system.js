#!/usr/bin/env node

/**
 * Script de démarrage simple et robuste pour PRIXIGRAD.IO
 */

const BridgeServer = require('./lib/core/bridge-server');
const { spawn } = require('child_process');
const path = require('path');
const Logger = require('./lib/core/logger');

class PrixigradStarter {
  constructor() {
    this.logger = new Logger('PrixigradStart');
    this.bridgeServer = null;
    this.webProcess = null;
  }

  async start() {
    try {
      this.logger.banner('DÉMARRAGE PRIXIGRAD.IO SYSTÈME');
      
      // Étape 1: Vérifications rapides
      await this.quickChecks();
      
      // Étape 2: Démarrer BridgeServer
      await this.startBridgeServer();
      
      // Étape 3: Démarrer Interface Web
      await this.startWebInterface();
      
      // Étape 4: Afficher le résumé
      this.showSummary();
      
      // Étape 5: Gestion arrêt propre
      this.setupShutdown();
      
    } catch (error) {
      this.logger.error('❌ Erreur démarrage:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  async quickChecks() {
    this.logger.info('🔍 Vérifications rapides...');
    
    // Vérifier Node.js
    const nodeVersion = process.version;
    if (parseInt(nodeVersion.slice(1)) < 16) {
      throw new Error(`Node.js >= 16 requis (actuel: ${nodeVersion})`);
    }
    this.logger.success(`✅ Node.js ${nodeVersion}`);
    
    // Vérifier Claude Code OBLIGATOIRE
    try {
      const { execSync } = require('child_process');
      execSync('which claude', { stdio: 'ignore' });
      this.logger.success('✅ Claude Code disponible');
    } catch (error) {
      throw new Error('❌ Claude Code requis pour PRIXIGRAD.IO. Installez-le depuis https://claude.ai/code');
    }
    
    // Vérifier ports disponibles
    const portsToCheck = [3001, 3002];
    for (const port of portsToCheck) {
      const isUsed = await this.isPortInUse(port);
      if (isUsed) {
        this.logger.warn(`⚠️ Port ${port} occupé, tentative de libération...`);
        try {
          require('child_process').execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          // Ignore
        }
      }
    }
    
    this.logger.success('✅ Vérifications terminées');
  }

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

  async startBridgeServer() {
    this.logger.info('🌉 Démarrage BridgeServer...');
    
    this.bridgeServer = new BridgeServer();
    await this.bridgeServer.start(3002);
    
    // Attendre 2 secondes pour s'assurer que le serveur est prêt
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.logger.success('✅ BridgeServer actif sur port 3002');
  }

  async startWebInterface() {
    this.logger.info('🌐 Démarrage Interface Web...');
    
    const webPath = path.join(__dirname, 'lib/web');
    
    // Vérifier que le build existe
    const buildPath = path.join(webPath, '.next');
    if (!require('fs').existsSync(buildPath)) {
      this.logger.info('📦 Build manquant, construction en cours...');
      await this.buildWebInterface(webPath);
    }
    
    return new Promise((resolve, reject) => {
      this.webProcess = spawn('npm', ['run', 'dev'], {
        cwd: webPath,
        env: {
          ...process.env,
          PORT: '3001',
          AGENT_API_URL: 'http://localhost:3002',
          NODE_ENV: 'development'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          started = true;
          reject(new Error('Timeout démarrage interface web'));
        }
      }, 30000);

      this.webProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        if ((output.includes('ready') || output.includes('started') || output.includes('localhost:3001')) && !started) {
          started = true;
          clearTimeout(timeout);
          this.logger.success('✅ Interface Web active sur port 3001');
          resolve();
        }
        
        if (process.env.DEBUG) {
          console.log('[WEB]', output.trim());
        }
      });

      this.webProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('warn') && !error.includes('deprecated')) {
          this.logger.debug('[WEB ERROR]', error.trim());
        }
      });

      this.webProcess.on('error', (error) => {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  async buildWebInterface(webPath) {
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: webPath,
        stdio: 'inherit'
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          this.logger.success('✅ Build interface terminé');
          resolve();
        } else {
          reject(new Error(`Build échoué avec le code ${code}`));
        }
      });
    });
  }

  showSummary() {
    this.logger.separator();
    console.log(`
🎉 PRIXIGRAD.IO SYSTÈME OPÉRATIONNEL !

🌐 Interface Web:    http://localhost:3001
🌉 Bridge API:       http://localhost:3002
🎭 Agents MCP:       Installés (filesystem, postgres, prisma, sequential-thinking)

🧪 COMMENT TESTER:
1. Ouvrir http://localhost:3001 dans votre navigateur
2. Entrer l'URL: https://github.com/kameldhakwani90/kalliky
3. Cliquer sur "Analyser"
4. Observer l'analyse MCP en temps réel dans les logs

⚡ CONTRÔLES:
• Ctrl+C           Arrêt propre du système
• DEBUG=1          Mode debug pour plus de logs
• PORT=xxxx        Changer le port web (défaut: 3001)

📝 Status: Système prêt à analyser et transformer des projets Firebase !
`);
    this.logger.separator();
    this.logger.info('🚀 Système en cours d\'exécution... (Ctrl+C pour arrêter)');
  }

  setupShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`\n🛑 Signal ${signal} reçu, arrêt du système...`);
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    process.on('uncaughtException', async (error) => {
      this.logger.error('Exception non capturée:', error);
      await this.cleanup();
      process.exit(1);
    });
  }

  async cleanup() {
    this.logger.info('🧹 Arrêt en cours...');
    
    if (this.webProcess && !this.webProcess.killed) {
      this.webProcess.kill('SIGTERM');
    }
    
    if (this.bridgeServer) {
      await this.bridgeServer.stop();
    }
    
    this.logger.success('✅ Système arrêté proprement');
  }
}

// Lancement
if (require.main === module) {
  const starter = new PrixigradStarter();
  starter.start().catch(console.error);
}

module.exports = PrixigradStarter;