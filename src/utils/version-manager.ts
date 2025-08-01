import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

export class VersionManager {
  
  async checkNodeVersion(): Promise<VersionInfo> {
    try {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      return this.parseVersion(version);
    } catch (error) {
      throw new Error('Node.js n\'est pas installé ou accessible');
    }
  }

  async checkNpmVersion(): Promise<VersionInfo> {
    // Essayer plusieurs commandes npm selon l'environnement
    const commands = [
      'npm --version',           // Standard Unix/Linux et MINGW
      'npm.cmd --version',       // Windows CMD
      'npx --version'            // Fallback avec npx
    ];

    for (const command of commands) {
      try {
        const { stdout } = await execAsync(command);
        const version = stdout.trim();
        if (version && /^\d+\.\d+\.\d+/.test(version)) {
          return this.parseVersion(version);
        }
      } catch (error) {
        // Continuer avec la commande suivante
        continue;
      }
    }
    
    throw new Error('npm n\'est pas installé ou accessible. Vérifiez votre installation Node.js.');
  }

  async checkPrismaVersion(projectPath: string): Promise<VersionInfo | null> {
    const commands = [
      'npx prisma --version',     // Standard
      'npx.cmd prisma --version'  // Windows CMD
    ];

    for (const command of commands) {
      try {
        const { stdout } = await execAsync(command, { cwd: projectPath });
        
        // Prisma CLI affiche plusieurs lignes, on cherche la ligne avec la version
        const lines = stdout.split('\n');
        const versionLine = lines.find(line => line.includes('prisma'));
        
        if (versionLine) {
          const match = versionLine.match(/(\d+\.\d+\.\d+)/);
          if (match) {
            return this.parseVersion(match[1]);
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return null; // Prisma n'est pas installé
  }

  private parseVersion(versionString: string): VersionInfo {
    const cleanVersion = versionString.replace(/^v/, '');
    const parts = cleanVersion.split('.');
    
    if (parts.length < 3) {
      throw new Error(`Version invalide: ${versionString}`);
    }
    
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    const patch = parseInt(parts[2]);
    
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      throw new Error(`Version invalide: ${versionString}`);
    }
    
    return {
      version: cleanVersion,
      major,
      minor,
      patch
    };
  }

  isVersionCompatible(current: VersionInfo, minimum: VersionInfo): boolean {
    if (current.major > minimum.major) return true;
    if (current.major < minimum.major) return false;
    
    if (current.minor > minimum.minor) return true;
    if (current.minor < minimum.minor) return false;
    
    return current.patch >= minimum.patch;
  }

  async validateEnvironment(): Promise<{
    node: VersionInfo;
    npm: VersionInfo;
    compatible: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Versions minimales requises
    const minNode = { version: '18.0.0', major: 18, minor: 0, patch: 0 };
    const minNpm = { version: '8.0.0', major: 8, minor: 0, patch: 0 };
    
    let node: VersionInfo;
    let npm: VersionInfo;
    
    try {
      node = await this.checkNodeVersion();
      console.log(chalk.green(`✅ Node.js détecté: v${node.version}`));
      
      if (!this.isVersionCompatible(node, minNode)) {
        issues.push(`Node.js v${node.version} < v${minNode.version} (minimum requis)`);
      }
    } catch (error: any) {
      issues.push(`Node.js: ${error.message}`);
      node = { version: '0.0.0', major: 0, minor: 0, patch: 0 };
    }
    
    try {
      npm = await this.checkNpmVersion();
      console.log(chalk.green(`✅ npm détecté: v${npm.version}`));
      
      if (!this.isVersionCompatible(npm, minNpm)) {
        issues.push(`npm v${npm.version} < v${minNpm.version} (minimum requis)`);
      }
    } catch (error: any) {
      issues.push(`npm: ${error.message}`);
      npm = { version: '0.0.0', major: 0, minor: 0, patch: 0 };
    }
    
    const compatible = issues.length === 0;
    
    if (!compatible) {
      console.log(chalk.red('❌ Problèmes détectés:'));
      issues.forEach(issue => console.log(chalk.red(`   • ${issue}`)));
      console.log(chalk.yellow('\n💡 Suggestions:'));
      console.log(chalk.yellow('   • Mettez à jour Node.js: https://nodejs.org/'));
      console.log(chalk.yellow('   • Mettez à jour npm: npm install -g npm@latest'));
    } else {
      console.log(chalk.green('✅ Environnement compatible'));
    }
    
    return { node, npm, compatible, issues };
  }

  async getRecommendedPrismaVersion(): Promise<string> {
    const commands = [
      'npm view prisma version',
      'npm.cmd view prisma version'
    ];

    for (const command of commands) {
      try {
        const { stdout } = await execAsync(command);
        const latestVersion = stdout.trim();
        
        if (latestVersion && /^\d+\.\d+\.\d+/.test(latestVersion)) {
          console.log(chalk.blue(`📦 Dernière version Prisma: v${latestVersion}`));
          return latestVersion;
        }
      } catch (error) {
        continue;
      }
    }
    
    // Version par défaut si on ne peut pas récupérer la dernière
    console.log(chalk.yellow('⚠️  Impossible de vérifier la dernière version Prisma, utilisation de la version par défaut'));
    return '5.7.0'; // Version stable connue
  }

  async installSpecificPrismaVersion(projectPath: string, version?: string): Promise<void> {
    const targetVersion = version || await this.getRecommendedPrismaVersion();
    
    console.log(chalk.blue(`📦 Installation de Prisma v${targetVersion}...`));
    
    const packages = [
      `prisma@${targetVersion}`,
      `@prisma/client@${targetVersion}`
    ];
    
    const commands = [
      `npm install ${packages.join(' ')}`,
      `npm.cmd install ${packages.join(' ')}`
    ];
      
    for (const command of commands) {
      try {
        const { stdout, stderr } = await execAsync(command, { 
          cwd: projectPath,
          timeout: 180000 // 3 minutes
        });
        
        if (stderr && !stderr.includes('WARN')) {
          console.log(chalk.yellow(`⚠️ Avertissements: ${stderr}`));
        }
        
        console.log(chalk.green(`✅ Prisma v${targetVersion} installé`));
        return; // Installation réussie
      } catch (error: any) {
        continue; // Essayer la commande suivante
      }
    }
    
    throw new Error(`Installation Prisma v${targetVersion} échouée sur toutes les tentatives`);
  }
}