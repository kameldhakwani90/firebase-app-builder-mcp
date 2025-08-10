/**
 * 🎭 PRIXIGRAD.IO - Commande Transform
 * 
 * Transformation directe d'une application via CLI
 */

const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const SystemChecker = require('../../core/system-checker');
const ConfigManager = require('../../core/config');
const BridgeServer = require('../../core/bridge-server');
const Logger = require('../../core/logger');

class TransformCommand {
  constructor() {
    this.logger = new Logger('Transform');
    this.systemChecker = new SystemChecker();
    this.configManager = new ConfigManager();
    this.bridgeServer = new BridgeServer();
  }

  async execute(githubUrl, options = {}) {
    try {
      this.logger.banner('TRANSFORMATION PRIXIGRAD.IO');

      // Validation de l'URL GitHub
      if (!this.isValidGithubUrl(githubUrl)) {
        throw new Error('URL GitHub invalide. Format attendu: https://github.com/user/repo');
      }

      // Vérifications préliminaires
      await this.runPreflightChecks();

      // Configuration interactive si nécessaire
      const transformConfig = await this.configureTransformation(githubUrl, options);

      // Démarrage temporaire du bridge server
      this.logger.info('🌉 Démarrage du bridge temporaire...');
      const bridgeInfo = await this.bridgeServer.start(0); // Port automatique

      try {
        // Exécution de la transformation
        await this.executeTransformation(transformConfig, bridgeInfo);
        
        // Résumé de succès
        this.showSuccessSummary(transformConfig);

      } finally {
        // Arrêt du bridge server
        await this.bridgeServer.stop();
      }

    } catch (error) {
      this.logger.error('❌ Erreur lors de la transformation', error);
      
      if (options.verbose) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }

  /**
   * Validation URL GitHub
   */
  isValidGithubUrl(url) {
    const githubPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?(?:\/)?$/;
    return githubPattern.test(url);
  }

  /**
   * Vérifications préliminaires
   */
  async runPreflightChecks() {
    this.logger.info('🔍 Vérifications système...');
    
    const systemStatus = await this.systemChecker.checkAll();
    
    if (systemStatus.globalScore < 80) {
      this.logger.warn('⚠️ Score système faible, la transformation peut échouer');
      
      // Vérifications critiques
      if (!systemStatus.claudeCode || systemStatus.claudeCode.status !== 'ok') {
        throw new Error('Claude Code requis pour la transformation');
      }
      
      if (!systemStatus.postgres || systemStatus.postgres.status === 'error') {
        throw new Error('PostgreSQL requis pour la transformation');
      }
    }

    this.logger.success('✅ Système prêt pour la transformation');
  }

  /**
   * Configuration interactive de la transformation
   */
  async configureTransformation(githubUrl, options) {
    this.logger.info('⚙️ Configuration de la transformation...');

    const config = this.configManager.load();
    
    // Configuration de base
    const baseConfig = {
      githubUrl,
      githubToken: options.token || config.github.token,
      outputDir: options.output || './output',
      branchName: options.branch || config.deployment.branch || 'prod-auto',
      skipAnalysis: options.skipAnalysis || false
    };

    // Questions interactives si pas en mode automatique
    if (!options.skipAnalysis && !process.env.CI) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'githubToken',
          message: 'Token GitHub (optionnel pour repos privés):',
          default: baseConfig.githubToken || '',
          when: !baseConfig.githubToken
        },
        {
          type: 'input',
          name: 'outputDir',
          message: 'Répertoire de sortie:',
          default: baseConfig.outputDir
        },
        {
          type: 'input',
          name: 'branchName',
          message: 'Nom de la branche de production:',
          default: baseConfig.branchName
        },
        {
          type: 'confirm',
          name: 'includeDocker',
          message: 'Inclure la configuration Docker ?',
          default: true
        },
        {
          type: 'confirm',
          name: 'autoPush',
          message: 'Push automatique vers GitHub ?',
          default: false
        }
      ]);

      // Merge des réponses
      Object.assign(baseConfig, answers);
    }

    // Validation du répertoire de sortie
    if (!fs.existsSync(baseConfig.outputDir)) {
      fs.mkdirSync(baseConfig.outputDir, { recursive: true });
      this.logger.info(`📁 Répertoire créé: ${baseConfig.outputDir}`);
    }

    return baseConfig;
  }

  /**
   * Exécution de la transformation
   */
  async executeTransformation(config, bridgeInfo) {
    this.logger.info(`🚀 Début transformation: ${config.githubUrl}`);
    
    // Préparation de la requête de transformation
    const transformRequest = {
      github_url: config.githubUrl,
      github_token: config.githubToken,
      workflow: 'complete_transformation',
      options: {
        outputDir: config.outputDir,
        branchName: config.branchName,
        includeDocker: config.includeDocker,
        autoPush: config.autoPush
      }
    };

    // Exécution via le bridge server
    return new Promise((resolve, reject) => {
      const axios = require('axios');
      
      // Configuration EventSource pour le streaming
      const EventSource = require('eventsource');
      const eventSource = new EventSource(
        `${bridgeInfo.url}/api/transform`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Envoi de la requête
      axios.post(`${bridgeInfo.url}/api/transform`, transformRequest)
        .catch(error => {
          // La requête POST peut échouer car on utilise Server-Sent Events
          // C'est normal, on écoute les événements
        });

      let currentStep = 0;
      const steps = [
        '🔍 Analyse du projet',
        '📋 Génération des spécifications', 
        '🗃️ Création du schéma Prisma',
        '🔧 Configuration base de données',
        '👑 Création super admin',
        '🔌 Génération backend',
        '🌐 Transformation frontend',
        '🚀 Déploiement final'
      ];

      // Gestion des événements
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleTransformationEvent(data, steps, currentStep);
        } catch (error) {
          // Ignore les données malformées
        }
      };

      eventSource.addEventListener('output', (event) => {
        const data = JSON.parse(event.data);
        
        // Détection du changement d'étape
        if (data.content.includes('ÉTAPE') && currentStep < steps.length) {
          currentStep++;
          this.logger.info(`${steps[currentStep - 1]}...`);
        }
        
        // Affichage conditionnel
        if (process.env.PRIXIGRAD_DEBUG === 'true') {
          console.log('[CLAUDE]', data.content.trim());
        }
      });

      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        this.logger.error('❌', data.content);
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        eventSource.close();
        
        if (data.success) {
          this.logger.success('✅ Transformation terminée avec succès');
          resolve(data);
        } else {
          reject(new Error(`Transformation échouée (code: ${data.code})`));
        }
      });

      // Timeout de sécurité (15 minutes)
      setTimeout(() => {
        eventSource.close();
        reject(new Error('Timeout transformation (15 minutes)'));
      }, 15 * 60 * 1000);
    });
  }

  /**
   * Gestion des événements de transformation
   */
  handleTransformationEvent(data, steps, currentStep) {
    // Logique spécifique selon le type d'événement
    switch (data.type) {
      case 'step_start':
        if (data.step < steps.length) {
          this.logger.info(`${steps[data.step]}...`);
        }
        break;
        
      case 'step_complete':
        if (data.step < steps.length) {
          this.logger.success(`✅ ${steps[data.step]} terminé`);
        }
        break;
        
      case 'progress':
        // Affichage de la progression si disponible
        if (data.percentage) {
          process.stdout.write(`\r⏳ Progression: ${data.percentage}%`);
        }
        break;
        
      case 'result':
        // Résultat intermédiaire
        if (data.result) {
          console.log(`   📋 ${data.result}`);
        }
        break;
    }
  }

  /**
   * Résumé de succès
   */
  showSuccessSummary(config) {
    this.logger.separator();
    this.logger.banner('TRANSFORMATION RÉUSSIE');

    console.log(`🎯 Projet: ${config.githubUrl}`);
    console.log(`📁 Sortie: ${path.resolve(config.outputDir)}`);
    console.log(`🌿 Branche: ${config.branchName}`);

    this.logger.separator();

    console.log(`🎉 RÉSULTATS:
    
✅ Application transformée avec succès
🗃️ Base de données PostgreSQL configurée  
🔌 APIs REST/GraphQL générées
🔐 Système d'authentification configuré
👑 Super admin créé avec données de démo
🐳 Configuration Docker incluse
🌿 Branche '${config.branchName}' créée

🚀 PROCHAINES ÉTAPES:
• Vérifiez les fichiers dans ${config.outputDir}
• Testez l'application localement
• Déployez sur votre plateforme préférée

📖 Documentation: README.md généré dans le projet
`);

    if (config.autoPush) {
      console.log(`🔄 Code pushé automatiquement vers GitHub`);
    } else {
      console.log(`💡 N'oubliez pas de push vos changements vers GitHub`);
    }
  }
}

// Export de la fonction principale pour Commander.js
module.exports = async function transformCommand(githubUrl, options) {
  const command = new TransformCommand();
  await command.execute(githubUrl, options);
};