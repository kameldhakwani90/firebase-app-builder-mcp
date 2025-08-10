/**
 * 🎭 PRIXIGRAD.IO - Commande Status
 * 
 * Affichage du statut complet du système
 */

const SystemChecker = require('../../core/system-checker');
const ConfigManager = require('../../core/config');
const MCPInstaller = require('../../core/mcp-installer');
const Logger = require('../../core/logger');

class StatusCommand {
  constructor() {
    this.logger = new Logger('Status');
    this.systemChecker = new SystemChecker();
    this.configManager = new ConfigManager();
    this.mcpInstaller = new MCPInstaller();
  }

  async execute(options = {}) {
    try {
      this.logger.banner('STATUT PRIXIGRAD.IO AGENT');

      if (options.all) {
        await this.showCompleteStatus();
      } else {
        await this.showQuickStatus();
      }

    } catch (error) {
      this.logger.error('❌ Erreur lors de la vérification du statut', error);
      
      if (options.verbose) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Statut rapide
   */
  async showQuickStatus() {
    console.log('🔍 Vérification rapide du système...\n');

    // Test des composants critiques
    const results = await Promise.allSettled([
      this.checkNodeJS(),
      this.checkClaudeCode(),
      this.checkPostgreSQL(),
      this.checkConfiguration(),
      this.checkMCPAgents()
    ]);

    // Affichage des résultats
    const components = [
      'Node.js',
      'Claude Code', 
      'PostgreSQL',
      'Configuration',
      'Agents MCP'
    ];

    let globalScore = 0;
    results.forEach((result, index) => {
      const status = result.status === 'fulfilled' && result.value.success;
      const icon = status ? '✅' : '❌';
      const message = status ? 'OK' : (result.value?.message || result.reason?.message || 'Erreur');
      
      console.log(`${icon} ${components[index]}: ${message}`);
      
      if (status) globalScore += 20;
    });

    // Score global
    this.logger.separator();
    console.log(`📊 Score global: ${globalScore}%`);
    
    if (globalScore === 100) {
      this.logger.success('🎉 Système entièrement fonctionnel !');
    } else if (globalScore >= 80) {
      this.logger.warn('⚠️ Système partiellement fonctionnel');
    } else {
      this.logger.error('❌ Système non fonctionnel');
    }

    console.log('\n💡 Utilisez --all pour un diagnostic complet');
  }

  /**
   * Statut complet
   */
  async showCompleteStatus() {
    // Vérification système complète
    const systemStatus = await this.systemChecker.checkAll();
    
    // Statut des agents MCP
    const mcpStatus = await this.mcpInstaller.getAgentsStatus();
    
    // Configuration
    const config = this.configManager.load();
    const configValidation = this.configManager.validate(config);

    // Statistiques d'utilisation
    const stats = await this.getUsageStats();

    // Affichage détaillé
    this.displayDetailedStatus(systemStatus, mcpStatus, configValidation, stats);
  }

  /**
   * Vérifications individuelles
   */
  async checkNodeJS() {
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        return { success: true, message: nodeVersion };
      } else {
        return { success: false, message: `${nodeVersion} (requis: >= 18.0.0)` };
      }
    } catch (error) {
      return { success: false, message: 'Non installé' };
    }
  }

  async checkClaudeCode() {
    try {
      const { execSync } = require('child_process');
      const version = execSync('claude --version', { encoding: 'utf8', timeout: 5000 }).trim();
      return { success: true, message: version };
    } catch (error) {
      return { success: false, message: 'Non accessible' };
    }
  }

  async checkPostgreSQL() {
    try {
      const { execSync } = require('child_process');
      
      // Test version
      const version = execSync('psql --version', { encoding: 'utf8', timeout: 5000 }).trim();
      
      // Test connexion
      try {
        execSync('pg_isready', { encoding: 'utf8', timeout: 3000 });
        return { success: true, message: `${version} (Actif)` };
      } catch (connectionError) {
        return { success: false, message: `${version} (Inactif)` };
      }
    } catch (error) {
      return { success: false, message: 'Non installé' };
    }
  }

  async checkConfiguration() {
    try {
      const config = this.configManager.load();
      const validation = this.configManager.validate(config);
      
      if (validation.valid) {
        return { success: true, message: `Valide (v${config.version})` };
      } else {
        return { success: false, message: `Invalide (${validation.errors.length} erreurs)` };
      }
    } catch (error) {
      return { success: false, message: 'Corrompue' };
    }
  }

  async checkMCPAgents() {
    try {
      const status = await this.mcpInstaller.getAgentsStatus();
      const installed = Object.values(status).filter(s => s.installed).length;
      const total = Object.keys(status).length;
      
      if (installed === total) {
        return { success: true, message: `${installed}/${total} installés` };
      } else {
        return { success: false, message: `${installed}/${total} installés` };
      }
    } catch (error) {
      return { success: false, message: 'Erreur vérification' };
    }
  }

  /**
   * Statistiques d'utilisation
   */
  async getUsageStats() {
    try {
      const os = require('os');
      const fs = require('fs');
      const path = require('path');

      const logFile = path.join(os.homedir(), '.prixigrad', 'logs', 'agent.log');
      
      let logStats = {
        size: 0,
        lines: 0,
        lastModified: null
      };

      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        const content = fs.readFileSync(logFile, 'utf8');
        
        logStats = {
          size: Math.round(stats.size / 1024), // KB
          lines: content.split('\n').length,
          lastModified: stats.mtime
        };
      }

      return {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: `${os.type()} ${os.release()}`,
        node: process.version,
        logs: logStats
      };

    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Affichage détaillé du statut
   */
  displayDetailedStatus(systemStatus, mcpStatus, configValidation, stats) {
    // En-tête
    console.log(`📊 Score système: ${systemStatus.globalScore}%`);
    console.log(`⏱️  Uptime: ${Math.round(stats.uptime)}s`);
    console.log(`💾 Mémoire: ${Math.round(stats.memory.rss / 1024 / 1024)}MB`);
    console.log(`🖥️  Plateforme: ${stats.platform}`);
    
    this.logger.separator();

    // Détail système
    console.log('🔧 COMPOSANTS SYSTÈME:');
    Object.entries(systemStatus).forEach(([key, result]) => {
      if (key === 'globalScore' || key === 'allGood') return;
      
      const icon = result.status === 'ok' ? '✅' : 
                  result.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`   ${icon} ${key.toUpperCase()}: ${result.message}`);
      
      if (result.version) {
        console.log(`      Version: ${result.version}`);
      }
      
      if (result.solution) {
        console.log(`      Solution: ${result.solution}`);
      }
    });

    this.logger.separator();

    // Agents MCP
    console.log('🤖 AGENTS MCP:');
    Object.entries(mcpStatus).forEach(([name, status]) => {
      const icon = status.installed ? '✅' : '❌';
      const version = status.version ? ` (v${status.version})` : '';
      
      console.log(`   ${icon} ${name}${version}`);
      console.log(`      ${status.description}`);
      
      if (!status.installed && status.error) {
        console.log(`      Erreur: ${status.error}`);
      }
    });

    this.logger.separator();

    // Configuration
    console.log('⚙️ CONFIGURATION:');
    if (configValidation.valid) {
      console.log('   ✅ Configuration valide');
    } else {
      console.log('   ❌ Configuration invalide:');
      configValidation.errors.forEach(error => {
        console.log(`      • ${error}`);
      });
    }

    this.logger.separator();

    // Logs
    console.log('📝 LOGS:');
    if (stats.logs.size > 0) {
      console.log(`   📄 Taille: ${stats.logs.size}KB`);
      console.log(`   📏 Lignes: ${stats.logs.lines}`);
      console.log(`   🕒 Modifié: ${stats.logs.lastModified?.toLocaleString()}`);
    } else {
      console.log('   📄 Aucun log trouvé');
    }

    this.logger.separator();

    // Recommandations
    this.showRecommendations(systemStatus, mcpStatus, configValidation);
  }

  /**
   * Recommandations d'amélioration
   */
  showRecommendations(systemStatus, mcpStatus, configValidation) {
    const recommendations = [];

    // Recommandations système
    if (systemStatus.globalScore < 100) {
      Object.entries(systemStatus).forEach(([key, result]) => {
        if (result.status === 'error' && result.solution) {
          recommendations.push(`🔧 ${key}: ${result.solution}`);
        }
      });
    }

    // Recommandations MCP
    const missingAgents = Object.entries(mcpStatus)
      .filter(([_, status]) => !status.installed)
      .map(([name, _]) => name);
    
    if (missingAgents.length > 0) {
      recommendations.push(`🤖 Installer agents MCP: prixigrad init`);
    }

    // Recommandations configuration
    if (!configValidation.valid) {
      recommendations.push(`⚙️ Corriger configuration: prixigrad config`);
    }

    // Affichage
    if (recommendations.length > 0) {
      console.log('💡 RECOMMANDATIONS:');
      recommendations.forEach(rec => console.log(`   ${rec}`));
    } else {
      console.log('🎉 AUCUNE RECOMMANDATION - Système optimal !');
    }

    console.log('\n📖 Aide: prixigrad --help');
  }
}

// Export de la fonction principale pour Commander.js
module.exports = async function statusCommand(options) {
  const command = new StatusCommand();
  await command.execute(options);
};