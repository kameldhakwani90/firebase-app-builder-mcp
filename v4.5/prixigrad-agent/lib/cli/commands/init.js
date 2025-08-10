/**
 * 🎭 PRIXIGRAD.IO - Commande Init
 * 
 * Initialisation complète du système PRIXIGRAD.IO
 */

const inquirer = require('inquirer');
const SystemChecker = require('../../core/system-checker');
const ConfigManager = require('../../core/config');
const MCPInstaller = require('../../core/mcp-installer');
const Logger = require('../../core/logger');

class InitCommand {
  constructor() {
    this.logger = new Logger('Init');
    this.systemChecker = new SystemChecker();
    this.configManager = new ConfigManager();
    this.mcpInstaller = new MCPInstaller();
  }

  async execute(options = {}) {
    try {
      this.logger.banner('INITIALISATION PRIXIGRAD.IO AGENT');

      // Étape 1: Vérification système
      this.logger.info('🔍 Étape 1/4: Vérification du système...');
      const systemStatus = await this.systemChecker.checkAll();

      if (systemStatus.globalScore < 50) {
        this.logger.error('❌ Système incompatible (score < 50%)');
        this.showSystemRequirements();
        process.exit(1);
      }

      // Étape 2: Configuration
      this.logger.info('⚙️ Étape 2/4: Configuration...');
      const config = await this.configureSystem(options.force);

      // Étape 3: Installation agents MCP
      this.logger.info('🤖 Étape 3/4: Installation agents MCP...');
      const mcpStatus = await this.installMCPAgents(systemStatus.mcpAgents);

      // Étape 4: Tests finaux
      this.logger.info('🧪 Étape 4/4: Tests de validation...');
      const testsStatus = await this.runFinalTests();

      // Résumé final
      this.showCompletionSummary(systemStatus, config, mcpStatus, testsStatus);

    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'initialisation', error);
      
      if (options.verbose) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Configuration interactive du système
   */
  async configureSystem(force = false) {
    let config = this.configManager.load();

    // Si config existe et pas de force, demander confirmation
    if (!force && config.lastUpdated) {
      const { reconfigure } = await inquirer.prompt([{
        type: 'confirm',
        name: 'reconfigure',
        message: 'Configuration existante détectée. Reconfigurer ?',
        default: false
      }]);

      if (!reconfigure) {
        this.logger.info('Configuration existante conservée');
        return config;
      }
    }

    this.logger.info('🔧 Configuration interactive...');

    // Configuration PostgreSQL
    const pgConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Host PostgreSQL:',
        default: config.postgresql.host
      },
      {
        type: 'number',
        name: 'port',
        message: 'Port PostgreSQL:',
        default: config.postgresql.port
      },
      {
        type: 'input',
        name: 'database',
        message: 'Base de données par défaut:',
        default: config.postgresql.database
      },
      {
        type: 'input',
        name: 'username',
        message: 'Nom d\'utilisateur PostgreSQL:',
        default: config.postgresql.username
      },
      {
        type: 'password',
        name: 'password',
        message: 'Mot de passe PostgreSQL (optionnel):',
        mask: '*'
      }
    ]);

    // Configuration GitHub
    const githubConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'token',
        message: 'Token GitHub (optionnel, pour repos privés):',
        transformer: (input) => input ? '***' + input.slice(-4) : ''
      },
      {
        type: 'input',
        name: 'defaultBranch',
        message: 'Nom de branche de production:',
        default: config.github.defaultBranch
      }
    ]);

    // Configuration interface web
    const webConfig = await inquirer.prompt([
      {
        type: 'number',
        name: 'port',
        message: 'Port interface web:',
        default: config.web.port
      },
      {
        type: 'number',
        name: 'bridgePort',
        message: 'Port bridge API:',
        default: config.web.bridgePort
      },
      {
        type: 'confirm',
        name: 'autoOpen',
        message: 'Ouvrir automatiquement l\'interface web ?',
        default: config.web.autoOpen
      }
    ]);

    // Mise à jour de la configuration
    config.postgresql = { ...config.postgresql, ...pgConfig };
    config.github = { ...config.github, ...githubConfig };
    config.web = { ...config.web, ...webConfig };

    // Validation et sauvegarde
    const validation = this.configManager.validate(config);
    if (!validation.valid) {
      this.logger.error('Configuration invalide:', validation.errors);
      throw new Error('Configuration invalide');
    }

    this.configManager.save(config);
    this.logger.success('✅ Configuration sauvegardée');

    return config;
  }

  /**
   * Installation des agents MCP manquants
   */
  async installMCPAgents(currentStatus) {
    if (currentStatus.status === 'ok') {
      this.logger.success('Tous les agents MCP sont déjà installés');
      return { success: true, installed: [], skipped: Object.keys(currentStatus.agents) };
    }

    const missingAgents = Object.entries(currentStatus.agents)
      .filter(([_, status]) => status === 'missing')
      .map(([agent, _]) => agent);

    if (missingAgents.length === 0) {
      return { success: true, installed: [], skipped: [] };
    }

    this.logger.info(`Installation de ${missingAgents.length} agents MCP...`);

    const results = await this.mcpInstaller.installAgents(missingAgents);
    
    if (results.success) {
      this.logger.success(`✅ ${results.installed.length} agents installés avec succès`);
    } else {
      this.logger.error(`❌ Erreurs lors de l'installation: ${results.errors.length}`);
    }

    return results;
  }

  /**
   * Tests de validation finale
   */
  async runFinalTests() {
    this.logger.info('🧪 Tests de validation...');

    const tests = [
      this.testClaudeCodeConnection(),
      this.testPostgreSQLConnection(),
      this.testMCPAgents(),
      this.testConfiguration()
    ];

    const results = await Promise.allSettled(tests);
    const passed = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      total: tests.length,
      passed,
      failed,
      success: failed === 0,
      details: results
    };
  }

  /**
   * Test connexion Claude Code
   */
  async testClaudeCodeConnection() {
    try {
      const { execSync } = require('child_process');
      execSync('claude --version', { stdio: 'ignore' });
      return { test: 'claude-code', status: 'passed' };
    } catch (error) {
      throw new Error('Claude Code non accessible');
    }
  }

  /**
   * Test connexion PostgreSQL
   */
  async testPostgreSQLConnection() {
    try {
      const { execSync } = require('child_process');
      execSync('pg_isready', { stdio: 'ignore' });
      return { test: 'postgresql', status: 'passed' };
    } catch (error) {
      throw new Error('PostgreSQL non accessible');
    }
  }

  /**
   * Test agents MCP
   */
  async testMCPAgents() {
    // Test simple de présence des agents
    const agents = [
      '@modelcontextprotocol/server-filesystem',
      '@modelcontextprotocol/server-postgres'
    ];

    for (const agent of agents) {
      try {
        const { execSync } = require('child_process');
        execSync(`npm list -g ${agent}`, { stdio: 'ignore' });
      } catch (error) {
        throw new Error(`Agent MCP ${agent} non trouvé`);
      }
    }

    return { test: 'mcp-agents', status: 'passed' };
  }

  /**
   * Test configuration
   */
  async testConfiguration() {
    const validation = this.configManager.validate();
    if (!validation.valid) {
      throw new Error('Configuration invalide');
    }
    return { test: 'configuration', status: 'passed' };
  }

  /**
   * Affichage des prérequis système
   */
  showSystemRequirements() {
    console.log(`
📋 PRÉREQUIS SYSTÈME PRIXIGRAD.IO:

✅ Node.js >= 18.0.0
✅ NPM >= 8.0.0  
✅ Git
✅ Claude Code
✅ PostgreSQL (local ou Docker)

💡 Installez les composants manquants et relancez 'prixigrad init'
`);
  }

  /**
   * Résumé de l'initialisation
   */
  showCompletionSummary(systemStatus, config, mcpStatus, testsStatus) {
    this.logger.separator();
    this.logger.banner('INITIALISATION TERMINÉE');

    console.log(`📊 Système: ${systemStatus.globalScore}%`);
    console.log(`🤖 Agents MCP: ${mcpStatus.success ? '✅' : '❌'}`);
    console.log(`🧪 Tests: ${testsStatus.passed}/${testsStatus.total} ✅`);

    if (testsStatus.success) {
      this.logger.success('🎉 PRIXIGRAD.IO Agent prêt à l\'emploi !');
      console.log(`
🚀 Prochaines étapes:
• prixigrad start                    # Lance l'interface web
• prixigrad transform <github-url>   # Transforme une application

🌐 Interface web: http://localhost:${config.web.port}
🔧 Configuration: ~/.prixigrad/config.json
📝 Logs: ~/.prixigrad/logs/agent.log
`);
    } else {
      this.logger.warn('⚠️ Initialisation incomplète');
      console.log('\n💡 Vérifiez les erreurs ci-dessus et relancez: prixigrad init');
    }
  }
}

// Export de la fonction principale pour Commander.js
module.exports = async function initCommand(options) {
  const command = new InitCommand();
  await command.execute(options);
};