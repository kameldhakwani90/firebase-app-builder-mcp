import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Project } from '../types.js';
import chalk from 'chalk';

export class WorkspaceManager {
  private workspaceRoot: string;
  private projectsDB: string;

  constructor() {
    this.workspaceRoot = path.join(os.homedir(), 'firebase-migrations');
    this.projectsDB = path.join(this.workspaceRoot, 'projects.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.workspaceRoot);
    
    if (!await fs.pathExists(this.projectsDB)) {
      await fs.writeJSON(this.projectsDB, [], { spaces: 2 });
    }
  }

  async getProjects(): Promise<Project[]> {
    try {
      return await fs.readJSON(this.projectsDB);
    } catch (error) {
      console.error(chalk.red('❌ Erreur lecture projets:'), error);
      return [];
    }
  }

  async saveProject(project: Project): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex(p => p.name === project.name);
    
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    
    await fs.writeJSON(this.projectsDB, projects, { spaces: 2 });
  }

  async findProject(name: string): Promise<Project | null> {
    const projects = await this.getProjects();
    return projects.find(p => p.name === name) || null;
  }

  async createProjectPath(projectName: string): Promise<string> {
    const projectPath = path.join(this.workspaceRoot, projectName);
    await fs.ensureDir(projectPath);
    return projectPath;
  }

  async listProjects(): Promise<void> {
    const projects = await this.getProjects();
    
    if (projects.length === 0) {
      console.log(chalk.yellow('📂 Aucun projet en cours'));
      console.log(chalk.cyan('💡 Pour démarrer : firebase-app-builder <url-github>'));
      return;
    }

    console.log(chalk.bold('🗂️  Projets en cours :'));
    console.log();
    
    for (const project of projects) {
      const statusIcon = this.getStatusIcon(project.status);
      const duration = this.calculateDuration(project);
      
      console.log(chalk.bold(`${statusIcon} ${project.name}`));
      console.log(chalk.gray(`   📂 ${project.path}`));
      console.log(chalk.gray(`   🕒 Dernière activité: ${new Date(project.lastActivity).toLocaleString()}`));
      console.log(chalk.gray(`   📊 Étape: ${project.currentStep} (${duration})`));
      console.log(chalk.gray(`   🔗 ${project.url}`));
      console.log();
    }
    
    console.log(chalk.cyan('💡 Pour continuer : firebase-app-builder continue <nom>'));
    console.log(chalk.cyan('💡 Pour nouveau projet : firebase-app-builder <url-github>'));
  }

  private getStatusIcon(status: Project['status']): string {
    const icons = {
      started: '🟡',
      cloning: '🔄',
      analyzing: '🔍',
      migrating: '⚙️',
      testing: '🧪',
      completed: '✅',
      error: '❌'
    };
    return icons[status] || '🔵';
  }

  private calculateDuration(project: Project): string {
    if (project.completedAt) {
      const start = new Date(project.steps[0]?.timestamp || project.lastActivity);
      const end = new Date(project.completedAt);
      const duration = Math.round((end.getTime() - start.getTime()) / 1000 / 60);
      return `${duration}min`;
    }
    
    const totalDuration = project.steps.reduce((acc, step) => acc + (step.duration || 0), 0);
    return `${Math.round(totalDuration / 1000 / 60)}min`;
  }

  extractProjectName(repoUrl: string): string {
    // Extrait le nom du projet depuis l'URL GitHub
    const match = repoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
    if (match) {
      return match[1].replace(/\.git$/, '');
    }
    
    // Fallback pour d'autres formats
    const urlParts = repoUrl.split('/');
    return urlParts[urlParts.length - 1].replace(/\.git$/, '');
  }

  async cleanupOldProjects(maxAge: number = 30): Promise<void> {
    const projects = await this.getProjects();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);
    
    const activeProjects = projects.filter(project => {
      const lastActivity = new Date(project.lastActivity);
      return lastActivity > cutoffDate;
    });
    
    if (activeProjects.length !== projects.length) {
      console.log(chalk.yellow(`🗑️  Nettoyage de ${projects.length - activeProjects.length} anciens projets`));
      await fs.writeJSON(this.projectsDB, activeProjects, { spaces: 2 });
    }
  }
}