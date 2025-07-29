import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import os from 'os';
import { ProjectManager } from './memory/projects.js';
import { GitCloner } from './tools/cloner.js';
import { IntelligentAnalyzer } from './tools/intelligent-analyzer.js';
import { DatabaseMigrator } from './tools/database.js';
import { RealisticTester } from './tools/tester.js';
import { logger } from './utils/logger.js';
import { safetyManager } from './utils/safety.js';
import { progressUI } from './utils/progress-ui.js';
import { dashboard } from './utils/dashboard.js';
import { Project } from './types.js';

export class FirebaseAppBuilderAgent {
  private projectManager: ProjectManager;
  private gitCloner: GitCloner;
  private analyzer: IntelligentAnalyzer;
  private dbMigrator: DatabaseMigrator;
  private tester: RealisticTester;

  constructor() {
    this.projectManager = new ProjectManager();
    this.gitCloner = new GitCloner();
    this.analyzer = new IntelligentAnalyzer();
    this.dbMigrator = new DatabaseMigrator();
    this.tester = new RealisticTester();
  }

  async initialize(): Promise<void> {
    await this.projectManager.initialize();
    console.log(chalk.bold.blue('🚀 FirebaseAppBuilder Agent initialisé'));
  }

  async run(args: string[]): Promise<void> {
    try {
      logger.info('Démarrage de l\'agent Firebase App Builder', { args });

      // Nettoyage des anciens projets
      await this.projectManager.cleanup();

      // Traitement des commandes spéciales
      if (args.length === 0) {
        await this.projectManager.listProjects();
        return;
      }

      if (args[0] === 'dashboard') {
        await dashboard.showFullDashboard();
        return;
      }

      if (args[0] === 'monitor') {
        dashboard.startLiveMonitoring();
        return;
      }

      if (args[0] === 'logs') {
        await this.showLogs();
        return;
      }

      if (args[0] === 'status') {
        await this.showStatus();
        return;
      }

      if (args[0] === 'cleanup') {
        await this.forceCleanup();
        return;
      }

      if (args[0] === 'continue' && args[1]) {
        await this.continueProject(args[1]);
        return;
      }

      // Nouveau projet
      const repoUrl = args[0];
      if (!this.isValidGitUrl(repoUrl)) {
        logger.error('URL Git invalide', undefined, { url: repoUrl });
        console.error(chalk.red('❌ URL Git invalide'));
        return;
      }

      await this.startNewProject(repoUrl);

    } catch (error: any) {
      logger.error('Erreur critique dans l\'agent', error);
      progressUI.showCriticalError(error.message);
      process.exit(1);
    }
  }

  private async startNewProject(repoUrl: string): Promise<void> {
    logger.info('Démarrage d\'un nouveau projet de migration', { repoUrl });
    
    // Vérifier si le projet existe déjà
    const existingProject = await this.projectManager.checkExistingProject(repoUrl);
    if (existingProject) {
      const continueExisting = await this.askUserContinue(existingProject);
      if (continueExisting) {
        await this.continueProject(existingProject.name);
        return;
      }
    }

    // Créer un nouveau projet
    const project = await this.projectManager.createProject(repoUrl);
    logger.setCurrentProject(project.name);
    
    // Démarrer l'interface de progression
    progressUI.start();
    
    // Exécuter le workflow complet avec sécurité
    await this.executeFullWorkflow(project);
  }

  private async continueProject(projectName: string): Promise<void> {
    const project = await this.projectManager.resumeProject(projectName);
    if (!project) return;

    console.log(chalk.blue(`🔄 Reprise du projet: ${project.name}`));
    
    // Continuer depuis la dernière étape
    await this.resumeFromStep(project);
  }

  private async executeFullWorkflow(project: Project): Promise<void> {
    const startTime = Date.now();
    
    try {
      await safetyManager.startExecution(project.name, 'workflow');
      logger.info(`Démarrage du workflow complet pour ${project.name}`);
      
      // Étape 1: Clone et analyse
      await safetyManager.safeExecute(
        () => this.step1_cloneAndAnalyze(project),
        'Clone et analyse'
      );
      
      // Étape 2: Migration base de données
      await safetyManager.safeExecute(
        () => this.step2_databaseMigration(project),
        'Migration base de données'
      );
      
      // Étape 3: Tests utilisateur réalistes
      await safetyManager.safeExecute(
        () => this.step3_userTesting(project),
        'Tests utilisateur'
      );
      
      // Étape 4: Finalisation
      await safetyManager.safeExecute(
        () => this.step4_finalization(project),
        'Finalisation'
      );
      
      // Marquer comme terminé
      const totalDuration = Date.now() - startTime;
      await this.projectManager.markCompleted(project, { 
        totalDuration,
        workflow: 'complete'
      });

      // Afficher le succès
      progressUI.showSuccess(project.name, totalDuration);
      await safetyManager.stopExecution(true);
      logger.success(`Workflow terminé avec succès pour ${project.name}`, { totalDuration });

    } catch (error: any) {
      logger.error(`Erreur workflow pour ${project.name}`, error);
      await this.projectManager.saveProgress(project, 'error', { 
        error: error.message 
      });
      
      progressUI.showCriticalError(`Erreur workflow: ${error.message}`);
      await safetyManager.stopExecution(false);
    }
  }

  private async step1_cloneAndAnalyze(project: Project): Promise<void> {
    await safetyManager.updateStep('Clone et analyse');
    logger.startStep(0);
    logger.info('Début de l\'étape: Clone et analyse', { projectName: project.name });
    
    const stepStart = Date.now();
    
    // Clone du repository
    project.status = 'cloning';
    logger.updateProgress('Clone du repository en cours...');
    const cloneResult = await this.gitCloner.cloneRepository(project);
    if (!cloneResult.success) {
      throw new Error(cloneResult.error);
    }
    logger.success('Repository cloné avec succès');

    // Analyse intelligente du projet avec Claude
    project.status = 'analyzing';
    logger.updateProgress('Analyse intelligente du projet avec Claude...');
    const analysisResult = await this.analyzer.analyzeProject(project.path);
    
    logger.success(`Analyse terminée: ${analysisResult.dataModels.length} modèles, ${analysisResult.features.length} fonctionnalités`, {
      modelsCount: analysisResult.dataModels.length,
      featuresCount: analysisResult.features.length
    });
    
    // Sauvegarder les résultats
    const stepDuration = Date.now() - stepStart;
    await this.projectManager.saveProgress(project, 'analysis-complete', {
      mockFiles: analysisResult.mockFiles.length,
      dataModels: analysisResult.dataModels.length,
      features: analysisResult.features.length,
      details: analysisResult
    }, stepDuration);

    // Stocker les résultats pour les étapes suivantes
    (project as any).analysisResult = analysisResult;
    logger.completeStep();
  }

  private async step2_databaseMigration(project: Project): Promise<void> {
    console.log(chalk.bold.blue('🗄️  Étape 2: Migration base de données'));
    const stepStart = Date.now();
    
    project.status = 'migrating';
    const analysisResult = (project as any).analysisResult;
    
    if (!analysisResult || !analysisResult.dataModels.length) {
      console.log(chalk.yellow('⚠️  Aucun modèle de données détecté, étape ignorée'));
      return;
    }

    // Configuration Prisma et génération des APIs
    const dbResult = await this.dbMigrator.setupPrismaDatabase(
      project.path, 
      analysisResult.dataModels
    );
    
    if (!dbResult.success) {
      throw new Error(dbResult.error);
    }

    // Génération des routes API
    await this.dbMigrator.generateApiRoutes(project.path, analysisResult.dataModels);

    // Création d'une branche pour les changements
    await this.gitCloner.createBranch(project.path, 'feature/database-migration');
    await this.gitCloner.commitChanges(
      project.path, 
      'feat: migrate from mocks to Prisma database\n\n- Setup Prisma schema\n- Generate API routes\n- Configure environment variables'
    );

    const stepDuration = Date.now() - stepStart;
    await this.projectManager.saveProgress(project, 'database-migration-complete', {
      modelsCount: analysisResult.dataModels.length,
      prismaSetup: true,
      apiRoutes: true
    }, stepDuration);
  }

  private async step3_userTesting(project: Project): Promise<void> {
    console.log(chalk.bold.blue('🧪 Étape 3: Tests utilisateur réalistes'));
    const stepStart = Date.now();
    
    project.status = 'testing';
    const analysisResult = (project as any).analysisResult;
    
    // Exécuter les tests utilisateur
    const testResult = await this.tester.runRealisticTests(
      project.path,
      analysisResult.dataModels,
      analysisResult.features
    );

    const stepDuration = Date.now() - stepStart;
    await this.projectManager.saveProgress(project, 'user-testing-complete', {
      testsPassed: testResult.results.passed || 0,
      testsFailed: testResult.results.failed || 0,
      testsTotal: testResult.results.total || 0,
      success: testResult.success
    }, stepDuration);

    if (!testResult.success) {
      console.log(chalk.yellow('⚠️  Certains tests ont échoué, mais la migration continue'));
    }
  }

  private async step4_finalization(project: Project): Promise<void> {
    console.log(chalk.bold.blue('📋 Étape 4: Finalisation'));
    const stepStart = Date.now();
    
    // Générer le rapport final
    await this.generateFinalReport(project);
    
    // Commit final
    await this.gitCloner.commitChanges(
      project.path,
      'docs: add migration report and test results\n\n- Complete migration from mocks to database\n- Add comprehensive test suite\n- Document migration process'
    );

    const stepDuration = Date.now() - stepStart;
    await this.projectManager.saveProgress(project, 'finalization-complete', {
      reportGenerated: true,
      finalCommit: true
    }, stepDuration);
  }

  private async resumeFromStep(project: Project): Promise<void> {
    const lastStep = project.currentStep;
    
    console.log(chalk.yellow(`🔄 Reprise depuis: ${lastStep}`));
    
    switch (lastStep) {
      case 'initialization':
      case 'cloning':
        await this.executeFullWorkflow(project);
        break;
      case 'analysis-complete':
        await this.step2_databaseMigration(project);
        await this.step3_userTesting(project);
        await this.step4_finalization(project);
        break;
      case 'database-migration-complete':
        await this.step3_userTesting(project);
        await this.step4_finalization(project);
        break;
      case 'user-testing-complete':
        await this.step4_finalization(project);
        break;
      case 'completed':
        console.log(chalk.green('✅ Projet déjà terminé'));
        break;
      default:
        console.log(chalk.yellow('⚠️  Étape inconnue, recommencer depuis le début'));
        await this.executeFullWorkflow(project);
    }
  }

  private async generateFinalReport(project: Project): Promise<void> {
    const analysisResult = (project as any).analysisResult;
    const totalDuration = project.steps.reduce((acc, step) => acc + step.duration, 0);
    
    const report = `
# 🎉 Migration Terminée : ${project.name}

## 📊 Résumé
- ⏱️  **Durée totale**: ${Math.round(totalDuration / 1000 / 60)}min
- 📂 **Emplacement**: ${project.path}
- 🗄️  **Base de données**: PostgreSQL + Prisma
- 🧪 **Tests**: Playwright E2E avec parcours utilisateur

## 📈 Statistiques de Migration
- 📁 **Fichiers mock analysés**: ${analysisResult?.mockFiles?.length || 0}
- 🔗 **Modèles de données**: ${analysisResult?.dataModels?.length || 0}
- ⚙️  **Fonctionnalités détectées**: ${analysisResult?.features?.length || 0}
- 🧪 **Tests générés**: ${project.steps.find(s => s.step === 'user-testing-complete')?.details?.testsTotal || 0}

## 📋 Étapes Réalisées
${project.steps.map(step => `
### ✅ ${step.step}
- **Durée**: ${Math.round(step.duration / 1000)}s
- **Timestamp**: ${new Date(step.timestamp).toLocaleString()}
- **Succès**: ${step.success !== false ? '✅' : '❌'}
`).join('\n')}

## 🚀 Prochaines Étapes

### Démarrage de l'Application
\`\`\`bash
cd ${project.path}
npm install              # Install dependencies
npm run dev              # Lance l'app en développement
\`\`\`

### Base de Données
\`\`\`bash
npx prisma studio        # Interface graphique DB
npx prisma migrate dev   # Nouvelle migration
npx prisma generate      # Régénérer le client
\`\`\`

### Tests
\`\`\`bash
npm run test:e2e         # Tests utilisateur Playwright
npx playwright show-report  # Rapport de tests
\`\`\`

## 🔧 Configuration Requise

1. **Base de données PostgreSQL**
   - Installer PostgreSQL localement
   - Mettre à jour \`DATABASE_URL\` dans \`.env.local\`

2. **Variables d'environnement**
   - Copier \`.env.local\` et configurer vos valeurs
   - Ajouter vos clés API si nécessaire

## 🎯 Fonctionnalités Migrées

${analysisResult?.dataModels?.map((model: any) => `
### ${model.name}
- **Champs**: ${Object.keys(model.fields).join(', ')}
- **API**: \`/api/${model.name.toLowerCase()}\` (GET, POST, PUT, DELETE)
- **Source**: ${model.mockFile || 'Détecté automatiquement'}
`).join('\n') || 'Aucun modèle détecté'}

## 💾 Sauvegardé en Mémoire
Ce projet est maintenant dans votre espace de travail.
Pour le reprendre plus tard : \`firebase-app-builder continue ${project.name}\`

---
*Migration générée par FirebaseAppBuilder Agent le ${new Date().toLocaleString()}*
*Agent avec mémoire persistante et tests utilisateur réalistes* 🤖
`;
    
    const reportPath = `${project.path}/MIGRATION-REPORT.md`;
    await require('fs-extra').writeFile(reportPath, report);
    
    console.log(chalk.green(`📋 Rapport final généré: ${reportPath}`));
  }

  private async askUserContinue(project: Project): Promise<boolean> {
    const response = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: `Le projet "${project.name}" existe déjà. Continuer où vous vous êtes arrêté ?`,
        default: true
      }
    ]);
    
    return response.continue;
  }

  private isValidGitUrl(url: string): boolean {
    const gitUrlPattern = /^(https?:\/\/)?(github\.com|gitlab\.com|bitbucket\.org)\/[\w\-\.]+\/[\w\-\.]+/;
    return gitUrlPattern.test(url);
  }

  // Nouvelles méthodes de commande
  private async showLogs(): Promise<void> {
    logger.info('Affichage des logs récents');
    
    const logs = await logger.getRecentLogs(24); // 24 heures
    
    if (logs.length === 0) {
      console.log(chalk.gray('Aucun log récent trouvé'));
      return;
    }

    console.log(chalk.bold.cyan('📝 Logs des 24 dernières heures\n'));
    
    logs.forEach(log => {
      const timestamp = chalk.gray(log.timestamp.slice(11, 19));
      const project = log.projectName ? chalk.cyan(`[${log.projectName}]`) : '';
      const step = log.step ? chalk.blue(`{${log.step}}`) : '';
      
      let levelColor: (text: string) => string;
      let prefix: string;
      
      switch (log.level) {
        case 'DEBUG': levelColor = chalk.gray; prefix = '🔍'; break;
        case 'INFO': levelColor = chalk.blue; prefix = 'ℹ️'; break;
        case 'WARN': levelColor = chalk.yellow; prefix = '⚠️'; break;
        case 'ERROR': levelColor = chalk.red; prefix = '❌'; break;
        case 'SUCCESS': levelColor = chalk.green; prefix = '✅'; break;
      }

      console.log(`${timestamp} ${prefix} ${levelColor(log.level)} ${project} ${step} ${log.message}`);
      
      if (log.data && log.level !== 'DEBUG') {
        console.log(chalk.gray('   └─ Data:'), JSON.stringify(log.data, null, 2));
      }
      
      if (log.error) {
        console.log(chalk.red('   └─ Error:'), log.error.message || log.error);
      }
    });

    console.log(chalk.gray(`\nFichier de log: ${logger.getLogFilePath()}`));
  }

  private async showStatus(): Promise<void> {
    logger.info('Affichage du statut de l\'agent');
    
    console.log(chalk.bold.cyan('🤖 Statut de l\'Agent Firebase App Builder\n'));
    
    // État de l'exécution
    const execution = safetyManager.getCurrentExecution();
    if (execution?.isRunning) {
      console.log(chalk.green('🟢 Statut: En cours d\'exécution'));
      console.log(`📂 Projet: ${execution.projectName}`);
      console.log(`🔄 Étape: ${execution.currentStep}`);
      console.log(`⏱️  Durée: ${this.formatDuration(Date.now() - execution.startTime)}`);
      console.log(`🔄 Tentatives: ${execution.retryCount}`);
      
      const heartbeatAge = Date.now() - execution.lastHeartbeat;
      const heartbeatStatus = heartbeatAge < 60000 ? 
        chalk.green('🟢 Actif') : 
        chalk.yellow('🟡 Retard');
      console.log(`💓 Heartbeat: ${heartbeatStatus}`);
    } else {
      console.log(chalk.gray('⚪ Statut: Inactif'));
    }
    
    console.log();
    
    // Statistiques des logs
    const logStats = await logger.getLogStats();
    console.log(chalk.bold.yellow('📈 Statistiques des logs:'));
    console.log(`   Total: ${logStats.totalLogs}`);
    console.log(`   Succès: ${chalk.green(logStats.successCount)}`);
    console.log(`   Avertissements: ${chalk.yellow(logStats.warnCount)}`);
    console.log(`   Erreurs: ${chalk.red(logStats.errorCount)}`);
    
    if (logStats.lastError) {
      console.log(`   Dernière erreur: ${new Date(logStats.lastError.timestamp).toLocaleString()}`);
    }
    
    console.log();
    
    // Projets récents
    try {
      const projectsPath = path.join(os.homedir(), 'firebase-migrations', 'projects.json');
      const fs = await import('fs-extra');
      
      if (await fs.pathExists(projectsPath)) {
        const projects = await fs.readJSON(projectsPath);
        const recentProjects = projects
          .sort((a: any, b: any) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
          .slice(0, 3);
        
        if (recentProjects.length > 0) {
          console.log(chalk.bold.yellow('📁 Projets récents:'));
          recentProjects.forEach((project: any) => {
            const status = this.getProjectStatusIcon(project.status);
            const time = new Date(project.lastActivity).toLocaleDateString();
            console.log(`   ${status} ${project.name} (${project.currentStep}) - ${time}`);
          });
        }
      }
    } catch (error) {
      logger.debug('Erreur lors de la lecture des projets', error);
    }
  }

  private async forceCleanup(): Promise<void> {
    logger.warn('Démarrage du nettoyage forcé');
    
    console.log(chalk.yellow('🧹 Nettoyage forcé en cours...'));
    
    // Arrêter toute exécution en cours
    await safetyManager.forceCleanup();
    
    // Nettoyer les anciens projets
    await this.projectManager.cleanup();
    
    // Nettoyer les logs anciens
    // Cette fonctionnalité sera automatique via le logger
    
    console.log(chalk.green('✅ Nettoyage terminé'));
    logger.success('Nettoyage forcé terminé');
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private getProjectStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return chalk.green('✅');
      case 'error': return chalk.red('❌');
      case 'analyzing': return chalk.blue('🔍');
      case 'migrating': return chalk.yellow('🔄');
      case 'testing': return chalk.cyan('🧪');
      default: return chalk.gray('⚪');
    }
  }
}