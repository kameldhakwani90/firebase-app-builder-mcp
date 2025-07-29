import chalk from 'chalk';
import inquirer from 'inquirer';
import { ProjectManager } from './memory/projects.js';
import { GitCloner } from './tools/cloner.js';
import { IntelligentAnalyzer } from './tools/intelligent-analyzer.js';
import { DatabaseMigrator } from './tools/database.js';
import { RealisticTester } from './tools/tester.js';
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
      // Nettoyage des anciens projets
      await this.projectManager.cleanup();

      if (args.length === 0) {
        // Afficher les projets existants
        await this.projectManager.listProjects();
        return;
      }

      if (args[0] === 'continue' && args[1]) {
        // Continuer un projet existant
        await this.continueProject(args[1]);
        return;
      }

      // Nouveau projet
      const repoUrl = args[0];
      if (!this.isValidGitUrl(repoUrl)) {
        console.error(chalk.red('❌ URL Git invalide'));
        return;
      }

      await this.startNewProject(repoUrl);

    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur: ${error.message}`));
      process.exit(1);
    }
  }

  private async startNewProject(repoUrl: string): Promise<void> {
    console.log(chalk.bold.green('🎯 Démarrage d\'un nouveau projet de migration'));
    
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
    
    // Exécuter le workflow complet
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
      // Étape 1: Clone et analyse
      await this.step1_cloneAndAnalyze(project);
      
      // Étape 2: Migration base de données
      await this.step2_databaseMigration(project);
      
      // Étape 3: Tests utilisateur réalistes
      await this.step3_userTesting(project);
      
      // Étape 4: Finalisation
      await this.step4_finalization(project);
      
      // Marquer comme terminé
      const totalDuration = Date.now() - startTime;
      await this.projectManager.markCompleted(project, { 
        totalDuration,
        workflow: 'complete'
      });

    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur workflow: ${error.message}`));
      await this.projectManager.saveProgress(project, 'error', { 
        error: error.message 
      });
    }
  }

  private async step1_cloneAndAnalyze(project: Project): Promise<void> {
    console.log(chalk.bold.blue('📥 Étape 1: Clone et analyse'));
    const stepStart = Date.now();
    
    // Clone du repository
    project.status = 'cloning';
    const cloneResult = await this.gitCloner.cloneRepository(project);
    if (!cloneResult.success) {
      throw new Error(cloneResult.error);
    }

    // Analyse intelligente du projet avec Claude
    project.status = 'analyzing';
    const analysisResult = await this.analyzer.analyzeProject(project.path);
    
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
}