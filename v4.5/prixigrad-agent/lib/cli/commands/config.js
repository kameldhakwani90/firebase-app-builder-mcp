/**
 * 🎭 PRIXIGRAD.IO - Commande Config
 * 
 * Gestion de la configuration système
 */

const inquirer = require('inquirer');
const ConfigManager = require('../../core/config');
const Logger = require('../../core/logger');

class ConfigCommand {
  constructor() {
    this.logger = new Logger('Config');
    this.configManager = new ConfigManager();
  }

  async execute(options = {}) {
    try {
      if (options.show) {
        this.showConfiguration();
      } else if (options.reset) {
        await this.resetConfiguration();
      } else {
        await this.interactiveConfiguration();
      }

    } catch (error) {
      this.logger.error('❌ Erreur lors de la gestion de la configuration', error);
      
      if (options.verbose) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Affichage de la configuration
   */
  showConfiguration() {
    this.logger.banner('CONFIGURATION PRIXIGRAD.IO');
    this.configManager.show();
  }

  /**
   * Réinitialisation de la configuration
   */
  async resetConfiguration() {
    this.logger.info('🔄 Réinitialisation de la configuration...');

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: '⚠️ Êtes-vous sûr de vouloir réinitialiser la configuration ?',
      default: false
    }]);

    if (!confirm) {
      this.logger.info('Réinitialisation annulée');
      return;
    }

    const success = this.configManager.reset();
    
    if (success) {
      this.logger.success('✅ Configuration réinitialisée');
      console.log('\n💡 Exécutez "prixigrad init" pour reconfigurer le système');
    } else {
      throw new Error('Impossible de réinitialiser la configuration');
    }
  }

  /**
   * Configuration interactive
   */
  async interactiveConfiguration() {
    this.logger.banner('CONFIGURATION INTERACTIVE');

    const config = this.configManager.load();

    // Menu principal
    const { section } = await inquirer.prompt([{
      type: 'list',
      name: 'section',
      message: 'Que souhaitez-vous configurer ?',
      choices: [
        { name: '🗃️ PostgreSQL', value: 'postgresql' },
        { name: '📁 GitHub', value: 'github' },
        { name: '🌐 Interface Web', value: 'web' },
        { name: '🤖 Agents MCP', value: 'mcp' },
        { name: '🚀 Déploiement', value: 'deployment' },
        { name: '📝 Logs', value: 'logging' },
        { name: '👀 Voir configuration actuelle', value: 'show' },
        { name: '❌ Annuler', value: 'cancel' }
      ]
    }]);

    if (section === 'cancel') {
      this.logger.info('Configuration annulée');
      return;
    }

    if (section === 'show') {
      this.showConfiguration();
      return;
    }

    // Configuration de la section choisie
    await this.configureSection(section, config);
  }

  /**
   * Configuration d'une section spécifique
   */
  async configureSection(section, config) {
    this.logger.info(`⚙️ Configuration ${section}...`);

    let updates = {};

    switch (section) {
      case 'postgresql':
        updates = await this.configurePostgreSQL(config.postgresql);
        break;
      case 'github':
        updates = await this.configureGitHub(config.github);
        break;
      case 'web':
        updates = await this.configureWeb(config.web);
        break;
      case 'mcp':
        updates = await this.configureMCP(config.mcp);
        break;
      case 'deployment':
        updates = await this.configureDeployment(config.deployment);
        break;
      case 'logging':
        updates = await this.configureLogging(config.logging);
        break;
    }

    // Application des mises à jour
    if (Object.keys(updates).length > 0) {
      let success = true;
      
      for (const [key, value] of Object.entries(updates)) {
        const fullKey = `${section}.${key}`;
        if (!this.configManager.set(fullKey, value)) {
          success = false;
          this.logger.error(`Erreur mise à jour ${fullKey}`);
        }
      }

      if (success) {
        this.logger.success(`✅ Configuration ${section} mise à jour`);
        
        // Validation
        const validation = this.configManager.validate();
        if (!validation.valid) {
          this.logger.warn('⚠️ Configuration invalide après mise à jour:');
          validation.errors.forEach(error => console.log(`   • ${error}`));
        }
      } else {
        throw new Error(`Erreur lors de la mise à jour de ${section}`);
      }
    } else {
      this.logger.info('Aucune modification apportée');
    }
  }

  /**
   * Configuration PostgreSQL
   */
  async configurePostgreSQL(currentConfig) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Host PostgreSQL:',
        default: currentConfig.host
      },
      {
        type: 'number',
        name: 'port',
        message: 'Port PostgreSQL:',
        default: currentConfig.port,
        validate: (value) => {
          if (value < 1 || value > 65535) {
            return 'Le port doit être entre 1 et 65535';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'database',
        message: 'Base de données par défaut:',
        default: currentConfig.database
      },
      {
        type: 'input',
        name: 'username',
        message: 'Nom d\'utilisateur:',
        default: currentConfig.username
      },
      {
        type: 'password',
        name: 'password',
        message: 'Mot de passe (optionnel):',
        mask: '*'
      },
      {
        type: 'confirm',
        name: 'ssl',
        message: 'Utiliser SSL ?',
        default: currentConfig.ssl
      }
    ]);

    return answers;
  }

  /**
   * Configuration GitHub
   */
  async configureGitHub(currentConfig) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'token',
        message: 'Token GitHub (pour repos privés):',
        transformer: (input) => input ? '***' + input.slice(-4) : ''
      },
      {
        type: 'input',
        name: 'defaultBranch',
        message: 'Branche de production par défaut:',
        default: currentConfig.defaultBranch
      }
    ]);

    return answers;
  }

  /**
   * Configuration Interface Web
   */
  async configureWeb(currentConfig) {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'port',
        message: 'Port interface web:',
        default: currentConfig.port,
        validate: (value) => {
          if (value < 1024 || value > 65535) {
            return 'Le port doit être entre 1024 et 65535';
          }
          return true;
        }
      },
      {
        type: 'number',
        name: 'bridgePort',
        message: 'Port bridge API:',
        default: currentConfig.bridgePort,
        validate: (value, answers) => {
          if (value < 1024 || value > 65535) {
            return 'Le port doit être entre 1024 et 65535';
          }
          if (value === answers.port) {
            return 'Le port bridge doit être différent du port web';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'autoOpen',
        message: 'Ouvrir automatiquement le navigateur ?',
        default: currentConfig.autoOpen
      }
    ]);

    return answers;
  }

  /**
   * Configuration MCP
   */
  async configureMCP(currentConfig) {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'timeout',
        message: 'Timeout MCP (millisecondes):',
        default: currentConfig.timeout,
        validate: (value) => {
          if (value < 5000 || value > 600000) {
            return 'Le timeout doit être entre 5000ms (5s) et 600000ms (10min)';
          }
          return true;
        }
      },
      {
        type: 'number',
        name: 'retries',
        message: 'Nombre de tentatives:',
        default: currentConfig.retries,
        validate: (value) => {
          if (value < 1 || value > 10) {
            return 'Le nombre de tentatives doit être entre 1 et 10';
          }
          return true;
        }
      }
    ]);

    // Configuration des agents individuels
    const agentConfig = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'filesystem',
        message: 'Activer agent Filesystem ?',
        default: currentConfig.agents.filesystem
      },
      {
        type: 'confirm',
        name: 'postgres',
        message: 'Activer agent PostgreSQL ?',
        default: currentConfig.agents.postgres
      },
      {
        type: 'confirm',
        name: 'prisma',
        message: 'Activer agent Prisma ?',
        default: currentConfig.agents.prisma
      },
      {
        type: 'confirm',
        name: 'sequential',
        message: 'Activer agent Sequential Thinking ?',
        default: currentConfig.agents.sequential
      }
    ]);

    answers.agents = agentConfig;
    return answers;
  }

  /**
   * Configuration Déploiement
   */
  async configureDeployment(currentConfig) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'docker',
        message: 'Inclure configuration Docker ?',
        default: currentConfig.docker
      },
      {
        type: 'input',
        name: 'branch',
        message: 'Nom de branche de production:',
        default: currentConfig.branch
      },
      {
        type: 'confirm',
        name: 'autoCommit',
        message: 'Commit automatique des changements ?',
        default: currentConfig.autoCommit
      },
      {
        type: 'confirm',
        name: 'autoPush',
        message: 'Push automatique vers GitHub ?',
        default: currentConfig.autoPush
      }
    ]);

    return answers;
  }

  /**
   * Configuration Logging
   */
  async configureLogging(currentConfig) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'level',
        message: 'Niveau de log:',
        choices: [
          { name: 'Error seulement', value: 'error' },
          { name: 'Warnings + Errors', value: 'warn' },
          { name: 'Informations (recommandé)', value: 'info' },
          { name: 'Debug (développement)', value: 'debug' }
        ],
        default: currentConfig.level
      },
      {
        type: 'number',
        name: 'keepDays',
        message: 'Durée de conservation des logs (jours):',
        default: currentConfig.keepDays,
        validate: (value) => {
          if (value < 1 || value > 365) {
            return 'La durée doit être entre 1 et 365 jours';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'debug',
        message: 'Activer les logs de debug ?',
        default: currentConfig.debug
      }
    ]);

    return answers;
  }
}

// Export de la fonction principale pour Commander.js
module.exports = async function configCommand(options) {
  const command = new ConfigCommand();
  await command.execute(options);
};