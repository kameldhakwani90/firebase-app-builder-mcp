import { Project, ProjectStep } from '../types.js';
import { WorkspaceManager } from './workspace.js';
import chalk from 'chalk';

export class ProjectManager {
  private workspace: WorkspaceManager;

  constructor() {
    this.workspace = new WorkspaceManager();
  }

  async initialize(): Promise<void> {
    await this.workspace.initialize();
  }

  async saveProgress(project: Project, step: string, details: any, duration: number = 0): Promise<void> {
    project.currentStep = step;
    project.lastActivity = new Date().toISOString();
    
    const projectStep: ProjectStep = {
      step,
      details,
      timestamp: new Date().toISOString(),
      duration,
      success: !details.error
    };
    
    if (details.error) {
      projectStep.error = details.error;
      project.status = 'error';
    }
    
    project.steps.push(projectStep);
    
    await this.workspace.saveProject(project);
    
    const durationText = duration > 0 ? ` (${Math.round(duration / 1000)}s)` : '';
    console.log(chalk.green(`💾 Progression sauvée: ${step}${durationText}`));
  }

  async createProject(repoUrl: string): Promise<Project> {
    const projectName = this.workspace.extractProjectName(repoUrl);
    const projectPath = await this.workspace.createProjectPath(projectName);
    
    const project: Project = {
      name: projectName,
      url: repoUrl,
      path: projectPath,
      status: 'started',
      currentStep: 'initialization',
      lastActivity: new Date().toISOString(),
      steps: []
    };
    
    await this.workspace.saveProject(project);
    
    console.log(chalk.blue(`📁 Nouveau projet créé: ${projectName}`));
    console.log(chalk.gray(`📂 Emplacement: ${projectPath}`));
    
    return project;
  }

  async resumeProject(projectName: string): Promise<Project | null> {
    const project = await this.workspace.findProject(projectName);
    
    if (!project) {
      console.log(chalk.red(`❌ Projet "${projectName}" introuvable`));
      return null;
    }
    
    console.log(chalk.blue(`🔄 Reprise du projet: ${project.name}`));
    console.log(chalk.gray(`📍 Dernière étape: ${project.currentStep}`));
    console.log(chalk.gray(`🕒 ${new Date(project.lastActivity).toLocaleString()}`));
    
    this.displayProjectSummary(project);
    
    return project;
  }

  async checkExistingProject(repoUrl: string): Promise<Project | null> {
    const projectName = this.workspace.extractProjectName(repoUrl);
    return await this.workspace.findProject(projectName);
  }

  private displayProjectSummary(project: Project): void {
    console.log(chalk.bold('\n📊 Résumé du projet:'));
    
    const completedSteps = project.steps.filter(s => s.success !== false).length;
    const totalSteps = project.steps.length;
    const lastError = project.steps.find(s => s.error);
    
    console.log(chalk.gray(`   ✅ Étapes complétées: ${completedSteps}/${totalSteps}`));
    
    if (lastError) {
      console.log(chalk.red(`   ❌ Dernière erreur: ${lastError.error}`));
    }
    
    const totalDuration = project.steps.reduce((acc, step) => acc + step.duration, 0);
    console.log(chalk.gray(`   ⏱️  Temps total: ${Math.round(totalDuration / 1000 / 60)}min`));
    
    if (project.steps.length > 0) {
      console.log(chalk.bold('\n📈 Historique des étapes:'));
      project.steps.slice(-5).forEach((step, index) => {
        const icon = step.success !== false ? '✅' : '❌';
        const time = new Date(step.timestamp).toLocaleTimeString();
        console.log(chalk.gray(`   ${icon} ${step.step} (${time})`));
      });
    }
    
    console.log();
  }

  async markCompleted(project: Project, details: any = {}): Promise<void> {
    project.status = 'completed';
    project.completedAt = new Date().toISOString();
    
    await this.saveProgress(project, 'completed', { 
      success: true, 
      totalSteps: project.steps.length,
      ...details 
    });
    
    console.log(chalk.green.bold('🎉 Migration terminée et sauvée en mémoire !'));
    console.log(chalk.cyan(`📂 Projet disponible dans: ${project.path}`));
    
    this.generateCompletionReport(project);
  }

  private generateCompletionReport(project: Project): void {
    const totalDuration = project.steps.reduce((acc, step) => acc + step.duration, 0);
    const successfulSteps = project.steps.filter(s => s.success !== false).length;
    
    console.log(chalk.bold('\n🎯 Rapport Final:'));
    console.log(chalk.gray(`   📊 ${successfulSteps}/${project.steps.length} étapes réussies`));
    console.log(chalk.gray(`   ⏱️  Durée totale: ${Math.round(totalDuration / 1000 / 60)}min`));
    console.log(chalk.gray(`   🗄️  Base de données: PostgreSQL + Prisma`));
    console.log(chalk.gray(`   🧪 Tests: Playwright E2E avec parcours utilisateur`));
    console.log(chalk.cyan('\n🚀 Commandes utiles:'));
    console.log(chalk.cyan(`   cd ${project.path}`));
    console.log(chalk.cyan('   npm run dev              # Lance l\'app'));
    console.log(chalk.cyan('   npx prisma studio        # Interface DB'));
    console.log(chalk.cyan('   npm run test:e2e         # Tests utilisateur'));
  }

  async listProjects(): Promise<void> {
    await this.workspace.listProjects();
  }

  async deleteProject(name: string): Promise<boolean> {
    return await this.workspace.deleteProject(name);
  }

  async cleanup(): Promise<void> {
    await this.workspace.cleanupOldProjects();
  }
}