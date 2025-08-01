#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { FirebaseAppBuilderAgent } from './agent.js';

class FirebaseAppBuilderMCPServer {
  private server: Server;
  private agent: FirebaseAppBuilderAgent;

  constructor() {
    this.server = new Server(
      {
        name: 'firebase-app-builder',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.agent = new FirebaseAppBuilderAgent();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'migrate_project',
            description: 'Migre un projet Next.js avec mocks vers PostgreSQL + Prisma avec tests utilisateur réalistes',
            inputSchema: {
              type: 'object',
              properties: {
                repo_url: {
                  type: 'string',
                  description: 'URL du repository GitHub à migrer (ex: https://github.com/user/project)'
                }
              },
              required: ['repo_url']
            }
          },
          {
            name: 'continue_project',
            description: 'Continue un projet de migration existant où il s\'est arrêté',
            inputSchema: {
              type: 'object',
              properties: {
                project_name: {
                  type: 'string',
                  description: 'Nom du projet à continuer'
                }
              },
              required: ['project_name']
            }
          },
          {
            name: 'list_projects',
            description: 'Liste tous les projets de migration (en cours et terminés)',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'get_project_status',
            description: 'Obtient le statut détaillé d\'un projet spécifique',
            inputSchema: {
              type: 'object',
              properties: {
                project_name: {
                  type: 'string',
                  description: 'Nom du projet'
                }
              },
              required: ['project_name']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'migrate_project':
            return await this.handleMigrateProject(args as { repo_url: string });

          case 'continue_project':
            return await this.handleContinueProject(args as { project_name: string });

          case 'list_projects':
            return await this.handleListProjects();

          case 'get_project_status':
            return await this.handleGetProjectStatus(args as { project_name: string });

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
      }
    });
  }

  private async handleMigrateProject(args: { repo_url: string }) {
    try {
      await this.agent.initialize();
      
      // Validation de l'URL
      if (!this.isValidGitUrl(args.repo_url)) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ URL Git invalide: ${args.repo_url}\n\nFormats acceptés:\n- https://github.com/user/repo\n- https://gitlab.com/user/repo\n- https://bitbucket.org/user/repo`
            }
          ]
        };
      }

      // Démarrer la migration
      const result = await this.startMigration(args.repo_url);
      
      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Erreur lors de la migration: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleContinueProject(args: { project_name: string }) {
    try {
      await this.agent.initialize();
      const result = await this.continueExistingProject(args.project_name);
      
      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Erreur: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleListProjects() {
    try {
      await this.agent.initialize();
      const projects = await this.getProjectsList();
      
      // Message d'accueil avec instructions interface web
      const welcomeMessage = `📂 Liste des projets:

🌐 Interface Web Firebase App Builder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ IMPORTANTE : L'interface web est maintenant active !

🚀 Pour une expérience optimale :
   • Ouvrez http://localhost:3000 dans votre navigateur
   • L'interface web prend en charge TOUTES vos commandes
   • Elle vous permet de valider automatiquement la création des fichiers
   • Vous avez une zone de description pour expliquer votre projet

💡 Avantages de l'interface web :
   ✓ Suivi temps réel avec notifications visuelles  
   ✓ Validation automatique des créations de fichiers
   ✓ Description intelligente du projet pour analyses précises
   ✓ Test de connexion base SQL intégré
   ✓ Synchronisation complète avec Claude Code

🔗 Continuez depuis l'interface web : http://localhost:3000

${projects}`;
      
      return {
        content: [
          {
            type: 'text',
            text: welcomeMessage
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Erreur: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleGetProjectStatus(args: { project_name: string }) {
    try {
      await this.agent.initialize();
      const status = await this.getProjectStatusDetails(args.project_name);
      
      return {
        content: [
          {
            type: 'text',
            text: status
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Erreur: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async startMigration(repoUrl: string): Promise<string> {
    return new Promise((resolve) => {
      // Capturer les logs de l'agent
      const originalLog = console.log;
      const originalError = console.error;
      const logs: string[] = [];

      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };

      console.error = (...args) => {
        logs.push(`ERROR: ${args.join(' ')}`);
        originalError(...args);
      };

      // Lancer la migration de manière asynchrone
      this.agent.run([repoUrl]).then(() => {
        console.log = originalLog;
        console.error = originalError;
        
        const result = `🎉 Migration lancée avec succès!\n\n📋 Logs:\n${logs.join('\n')}\n\n💡 Pour suivre le progress, utilisez: get_project_status`;
        resolve(result);
      }).catch((error) => {
        console.log = originalLog;
        console.error = originalError;
        
        const result = `❌ Erreur pendant la migration:\n\n${error.message}\n\n📋 Logs:\n${logs.join('\n')}`;
        resolve(result);
      });

      // Retourner immédiatement avec un statut de démarrage
      setTimeout(() => {
        resolve(`🚀 Migration en cours pour: ${repoUrl}\n\n⏳ Le processus a démarré en arrière-plan...\n\n📋 Logs actuels:\n${logs.join('\n')}\n\n💡 Utilisez get_project_status pour voir l'avancement`);
      }, 2000);
    });
  }

  private async continueExistingProject(projectName: string): Promise<string> {
    return new Promise((resolve) => {
      const logs: string[] = [];
      const originalLog = console.log;
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };

      this.agent.run(['continue', projectName]).then(() => {
        console.log = originalLog;
        resolve(`✅ Projet "${projectName}" repris avec succès!\n\n📋 Logs:\n${logs.join('\n')}`);
      }).catch((error) => {
        console.log = originalLog;
        resolve(`❌ Erreur: ${error.message}\n\n📋 Logs:\n${logs.join('\n')}`);
      });

      // Statut immédiat
      setTimeout(() => {
        resolve(`🔄 Reprise du projet "${projectName}" en cours...\n\n📋 Logs:\n${logs.join('\n')}`);
      }, 1000);
    });
  }

  private async getProjectsList(): Promise<string> {
    const logs: string[] = [];
    const originalLog = console.log;
    
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      await this.agent.run([]);
      console.log = originalLog;
      
      return `📂 Liste des projets:\n\n${logs.join('\n')}`;
    } catch (error) {
      console.log = originalLog;
      return `❌ Erreur lors de la récupération des projets: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async getProjectStatusDetails(projectName: string): Promise<string> {
    // Cette méthode nécessiterait d'étendre l'agent pour exposer les détails des projets
    // Pour l'instant, on utilise la liste générale
    return this.getProjectsList();
  }

  private isValidGitUrl(url: string): boolean {
    const gitUrlPattern = /^(https?:\/\/)?(github\.com|gitlab\.com|bitbucket\.org)\/[\w\-\.]+\/[\w\-\.]+/;
    return gitUrlPattern.test(url);
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      console.error('🔌 Connecting to transport...');
      
      await this.server.connect(transport);
      console.error('✅ MCP Server connected successfully');
      
      // Le serveur reste en vie tant que le transport est ouvert
      console.error('🚀 FirebaseAppBuilder MCP Server is ready');
      
    } catch (error) {
      console.error('❌ Failed to start MCP server:', error);
      process.exit(1);
    }
  }
}

// Export pour utilisation par mcp-entry.ts
export { FirebaseAppBuilderMCPServer };