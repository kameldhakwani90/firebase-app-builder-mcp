/**
 * 🎭 PRIXIGRAD.IO - Database Service
 * 
 * Service pour gérer toutes les données en base PostgreSQL avec Prisma
 */

const { PrismaClient } = require('@prisma/client');
const Logger = require('./logger');
const UserService = require('./user-service');

class DatabaseService {
  constructor() {
    this.logger = new Logger('DatabaseService');
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
    this.userService = new UserService();
    
    // Test connexion au démarrage
    this.testConnection();
  }

  async testConnection() {
    try {
      await this.prisma.$connect();
      this.logger.success('✅ Connexion PostgreSQL établie');
    } catch (error) {
      this.logger.error('❌ Erreur connexion PostgreSQL', error);
      throw error;
    }
  }

  /**
   * GESTION DES PROJETS
   */
  async createProject(data, userId) {
    try {
      // Conserver l'URL originale pour le clonage git
      const originalGithubUrl = data.githubUrl;
      
      // Vérifier si un projet existe déjà avec cette URL
      const existingProject = await this.getProjectByGithubUrl(data.githubUrl);
      if (existingProject) {
        this.logger.info(`🔄 Projet existant trouvé pour URL: ${data.githubUrl}`);
        // Si c'est le même utilisateur, retourner le projet existant
        if (existingProject.userId === userId) {
          return existingProject;
        }
        // Si c'est un autre utilisateur, générer une URL unique SEULEMENT pour la base de données
        const timestamp = Date.now();
        data.githubUrl = `${data.githubUrl}#${timestamp}`;
        this.logger.info(`🔀 URL modifiée pour éviter conflit: ${data.githubUrl}`);
      }
      
      // TEMPORAIRE: Désactiver crédits pour tester analyse intelligente
      // await this.userService.checkAndConsumeCreditsForProject(userId, 5);
      this.logger.info(`🧪 TEST MODE - Credits bypass pour projet ${data.name}`);
      
      // DEBUG: Tracer les données avant insertion
      this.logger.info(`🔍 DEBUG DATABASE - data.description: "${data.description}"`);
      this.logger.info(`🔍 DEBUG DATABASE - Type: ${typeof data.description}`);
      this.logger.info(`🔍 DEBUG DATABASE - userId reçu: "${userId}" (type: ${typeof userId})`);
      
      const project = await this.prisma.project.create({
        data: {
          name: data.name,
          description: data.description,
          githubUrl: data.githubUrl,
          status: data.status || 'analyzing',
          type: data.type,
          framework: data.framework,
          creditsCost: 5,
          user: {
            connect: { id: userId }  // Reconnect user avec ID correct
          }
        }
      });
      
      // DEBUG: Vérifier ce qui a été sauvé
      this.logger.info(`🔍 DEBUG DATABASE - project.description sauvé: "${project.description}"`);
      
      this.logger.success(`📦 Projet créé: ${project.name} (${project.id})`);
      return project;
    } catch (error) {
      this.logger.error('Erreur création projet', error);
      throw error;
    }
  }

  async getProject(id) {
    return await this.prisma.project.findUnique({
      where: { id },
      include: {
        analysis: true,
        pages: {
          include: {
            features: true,
            apisRequired: true,
            dbModelsNeeded: true
          }
        },
        userRoles: true
      }
    });
  }

  async getProjectByGithubUrl(githubUrl) {
    return await this.prisma.project.findUnique({
      where: { githubUrl },
      include: {
        analysis: true,
        pages: {
          include: {
            features: true,
            apisRequired: true,
            dbModelsNeeded: true
          }
        },
        userRoles: true
      }
    });
  }

  async getAllProjects(userId = null) {
    const where = userId ? { userId } : {};
    
    return await this.prisma.project.findMany({
      where,
      include: {
        user: true,  // NOUVEAU: Inclure info utilisateur
        analysis: true,
        pages: true,
        userRoles: true
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getUserProjects(userId) {
    return await this.getAllProjects(userId);
  }

  async updateProjectStatus(id, status) {
    return await this.prisma.project.update({
      where: { id },
      data: { status, updatedAt: new Date() }
    });
  }

  async deleteProject(projectId, userId) {
    try {
      // Vérifier que l'utilisateur peut supprimer ce projet
      const project = await this.getProject(projectId);
      
      if (!project) {
        throw new Error('Projet introuvable');
      }

      const user = await this.userService.getUserById(userId);
      
      if (project.userId !== userId && user.role !== 'SUPER_ADMIN') {
        throw new Error('Vous n\'avez pas le droit de supprimer ce projet');
      }

      // Rembourser les crédits si c'est un client (pas super admin)
      if (user.role !== 'SUPER_ADMIN') {
        await this.userService.addCredits(
          project.userId, 
          project.creditsCost, 
          `Remboursement suppression projet ${project.name}`
        );
      }

      // Supprimer le projet (cascade sur analysis, pages, etc.)
      await this.prisma.project.delete({
        where: { id: projectId }
      });

      this.logger.success(`🗑️ Projet supprimé: ${project.name}`);
      return { success: true, message: 'Projet supprimé avec succès' };
      
    } catch (error) {
      this.logger.error('Erreur suppression projet', error);
      throw error;
    }
  }

  /**
   * GESTION DES ANALYSES
   */
  async createOrUpdateAnalysis(projectId, analysisData) {
    try {
      // Supprimer l'ancienne analyse si elle existe
      await this.prisma.analysis.deleteMany({
        where: { projectId }
      });

      // Créer la nouvelle analyse
      const analysis = await this.prisma.analysis.create({
        data: {
          projectId,
          businessObjectives: analysisData.businessObjectives || [],
          businessType: analysisData.businessType,
          targetMarket: analysisData.businessModel?.targetMarket,
          revenueStreams: analysisData.businessModel?.revenueStreams || [],
          analysisQuality: analysisData.analysisQuality || 'STANDARD',
          analyzedBy: analysisData.analyzed_by || 'Claude Code + MCP agents'
        }
      });

      this.logger.success(`🧠 Analyse sauvegardée pour projet ${projectId}`);
      return analysis;
    } catch (error) {
      this.logger.error('Erreur sauvegarde analyse', error);
      throw error;
    }
  }

  /**
   * GESTION DES PAGES
   */
  async savePages(projectId, pagesData) {
    try {
      // Supprimer les anciennes pages
      await this.prisma.page.deleteMany({
        where: { projectId }
      });

      // Créer les nouvelles pages
      for (const pageData of pagesData || []) {
        let page;
        try {
          page = await this.prisma.page.create({
            data: {
              projectId,
              name: pageData.name,
              route: pageData.route,
              pageObjective: pageData.pageObjective,
              mainFunctionality: pageData.mainFunctionality,
              businessContext: pageData.businessContext,
              hasAuth: pageData.hasAuth || false,
              usesStaticData: pageData.usesStaticData !== false,
              currentMockData: pageData.currentMockData,
              // Nouvelles propriétés détaillées
              crudOperations: pageData.crudOperations || [],
              dataEntities: pageData.dataEntities || [],
              corrections: pageData.corrections || []
            }
          });
          
        } catch (pageError) {
          this.logger.error(`❌ Erreur création page ${pageData.name}:`, pageError);
          throw pageError;
        }

        // Sauvegarder les features
        if (pageData.specificFeatures) {
          for (const feature of pageData.specificFeatures) {
            await this.prisma.feature.create({
              data: {
                pageId: page.id,
                feature: feature.feature,
                description: feature.description,
                businessLogic: feature.businessLogic,
                technicalRequirements: feature.technicalRequirements || []
              }
            });
          }
        }

        // Sauvegarder les APIs requises
        if (pageData.apisRequired) {
          for (const api of pageData.apisRequired) {
            await this.prisma.apiRequired.create({
              data: {
                pageId: page.id,
                endpoint: typeof api === 'string' ? api : api.endpoint,
                description: typeof api === 'object' ? api.description : null,
                purpose: typeof api === 'object' ? api.purpose : null
              }
            });
          }
        }

        // Sauvegarder les modèles DB nécessaires
        if (pageData.dbModelsNeeded) {
          for (const model of pageData.dbModelsNeeded) {
            await this.prisma.dbModelNeeded.create({
              data: {
                pageId: page.id,
                modelName: typeof model === 'string' ? model : model.modelName,
                fields: typeof model === 'object' ? model.fields : null
              }
            });
          }
        }

        // Sauvegarder les composants détectés
        if (pageData.detectedComponents) {
          for (const component of pageData.detectedComponents) {
            await this.prisma.component.create({
              data: {
                pageId: page.id,
                name: component.name,
                type: component.type,
                description: component.description,
                functionality: component.functionality,
                userActions: component.userActions || []
              }
            });
          }
        }

        // Sauvegarder les actions détectées
        if (pageData.detectedActions) {
          for (const action of pageData.detectedActions) {
            await this.prisma.action.create({
              data: {
                pageId: page.id,
                action: action.action,
                description: action.description,
                apiNeeded: action.apiNeeded,
                dataModel: action.dataModel,
                status: action.status || 'missing'
              }
            });
          }
        }

        // Sauvegarder la complexité cachée
        if (pageData.hiddenComplexity) {
          for (const complexity of pageData.hiddenComplexity) {
            await this.prisma.complexity.create({
              data: {
                pageId: page.id,
                complexity: complexity.complexity,
                description: complexity.description,
                impact: complexity.impact,
                solution: complexity.solution
              }
            });
          }
        }

        // Sauvegarder les fonctions backend
        if (pageData.backendFunctions) {
          for (const func of pageData.backendFunctions) {
            await this.prisma.backendFunction.create({
              data: {
                pageId: page.id,
                api: func.api,
                status: func.status || 'missing',
                description: func.description
              }
            });
          }
        }
      }

      this.logger.success(`📄 ${pagesData?.length || 0} pages sauvegardées pour projet ${projectId}`);
    } catch (error) {
      this.logger.error('Erreur sauvegarde pages', error);
      throw error;
    }
  }

  /**
   * GESTION DES RÔLES UTILISATEURS
   */
  async saveUserRoles(projectId, userRoles) {
    try {
      // Supprimer les anciens rôles
      await this.prisma.userRole.deleteMany({
        where: { projectId }
      });

      // Créer les nouveaux rôles
      for (const roleData of userRoles || []) {
        try {
        const userRole = await this.prisma.userRole.create({
          data: {
            projectId,
            role: roleData.role,
            description: roleData.description,
            permissions: roleData.permissions || []
          }
        });
        
        } catch (roleError) {
          this.logger.error(`❌ Erreur création userRole ${roleData.role}:`, roleError);
          throw roleError;
        }
      }

      this.logger.success(`👥 ${userRoles?.length || 0} rôles sauvegardés pour projet ${projectId}`);
    } catch (error) {
      this.logger.error('Erreur sauvegarde rôles', error);
      throw error;
    }
  }

  /**
   * SAUVEGARDE COMPLÈTE D'UNE ANALYSE
   */
  async saveCompleteAnalysis(projectData, analysisResult, userId) {
    try {
      this.logger.info(`💾 Sauvegarde analyse complète: ${projectData.name}`);
      
      // DEBUG: Vérifier les données reçues
      this.logger.info(`🔍 DEBUG saveCompleteAnalysis - projectData: ${JSON.stringify(projectData)}`);
      this.logger.info(`🔍 DEBUG saveCompleteAnalysis - analysisResult existe: ${!!analysisResult}`);
      this.logger.info(`🔍 DEBUG saveCompleteAnalysis - analysisResult.pages: ${analysisResult?.pages?.length || 'undefined'}`);
      this.logger.info(`🔍 DEBUG saveCompleteAnalysis - analysisResult.userRoles: ${analysisResult?.userRoles?.length || 'undefined'}`);
      this.logger.info(`🔍 DEBUG saveCompleteAnalysis - userId: ${userId}`);

      // 1. Créer/mettre à jour le projet
      let project = await this.getProjectByGithubUrl(projectData.githubUrl);
      
      if (!project) {
        project = await this.createProject({
          name: analysisResult.projectName || projectData.name,
          githubUrl: projectData.githubUrl,
          status: 'analyzed',
          type: analysisResult.type,
          framework: analysisResult.framework
        }, userId);
      } else {
        // Vérifier que l'utilisateur est propriétaire du projet
        if (project.userId !== userId) {
          const user = await this.userService.getUserById(userId);
          if (user.role !== 'SUPER_ADMIN') {
            throw new Error('Vous n\'avez pas accès à ce projet');
          }
        }
        
        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            name: analysisResult.projectName || projectData.name,
            status: 'analyzed',
            type: analysisResult.type,
            framework: analysisResult.framework,
            updatedAt: new Date()
          }
        });
      }

      // 2. Sauvegarder l'analyse
      await this.createOrUpdateAnalysis(project.id, analysisResult);

      // 3. Sauvegarder les pages
      this.logger.info(`🔍 DEBUG Pages: ${JSON.stringify(analysisResult.pages?.length || 'undefined')}`);
      await this.savePages(project.id, analysisResult.pages);

      // 4. Sauvegarder les rôles utilisateurs  
      this.logger.info(`🔍 DEBUG UserRoles: ${JSON.stringify(analysisResult.userRoles?.length || 'undefined')}`);
      await this.saveUserRoles(project.id, analysisResult.userRoles);

      this.logger.success(`✅ Analyse complète sauvegardée: ${project.name}`);
      
      return project;
    } catch (error) {
      this.logger.error('Erreur sauvegarde analyse complète', error);
      throw error;
    }
  }

  /**
   * RÉCUPÉRATION DES DONNÉES POUR L'API
   */
  /**
   * Récupérer un projet par son ID
   */
  async getProjectById(projectId) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          pages: {
            include: {
              features: true,
              apisRequired: true,
              dbModelsNeeded: true,
              components: true,
              actions: true,
              complexities: true,
              backendFunctions: true
            }
          },
          userRoles: true,
        }
      });

      if (!project) {
        return null;
      }

      // Formater les pages avec toutes leurs propriétés détaillées
      const formattedPages = project.pages.map(page => ({
        ...page,
        // Mapper les relations vers les propriétés attendues par l'interface
        detectedComponents: page.components || [],
        specificFeatures: page.features || [],
        dataModels: page.dbModelsNeeded || [],
        detectedActions: page.actions || [],
        hiddenComplexity: page.complexities || [],
        backendFunctions: page.backendFunctions || []
      }));

      // Formater pour l'API - Compatible avec l'interface web
      return {
        id: project.id,
        name: project.name,
        path: project.githubUrl,
        status: project.status,
        type: project.type,
        framework: project.framework,
        lastAnalysis: project.updatedAt,
        pages: formattedPages,
        userRoles: project.userRoles || [],
        issues: [], // Placeholder pour l'interface
        readyForTransformation: project.status === 'analyzed',
        analysis: {
          // L'interface web s'attend à trouver les données dans analysis.*
          type: project.type,
          pages: formattedPages,
          apis: [], // TODO: extraire des pages
          mockData: [], // TODO: extraire des pages
          database: {
            isEmpty: false // On a un schéma Prisma
          },
          transformationPlan: {
            steps: [
              {
                title: "Configuration Base de Données",
                estimatedTime: "30 minutes",
                description: "Setup PostgreSQL avec Prisma et modèles IoT",
                tasks: [
                  "Créer les modèles Sensor, Machine, Site",
                  "Configurer les relations entre entités",
                  "Générer les migrations Prisma",
                  "Créer les données de démonstration"
                ],
                priority: "high"
              },
              {
                title: "APIs Backend IoT",
                estimatedTime: "45 minutes", 
                description: "Créer les endpoints pour capteurs et contrôles",
                tasks: [
                  "API gestion des capteurs",
                  "API formules métier dynamiques",
                  "API contrôles temps réel",
                  "Middleware de validation"
                ],
                priority: "high"
              },
              {
                title: "Interface Admin Capnio",
                estimatedTime: "60 minutes",
                description: "Back-office pour configuration capteurs",
                tasks: [
                  "Pages gestion types capteurs",
                  "Interface création formules",
                  "Dashboard monitoring",
                  "Gestion utilisateurs clients"
                ],
                priority: "medium"
              }
            ]
          }
        }
      };
    } catch (error) {
      this.logger.error('❌ Erreur getProjectById:', error);
      throw error;
    }
  }

  async getProjectsForAPI(userId = null) {
    const projects = await this.getAllProjects(userId);
    
    return projects.map(project => ({
      id: project.id,
      name: project.name,
      path: project.githubUrl,
      status: project.status,
      type: project.type,
      framework: project.framework,
      lastAnalysis: project.updatedAt,
      analysis: {
        projectName: project.name,
        type: project.type,
        framework: project.framework,
        businessObjectives: project.analysis?.businessObjectives || [],
        userRoles: project.userRoles?.map(role => ({
          role: role.role,
          description: role.description,
          permissions: role.permissions
        })) || [],
        pages: project.pages?.map(page => ({
          name: page.name,
          route: page.route,
          pageObjective: page.pageObjective,
          mainFunctionality: page.mainFunctionality,
          businessContext: page.businessContext,
          hasAuth: page.hasAuth,
          usesStaticData: page.usesStaticData,
          specificFeatures: page.features?.map(f => ({
            feature: f.feature,
            description: f.description,
            businessLogic: f.businessLogic,
            technicalRequirements: f.technicalRequirements
          })) || [],
          apisRequired: page.apisRequired?.map(api => api.endpoint) || [],
          dbModelsNeeded: page.dbModelsNeeded?.map(model => model.modelName) || [],
          currentMockData: page.currentMockData
        })) || [],
        businessModel: {
          type: project.analysis?.businessType,
          targetMarket: project.analysis?.targetMarket,
          revenueStreams: project.analysis?.revenueStreams || []
        },
        analyzed_by: project.analysis?.analyzedBy,
        timestamp: project.updatedAt,
        analysisQuality: project.analysis?.analysisQuality
      }
    }));
  }

  /**
   * Supprime complètement un projet et toutes ses données associées
   */
  async deleteProjectCompletely(projectId) {
    try {
      this.logger.info(`🗑️ Suppression complète du projet: ${projectId}`);
      
      // Suppression simple : Prisma va gérer les cascades
      const deletedProject = await this.prisma.project.delete({
        where: { id: projectId }
      });
      
      this.logger.success(`✅ Projet ${projectId} supprimé complètement`);
      return deletedProject;
      
    } catch (error) {
      this.logger.error(`❌ Erreur suppression projet ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Nettoyage des ressources
   */
  async disconnect() {
    await this.prisma.$disconnect();
    this.logger.info('🔌 Connexion PostgreSQL fermée');
  }
}

module.exports = DatabaseService;