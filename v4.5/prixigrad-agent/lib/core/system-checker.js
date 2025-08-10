/**
 * 🎭 PRIXIGRAD.IO - System Checker
 * 
 * Vérification complète des prérequis système
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const semver = require('semver');
const Logger = require('./logger');

class SystemChecker {
  constructor() {
    this.logger = new Logger('SystemChecker');
    this.configDir = path.join(os.homedir(), '.prixigrad');
    this.configFile = path.join(this.configDir, 'config.json');
  }

  /**
   * Vérification complète de tous les prérequis
   */
  async checkAll() {
    this.logger.banner('VÉRIFICATION SYSTÈME PRIXIGRAD.IO');
    
    const results = {
      nodejs: await this.checkNodeJS(),
      npm: await this.checkNPM(),
      git: await this.checkGit(),
      claudeCode: await this.checkClaudeCode(),
      postgres: await this.checkPostgreSQL(),
      mcpAgents: await this.checkMCPAgents(),
      config: await this.checkConfiguration()
    };

    // Calcul du score global
    const totalChecks = Object.keys(results).length;
    const passedChecks = Object.values(results).filter(r => r.status === 'ok').length;
    results.globalScore = Math.round((passedChecks / totalChecks) * 100);
    results.allGood = results.globalScore === 100;

    this.displayResults(results);
    return results;
  }

  /**
   * Vérification Node.js
   */
  async checkNodeJS() {
    this.logger.info('Vérification Node.js...');
    
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        this.logger.success(`Node.js ${nodeVersion} ✅`);
        return {
          status: 'ok',
          version: nodeVersion,
          message: `Node.js ${nodeVersion} compatible`
        };
      } else {
        this.logger.error(`Node.js ${nodeVersion} incompatible (requis: >= 18.0.0)`);
        return {
          status: 'error',
          version: nodeVersion,
          message: 'Version Node.js incompatible',
          solution: 'Téléchargez Node.js >= 18.0.0 depuis https://nodejs.org/'
        };
      }
    } catch (error) {
      this.logger.error('Node.js non détecté', error);
      return {
        status: 'error',
        message: 'Node.js non installé',
        solution: 'Installez Node.js depuis https://nodejs.org/'
      };
    }
  }

  /**
   * Vérification NPM
   */
  async checkNPM() {
    this.logger.info('Vérification NPM...');
    
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      
      if (semver.gte(npmVersion, '8.0.0')) {
        this.logger.success(`NPM ${npmVersion} ✅`);
        return {
          status: 'ok',
          version: npmVersion,
          message: `NPM ${npmVersion} compatible`
        };
      } else {
        this.logger.warn(`NPM ${npmVersion} ancien (recommandé: >= 8.0.0)`);
        return {
          status: 'warning',
          version: npmVersion,
          message: 'Version NPM ancienne mais fonctionnelle',
          solution: 'npm install -g npm@latest'
        };
      }
    } catch (error) {
      this.logger.error('NPM non détecté', error);
      return {
        status: 'error',
        message: 'NPM non installé',
        solution: 'NPM devrait être installé avec Node.js'
      };
    }
  }

  /**
   * Vérification Git
   */
  async checkGit() {
    this.logger.info('Vérification Git...');
    
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
      this.logger.success(`${gitVersion} ✅`);
      
      return {
        status: 'ok',
        version: gitVersion,
        message: 'Git installé et fonctionnel'
      };
    } catch (error) {
      this.logger.error('Git non détecté', error);
      return {
        status: 'error',
        message: 'Git non installé',
        solution: 'Installez Git depuis https://git-scm.com/'
      };
    }
  }

  /**
   * Vérification Claude Code
   */
  async checkClaudeCode() {
    this.logger.info('Vérification Claude Code...');
    
    try {
      const claudeVersion = execSync('claude --version', { encoding: 'utf8' }).trim();
      this.logger.success(`Claude Code ${claudeVersion} ✅`);
      
      return {
        status: 'ok',
        version: claudeVersion,
        message: 'Claude Code installé et fonctionnel'
      };
    } catch (error) {
      this.logger.error('Claude Code non détecté', error);
      return {
        status: 'error',
        message: 'Claude Code non installé',
        solution: 'Installez Claude Code depuis https://claude.ai/code'
      };
    }
  }

  /**
   * Vérification PostgreSQL
   */
  async checkPostgreSQL() {
    this.logger.info('Vérification PostgreSQL...');
    
    // Test de connexion PostgreSQL
    try {
      const pgVersion = execSync('psql --version', { encoding: 'utf8' }).trim();
      
      // Test de connexion
      try {
        execSync('pg_isready', { encoding: 'utf8' });
        this.logger.success(`${pgVersion} ✅ (Serveur actif)`);
        
        return {
          status: 'ok',
          version: pgVersion,
          message: 'PostgreSQL installé et serveur actif'
        };
      } catch (connectionError) {
        this.logger.warn(`${pgVersion} installé mais serveur inactif`);
        return {
          status: 'warning',
          version: pgVersion,
          message: 'PostgreSQL installé mais serveur arrêté',
          solution: 'Démarrez PostgreSQL: brew services start postgresql (macOS) ou sudo systemctl start postgresql (Linux)'
        };
      }
    } catch (error) {
      this.logger.error('PostgreSQL non détecté', error);
      return {
        status: 'error',
        message: 'PostgreSQL non installé',
        solution: 'Installez PostgreSQL depuis https://postgresql.org/ ou utilisez Docker'
      };
    }
  }

  /**
   * Vérification des agents MCP
   */
  async checkMCPAgents() {
    this.logger.info('Vérification Agents MCP...');
    
    const requiredAgents = [
      '@modelcontextprotocol/server-filesystem',
      '@modelcontextprotocol/server-postgres', 
      '@modelcontextprotocol/server-sequential-thinking',
      'prisma'
    ];

    const agentStatus = {};
    let allInstalled = true;

    for (const agent of requiredAgents) {
      try {
        // Vérifier si l'agent est installé globalement
        execSync(`npm list -g ${agent}`, { encoding: 'utf8', stdio: 'ignore' });
        agentStatus[agent] = 'installed';
        this.logger.success(`Agent MCP ${agent} ✅`);
      } catch (error) {
        agentStatus[agent] = 'missing';
        allInstalled = false;
        this.logger.warn(`Agent MCP ${agent} manquant`);
      }
    }

    if (allInstalled) {
      return {
        status: 'ok',
        agents: agentStatus,
        message: 'Tous les agents MCP sont installés'
      };
    } else {
      return {
        status: 'warning',
        agents: agentStatus,
        message: 'Certains agents MCP manquent',
        solution: 'Exécutez: prixigrad init pour installer les agents manquants'
      };
    }
  }

  /**
   * Vérification configuration
   */
  async checkConfiguration() {
    this.logger.info('Vérification Configuration...');
    
    try {
      if (fs.existsSync(this.configFile)) {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.logger.success('Configuration PRIXIGRAD.IO trouvée ✅');
        
        return {
          status: 'ok',
          config: config,
          message: 'Configuration PRIXIGRAD.IO présente'
        };
      } else {
        this.logger.warn('Configuration PRIXIGRAD.IO manquante');
        return {
          status: 'warning',
          message: 'Configuration non initialisée',
          solution: 'Exécutez: prixigrad init'
        };
      }
    } catch (error) {
      this.logger.error('Erreur lecture configuration', error);
      return {
        status: 'error',
        message: 'Configuration corrompue',
        solution: 'Exécutez: prixigrad init --force'
      };
    }
  }

  /**
   * Affichage des résultats
   */
  displayResults(results) {
    this.logger.separator();
    console.log(`📊 Score global: ${results.globalScore}%`);
    this.logger.separator();

    // Affichage détaillé
    Object.entries(results).forEach(([key, result]) => {
      if (key === 'globalScore' || key === 'allGood') return;
      
      const icon = result.status === 'ok' ? '✅' : 
                  result.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${icon} ${key.toUpperCase()}: ${result.message}`);
      
      if (result.solution) {
        console.log(`   💡 Solution: ${result.solution}`);
      }
    });

    this.logger.separator();

    if (results.allGood) {
      this.logger.success('🎉 Système prêt pour PRIXIGRAD.IO !');
    } else {
      this.logger.warn('🔧 Configuration système à compléter');
      console.log('\n💡 Exécutez: prixigrad init pour résoudre les problèmes');
    }
  }

  /**
   * Réparation automatique des problèmes détectés
   */
  async autoFix(issues) {
    this.logger.info('Tentative de réparation automatique...');
    
    // Cette méthode sera implémentée dans MCPInstaller
    // pour installer automatiquement les composants manquants
    
    return {
      success: false,
      message: 'Réparation automatique non encore implémentée'
    };
  }
}

module.exports = SystemChecker;