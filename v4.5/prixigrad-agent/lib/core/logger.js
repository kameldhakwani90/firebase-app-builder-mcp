/**
 * 🎭 PRIXIGRAD.IO - Logger System
 * 
 * Système de logging centralisé pour toutes les opérations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class Logger {
  constructor(module = 'PRIXIGRAD') {
    this.module = module;
    this.logDir = path.join(os.homedir(), '.prixigrad', 'logs');
    this.logFile = path.join(this.logDir, 'agent.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      // Fallback silencieux si impossible de créer le dossier
    }
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.module}]`;
    
    let logMessage = `${prefix} ${message}`;
    if (data) {
      logMessage += ` ${JSON.stringify(data)}`;
    }
    
    return logMessage;
  }

  writeToFile(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      // Fallback silencieux si impossible d'écrire
    }
  }

  info(message, data = null) {
    const logMessage = this.formatMessage('INFO', message, data);
    console.log(`ℹ️  ${message}`);
    this.writeToFile(logMessage);
  }

  success(message, data = null) {
    const logMessage = this.formatMessage('SUCCESS', message, data);
    console.log(`✅ ${message}`);
    this.writeToFile(logMessage);
  }

  warn(message, data = null) {
    const logMessage = this.formatMessage('WARN', message, data);
    console.warn(`⚠️  ${message}`);
    this.writeToFile(logMessage);
  }

  error(message, error = null, data = null) {
    const errorData = error ? { 
      message: error.message, 
      stack: error.stack,
      ...data 
    } : data;
    
    const logMessage = this.formatMessage('ERROR', message, errorData);
    console.error(`❌ ${message}`);
    this.writeToFile(logMessage);
  }

  debug(message, data = null) {
    if (process.env.PRIXIGRAD_DEBUG === 'true') {
      const logMessage = this.formatMessage('DEBUG', message, data);
      console.log(`🔍 ${message}`);
      this.writeToFile(logMessage);
    }
  }

  separator() {
    const separator = '━'.repeat(60);
    console.log(separator);
    this.writeToFile(separator);
  }

  banner(text) {
    const banner = `
╔══════════════════════════════════════════════════════════╗
║  ${text.padEnd(56)}  ║
╚══════════════════════════════════════════════════════════╝`;
    
    console.log(banner);
    this.writeToFile(banner);
  }

  // Méthode pour nettoyer les anciens logs
  cleanOldLogs(daysToKeep = 7) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          this.info(`Ancien log supprimé: ${file}`);
        }
      });
    } catch (error) {
      this.warn('Impossible de nettoyer les anciens logs', { error: error.message });
    }
  }
}

module.exports = Logger;