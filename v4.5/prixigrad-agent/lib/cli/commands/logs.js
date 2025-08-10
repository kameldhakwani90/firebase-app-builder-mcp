/**
 * 🎭 PRIXIGRAD.IO - Commande Logs
 * 
 * Affichage et gestion des logs système
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const Logger = require('../../core/logger');

class LogsCommand {
  constructor() {
    this.logger = new Logger('Logs');
    this.logDir = path.join(os.homedir(), '.prixigrad', 'logs');
    this.logFile = path.join(this.logDir, 'agent.log');
  }

  async execute(options = {}) {
    try {
      if (options.follow) {
        await this.followLogs(options);
      } else {
        await this.showLogs(options);
      }

    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'affichage des logs', error);
      
      if (options.verbose) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Affichage des logs statiques
   */
  async showLogs(options) {
    const lines = parseInt(options.lines) || 50;

    if (!fs.existsSync(this.logFile)) {
      console.log('📝 Aucun log trouvé');
      console.log(`💡 Les logs seront créés dans: ${this.logFile}`);
      return;
    }

    try {
      // Lecture du fichier de log
      const content = fs.readFileSync(this.logFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());

      if (allLines.length === 0) {
        console.log('📝 Fichier de log vide');
        return;
      }

      // Sélection des dernières lignes
      const recentLines = allLines.slice(-lines);

      // En-tête
      console.log(`📝 Logs PRIXIGRAD.IO (${recentLines.length}/${allLines.length} lignes)`);
      console.log(`📁 Fichier: ${this.logFile}`);
      console.log('━'.repeat(80));

      // Affichage avec coloration
      recentLines.forEach(line => {
        this.displayLogLine(line);
      });

      console.log('━'.repeat(80));
      console.log(`💡 Utilisez --follow pour suivre en temps réel`);
      console.log(`💡 Utilisez --lines <nombre> pour ajuster le nombre de lignes`);

    } catch (error) {
      throw new Error(`Impossible de lire le fichier de log: ${error.message}`);
    }
  }

  /**
   * Suivi des logs en temps réel
   */
  async followLogs(options) {
    const lines = parseInt(options.lines) || 50;

    console.log('📝 Suivi des logs en temps réel (Ctrl+C pour arrêter)...');
    console.log(`📁 Fichier: ${this.logFile}`);
    console.log('━'.repeat(80));

    if (!fs.existsSync(this.logFile)) {
      console.log('⏳ En attente de la création du fichier de log...');
      
      // Attendre que le fichier soit créé
      await this.waitForLogFile();
    }

    // Afficher les dernières lignes d'abord
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      const recentLines = allLines.slice(-Math.min(lines, 10)); // Moins de lignes pour le follow

      recentLines.forEach(line => {
        this.displayLogLine(line);
      });
      
      if (recentLines.length > 0) {
        console.log('━'.repeat(40) + ' [SUIVI TEMPS RÉEL] ' + '━'.repeat(40));
      }
    } catch (error) {
      // Ignorer l'erreur, continuer avec le suivi
    }

    // Utiliser tail -f pour le suivi en temps réel
    return new Promise((resolve, reject) => {
      const tailProcess = spawn('tail', ['-f', this.logFile], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      tailProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          this.displayLogLine(line);
        });
      });

      tailProcess.stderr.on('data', (data) => {
        console.error(`Erreur tail: ${data}`);
      });

      tailProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          // tail non disponible, utiliser le fallback Node.js
          this.fallbackFollow();
          resolve();
        } else {
          reject(error);
        }
      });

      // Gestion propre de l'arrêt
      process.on('SIGINT', () => {
        console.log('\n\n🛑 Arrêt du suivi des logs');
        tailProcess.kill();
        resolve();
      });
    });
  }

  /**
   * Suivi fallback en Node.js pur
   */
  fallbackFollow() {
    let lastSize = 0;

    const checkForChanges = () => {
      try {
        if (!fs.existsSync(this.logFile)) {
          setTimeout(checkForChanges, 1000);
          return;
        }

        const stats = fs.statSync(this.logFile);
        
        if (stats.size > lastSize) {
          const stream = fs.createReadStream(this.logFile, {
            start: lastSize,
            end: stats.size
          });

          stream.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
              this.displayLogLine(line);
            });
          });

          lastSize = stats.size;
        }

        setTimeout(checkForChanges, 1000);
      } catch (error) {
        console.error('Erreur suivi fallback:', error.message);
        setTimeout(checkForChanges, 5000);
      }
    };

    // Initialiser la taille
    try {
      if (fs.existsSync(this.logFile)) {
        lastSize = fs.statSync(this.logFile).size;
      }
    } catch (error) {
      // Ignorer
    }

    checkForChanges();
  }

  /**
   * Attendre la création du fichier de log
   */
  async waitForLogFile(timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkFile = () => {
        if (fs.existsSync(this.logFile)) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout: fichier de log non créé'));
        } else {
          setTimeout(checkFile, 1000);
        }
      };

      checkFile();
    });
  }

  /**
   * Affichage d'une ligne de log avec coloration
   */
  displayLogLine(line) {
    if (!line.trim()) return;

    // Détection du niveau de log
    const level = this.extractLogLevel(line);
    
    switch (level) {
      case 'ERROR':
        console.log(`❌ ${line}`);
        break;
      case 'WARN':
        console.log(`⚠️  ${line}`);
        break;
      case 'SUCCESS':
        console.log(`✅ ${line}`);
        break;
      case 'INFO':
        console.log(`ℹ️  ${line}`);
        break;
      case 'DEBUG':
        console.log(`🔍 ${line}`);
        break;
      default:
        console.log(`📝 ${line}`);
    }
  }

  /**
   * Extraction du niveau de log d'une ligne
   */
  extractLogLevel(line) {
    const levelMatch = line.match(/\[(\w+)\]/);
    return levelMatch ? levelMatch[1] : null;
  }

  /**
   * Statistiques des logs
   */
  async getLogStats() {
    if (!fs.existsSync(this.logFile)) {
      return null;
    }

    try {
      const stats = fs.statSync(this.logFile);
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      // Comptage par niveau
      const levelCounts = {
        ERROR: 0,
        WARN: 0,
        SUCCESS: 0,
        INFO: 0,
        DEBUG: 0,
        OTHER: 0
      };

      lines.forEach(line => {
        const level = this.extractLogLevel(line);
        if (level && levelCounts.hasOwnProperty(level)) {
          levelCounts[level]++;
        } else {
          levelCounts.OTHER++;
        }
      });

      return {
        file: this.logFile,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        lines: lines.length,
        lastModified: stats.mtime,
        levels: levelCounts
      };

    } catch (error) {
      throw new Error(`Erreur lecture statistiques: ${error.message}`);
    }
  }

  /**
   * Nettoyage des anciens logs
   */
  async cleanOldLogs(daysToKeep = 7) {
    try {
      if (!fs.existsSync(this.logDir)) {
        return { cleaned: 0, message: 'Répertoire de logs inexistant' };
      }

      const files = fs.readdirSync(this.logDir);
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime && file !== 'agent.log') {
          fs.unlinkSync(filePath);
          cleanedCount++;
          this.logger.info(`Log supprimé: ${file}`);
        }
      }

      return {
        cleaned: cleanedCount,
        message: `${cleanedCount} anciens logs supprimés`
      };

    } catch (error) {
      throw new Error(`Erreur nettoyage logs: ${error.message}`);
    }
  }
}

// Export de la fonction principale pour Commander.js
module.exports = async function logsCommand(options) {
  const command = new LogsCommand();
  await command.execute(options);
};