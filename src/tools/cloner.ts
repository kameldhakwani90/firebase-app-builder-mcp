import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { Project } from '../types.js';

export class GitCloner {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  async cloneRepository(project: Project): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(chalk.blue(`🔄 Clonage de ${project.url}...`));
      
      // Vérifier si le dossier existe déjà
      if (await fs.pathExists(project.path)) {
        const files = await fs.readdir(project.path);
        if (files.length > 0) {
          console.log(chalk.yellow(`📁 Le projet existe déjà dans ${project.path}`));
          return { success: true };
        }
      }

      // Cloner le repository
      await this.git.clone(project.url, project.path);
      
      console.log(chalk.green('✅ Clonage réussi'));
      return { success: true };
      
    } catch (error: any) {
      const errorMessage = `Erreur de clonage: ${error.message}`;
      console.error(chalk.red(`❌ ${errorMessage}`));
      return { success: false, error: errorMessage };
    }
  }

  async createBranch(projectPath: string, branchName: string): Promise<boolean> {
    try {
      const gitRepo = simpleGit(projectPath);
      
      // Vérifier si la branche existe déjà
      const branches = await gitRepo.branchLocal();
      if (branches.all.includes(branchName)) {
        console.log(chalk.yellow(`🌿 Branche ${branchName} existe déjà`));
        await gitRepo.checkout(branchName);
        return true;
      }
      
      // Créer et basculer vers la nouvelle branche
      await gitRepo.checkoutLocalBranch(branchName);
      console.log(chalk.green(`🌿 Branche ${branchName} créée`));
      
      return true;
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur création branche: ${error.message}`));
      return false;
    }
  }

  async commitChanges(projectPath: string, message: string): Promise<boolean> {
    try {
      const gitRepo = simpleGit(projectPath);
      
      // Ajouter tous les fichiers modifiés
      await gitRepo.add('.');
      
      // Vérifier s'il y a des changements à commiter
      const status = await gitRepo.status();
      if (status.files.length === 0) {
        console.log(chalk.yellow('📝 Aucun changement à commiter'));
        return true;
      }
      
      // Commiter les changements
      await gitRepo.commit(message);
      console.log(chalk.green(`📝 Commit créé: ${message}`));
      
      return true;
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur commit: ${error.message}`));
      return false;
    }
  }

  async getProjectInfo(projectPath: string): Promise<{
    currentBranch: string;
    lastCommit: string;
    hasChanges: boolean;
    remoteUrl: string;
  }> {
    try {
      const gitRepo = simpleGit(projectPath);
      
      const status = await gitRepo.status();
      const branch = await gitRepo.branch();
      const log = await gitRepo.log({ maxCount: 1 });
      const remotes = await gitRepo.getRemotes(true);
      
      return {
        currentBranch: branch.current,
        lastCommit: log.latest?.message || 'Aucun commit',
        hasChanges: status.files.length > 0,
        remoteUrl: remotes[0]?.refs?.fetch || 'Aucun remote'
      };
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur info projet: ${error.message}`));
      return {
        currentBranch: 'unknown',
        lastCommit: 'unknown',
        hasChanges: false,
        remoteUrl: 'unknown'
      };
    }
  }

  async ensureGitRepository(projectPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(projectPath, '.git');
      
      if (!await fs.pathExists(gitDir)) {
        console.log(chalk.blue('🔧 Initialisation du repository Git...'));
        const gitRepo = simpleGit(projectPath);
        await gitRepo.init();
        console.log(chalk.green('✅ Repository Git initialisé'));
      }
      
      return true;
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur initialisation Git: ${error.message}`));
      return false;
    }
  }

  async checkoutBranch(projectPath: string, branchName: string): Promise<boolean> {
    try {
      const gitRepo = simpleGit(projectPath);
      await gitRepo.checkout(branchName);
      console.log(chalk.green(`🔄 Basculé vers la branche ${branchName}`));
      return true;
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur checkout: ${error.message}`));
      return false;
    }
  }

  async pullLatest(projectPath: string): Promise<boolean> {
    try {
      const gitRepo = simpleGit(projectPath);
      await gitRepo.pull();
      console.log(chalk.green('🔄 Repository mis à jour'));
      return true;
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur pull: ${error.message}`));
      return false;
    }
  }

  async pushChanges(projectPath: string, branchName?: string): Promise<boolean> {
    try {
      const gitRepo = simpleGit(projectPath);
      
      if (branchName) {
        await gitRepo.push('origin', branchName);
      } else {
        await gitRepo.push();
      }
      
      console.log(chalk.green('🚀 Changements poussés vers le remote'));
      return true;
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur push: ${error.message}`));
      return false;
    }
  }
}