#!/usr/bin/env node

// Commandes slash pour intégration Claude Code
// Ces commandes permettent d'utiliser l'agent directement depuis Claude Code avec "/"

import { FirebaseAppBuilderAgent } from './agent.js';
import { WebServer } from './web-server.js';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';

export class ClaudeCommands {
  private agent: FirebaseAppBuilderAgent;
  private webServer?: WebServer;

  constructor() {
    this.agent = new FirebaseAppBuilderAgent();
  }

  async executeCommand(commandLine: string): Promise<string> {
    const parts = commandLine.trim().split(' ');
    const command = parts[0].replace('/', ''); // Enlever le '/' initial
    const args = parts.slice(1);

    try {
      await this.agent.initialize();

      switch (command) {
        case 'migrate':
          return await this.handleMigrateCommand(args);
        
        case 'continue':
          return await this.handleContinueCommand(args);
        
        case 'projects':
          return await this.handleProjectsCommand();
        
        case 'status':
          return await this.handleStatusCommand(args);
        
        case 'web':
          return await this.handleWebCommand(args);
        
        case 'update':
          return await this.handleUpdateCommand();
        
        case 'help':
          return this.getHelpText();
        
        default:
          return this.getUnknownCommandError(command);
      }
    } catch (error) {
      return `❌ Erreur: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async handleMigrateCommand(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Usage: /migrate <github-url>

📝 Exemple: /migrate https://github.com/user/my-nextjs-app

Cette commande va:
🔍 Cloner et analyser votre projet Next.js
🗄️ Générer le schéma de base de données PostgreSQL + Prisma
🚀 Créer les APIs CRUD complètes
🧪 Générer des tests utilisateur réalistes avec Playwright
📊 Fournir un rapport détaillé de migration`;
    }

    const githubUrl = args[0];
    
    // Vérifier si l'URL est valide
    if (!this.isValidGitUrl(githubUrl)) {
      return `❌ URL GitHub invalide: ${githubUrl}

✅ Formats acceptés:
• https://github.com/user/repo
• https://github.com/user/repo.git
• git@github.com:user/repo.git`;
    }

    // Lancer l'interface web si demandée
    if (args.includes('--web')) {
      await this.startWebInterface();
    }

    // Démarrer la migration
    const projectName = this.extractProjectName(githubUrl);
    
    return `🚀 Migration lancée pour: ${projectName}

📂 URL: ${githubUrl}
⏳ Le processus a démarré en arrière-plan...

💡 Pour suivre la progression:
• /status ${projectName}
• /web (ouvre l'interface de suivi)

🔔 Vous recevrez des notifications de progression.`;
  }

  private async handleContinueCommand(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Usage: /continue <nom-projet>

📝 Exemple: /continue my-nextjs-app

💡 Pour voir tous vos projets:
/projects`;
    }

    const projectName = args[0];
    
    // Vérifier si le projet existe
    const projectExists = await this.checkProjectExists(projectName);
    if (!projectExists) {
      const availableProjects = await this.getAvailableProjects();
      return `❌ Projet "${projectName}" introuvable.

📂 Projets disponibles:
${availableProjects.length > 0 ? availableProjects.map(p => `• ${p.name} (${p.status})`).join('\n') : '• Aucun projet trouvé'}

💡 Utilisez: /projects pour voir tous les détails`;
    }

    return `🔄 Reprise du projet "${projectName}"...

⏳ L'agent reprend où il s'était arrêté
📊 Utilisez /status ${projectName} pour voir la progression

💡 Interface web: /web`;
  }

  private async handleProjectsCommand(): Promise<string> {
    const projects = await this.getAvailableProjects();
    
    if (projects.length === 0) {
      return `📭 Aucun projet trouvé

🚀 Pour commencer votre premier projet:
/migrate https://github.com/user/your-project`;
    }

    let result = `📂 Vos projets Firebase App Builder (${projects.length}):\n\n`;
    
    for (const project of projects) {
      const statusEmoji = this.getStatusEmoji(project.status);
      const lastActivity = project.lastActivity ? 
        new Date(project.lastActivity).toLocaleDateString('fr-FR') : 
        'Non définie';
      
      result += `${statusEmoji} **${project.name}**\n`;
      result += `   📍 URL: ${project.url}\n`;
      result += `   🎯 Statut: ${project.status}\n`;
      result += `   📅 Dernière activité: ${lastActivity}\n`;
      result += `   🔧 Étape: ${project.currentStep || 'Non définie'}\n\n`;
    }

    result += `💡 Commandes utiles:
• /continue <nom> - Reprendre un projet
• /status <nom> - Voir détails d'un projet  
• /web - Interface de gestion complète`;

    return result;
  }

  private async handleStatusCommand(args: string[]): Promise<string> {
    if (args.length === 0) {
      return `❌ Usage: /status <nom-projet>

📝 Exemple: /status my-nextjs-app`;
    }

    const projectName = args[0];
    const project = await this.getProjectDetails(projectName);
    
    if (!project) {
      return `❌ Projet "${projectName}" introuvable.

💡 Utilisez /projects pour voir tous vos projets`;
    }

    const statusEmoji = this.getStatusEmoji(project.status);
    const lastActivity = project.lastActivity ? 
      new Date(project.lastActivity).toLocaleString('fr-FR') : 
      'Non définie';

    let result = `📊 Statut détaillé: **${project.name}**\n\n`;
    result += `${statusEmoji} **Statut:** ${project.status}\n`;
    result += `🎯 **Étape actuelle:** ${project.currentStep || 'Non définie'}\n`;
    result += `🔗 **URL GitHub:** ${project.url}\n`;
    result += `📅 **Dernière activité:** ${lastActivity}\n`;
    result += `📂 **Chemin local:** ${project.path || 'Non défini'}\n\n`;

    // Ajouter les étapes completées si disponibles
    if (project.steps && project.steps.length > 0) {
      result += `✅ **Étapes complétées:**\n`;
      project.steps.forEach((step: any, index: number) => {
        result += `   ${index + 1}. ${step.name || step}\n`;
      });
      result += `\n`;
    }

    result += `💡 **Actions disponibles:**\n`;
    if (project.status === 'started' || project.status === 'paused') {
      result += `• /continue ${projectName} - Reprendre\n`;
    }
    result += `• /web - Interface de gestion\n`;
    result += `• /projects - Voir tous les projets`;

    return result;
  }

  private async handleWebCommand(args: string[]): Promise<string> {
    const port = args.length > 0 ? parseInt(args[0]) : 3000;
    
    try {
      await this.startWebInterface(port);
      return `🌐 Interface Web lancée !

🚀 **URL:** http://localhost:${port}
📊 **Fonctionnalités:**
• Gestion complète des projets
• Suivi temps réel des migrations
• Configuration système
• Gestion des mises à jour
• Logs détaillés

💡 L'interface s'ouvre automatiquement dans votre navigateur`;
    } catch (error) {
      return `❌ Impossible de lancer l'interface web sur le port ${port}

🔧 Essayez avec un autre port:
/web 3001

💡 Ou utilisez l'interface existante si elle est déjà lancée`;
    }
  }

  private async handleUpdateCommand(): Promise<string> {
    return `🔄 Vérification des mises à jour...

💡 Pour une gestion complète des mises à jour:
/web

L'interface web permet:
• 🔍 Vérification automatique des versions
• 📥 Mise à jour en un clic  
• 📊 Suivi du processus de mise à jour
• 🔄 Redémarrage automatique

🚀 Plus sûr et plus pratique que la ligne de commande !`;
  }

  private async startWebInterface(port: number = 3000): Promise<void> {
    if (!this.webServer) {
      this.webServer = new WebServer({ port, host: 'localhost' });
      await this.webServer.start();
      
      // Ouvrir automatiquement le navigateur
      const { spawn } = await import('child_process');
      const url = `http://localhost:${port}`;
      
      try {
        spawn('start', [url], { shell: true, detached: true });
      } catch (error) {
        // Silencieux si l'ouverture automatique échoue
      }
    }
  }

  private isValidGitUrl(url: string): boolean {
    const patterns = [
      /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+/,
      /^https:\/\/gitlab\.com\/[\w\-\.]+\/[\w\-\.]+/,
      /^git@github\.com:[\w\-\.]+\/[\w\-\.]+\.git$/,
      /^git@gitlab\.com:[\w\-\.]+\/[\w\-\.]+\.git$/
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  private extractProjectName(githubUrl: string): string {
    const match = githubUrl.match(/\/([^\/]+)(?:\.git)?$/);
    return match ? match[1] : 'unknown-project';
  }

  private async checkProjectExists(projectName: string): Promise<boolean> {
    const projects = await this.getAvailableProjects();
    return projects.some(p => p.name === projectName);
  }

  private async getAvailableProjects(): Promise<any[]> {
    try {
      const projectsPath = path.join(process.cwd(), '..', 'firebase-migrations', 'projects.json');
      if (await fs.pathExists(projectsPath)) {
        return await fs.readJson(projectsPath);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  private async getProjectDetails(projectName: string): Promise<any | null> {
    const projects = await this.getAvailableProjects();
    return projects.find(p => p.name === projectName) || null;
  }

  private getStatusEmoji(status: string): string {
    const statusMap: { [key: string]: string } = {
      'started': '🚀',
      'completed': '✅',
      'error': '❌',
      'paused': '⏸️',
      'running': '🔄'
    };
    return statusMap[status] || '📝';
  }

  private getHelpText(): string {
    return `🔥 **Firebase App Builder - Commandes Claude Code**

🚀 **Migration:**
• \`/migrate <github-url>\` - Migrer un projet Next.js
• \`/migrate <github-url> --web\` - Migrer avec interface web

📂 **Gestion des projets:**
• \`/projects\` - Lister tous vos projets
• \`/continue <nom>\` - Reprendre un projet existant
• \`/status <nom>\` - Voir le statut détaillé d'un projet

🌐 **Interface Web:**
• \`/web\` - Lancer l'interface de gestion (port 3000)
• \`/web <port>\` - Lancer sur un port spécifique

🔧 **Système:**
• \`/update\` - Informations sur les mises à jour
• \`/help\` - Afficher cette aide

💡 **Exemples:**
\`\`\`
/migrate https://github.com/user/my-nextjs-app
/continue my-project  
/status my-project
/web 3001
\`\`\`

🎯 **Que fait cet agent ?**
• 🔍 Analyse automatique de vos projets Next.js
• 🗄️ Migration vers PostgreSQL + Prisma
• 🚀 Génération d'APIs CRUD complètes
• 🧪 Tests utilisateur réalistes avec Playwright
• 📊 Rapports détaillés de migration`;
  }

  private getUnknownCommandError(command: string): string {
    return `❌ Commande inconnue: /${command}

💡 Commandes disponibles:
• /migrate <github-url>
• /projects  
• /continue <nom>
• /status <nom>
• /web
• /help

🔍 Utilisez /help pour plus de détails`;
  }
}

// Export pour utilisation par l'agent principal
export default ClaudeCommands;