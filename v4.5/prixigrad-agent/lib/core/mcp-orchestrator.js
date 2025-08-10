/**
 * 🎭 PRIXIGRAD.IO - MCP Orchestrator
 * 
 * Orchestrateur central des agents MCP pour transformation de projets
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');
const ConfigManager = require('./config');

class MCPOrchestrator {
  constructor() {
    this.logger = new Logger('MCPOrchestrator');
    this.configManager = new ConfigManager();
    
    // Agents MCP disponibles et leurs configurations
    this.agents = {
      filesystem: {
        package: '@modelcontextprotocol/server-filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        capabilities: ['read_file', 'write_file', 'list_directory', 'create_directory'],
        description: 'Agent de gestion des fichiers et répertoires'
      },
      postgres: {
        package: '@modelcontextprotocol/server-postgres',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        capabilities: ['connect_db', 'execute_query', 'create_table', 'migrate'],
        description: 'Agent de gestion PostgreSQL'
      },
      prisma: {
        package: 'prisma',
        command: 'npx',
        args: ['-y', 'prisma'],
        capabilities: ['generate_schema', 'migrate', 'seed', 'introspect'],
        description: 'ORM Prisma pour gestion base de données'
      },
      'sequential-thinking': {
        package: '@modelcontextprotocol/server-sequential-thinking',
        command: 'npx', 
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
        capabilities: ['plan', 'analyze', 'reason', 'document'],
        description: 'Agent de planification et analyse séquentielle'
      },
      git: {
        package: '@modelcontextprotocol/server-git',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
        capabilities: ['clone', 'commit', 'push', 'branch', 'merge'],
        description: 'Agent de gestion Git'
      }
    };

    // Sessions MCP actives
    this.activeSessions = new Map();
    
    // Queue des tâches
    this.taskQueue = [];
    this.isProcessing = false;
  }

  /**
   * Démarre une session MCP avec un agent spécifique
   */
  async startMCPSession(agentName, options = {}) {
    try {
      const agent = this.agents[agentName];
      if (!agent) {
        throw new Error(`Agent MCP inconnu: ${agentName}`);
      }

      const sessionId = this.generateSessionId(agentName);
      this.logger.info(`🎭 Démarrage session MCP: ${agentName} (${sessionId})`);

      // Configuration de la session
      const sessionConfig = {
        agent: agentName,
        sessionId,
        startTime: new Date().toISOString(),
        options,
        status: 'starting'
      };

      // Communication via Claude Code avec l'agent MCP
      const claudeProcess = await this.spawnClaudeWithMCP(agent, options, sessionId);
      
      sessionConfig.process = claudeProcess;
      sessionConfig.status = 'active';
      
      this.activeSessions.set(sessionId, sessionConfig);
      
      this.logger.success(`✅ Session MCP active: ${agentName} (${sessionId})`);
      return sessionId;

    } catch (error) {
      this.logger.error(`❌ Erreur session MCP ${agentName}`, error);
      throw error;
    }
  }

  /**
   * Exécute une tâche avec un agent MCP spécifique
   */
  async executeWithMCP(agentName, task, params = {}) {
    try {
      this.logger.info(`🎯 Exécution tâche MCP: ${task} avec ${agentName}`);

      // Démarrer session si nécessaire
      let sessionId = this.findActiveSession(agentName);
      if (!sessionId) {
        sessionId = await this.startMCPSession(agentName, params);
      }

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session MCP introuvable: ${sessionId}`);
      }

      // Construire le prompt MCP spécifique
      const mcpPrompt = this.buildMCPPrompt(agentName, task, params);
      
      // Exécuter via Claude Code + MCP
      const result = await this.sendMCPCommand(session, mcpPrompt);
      
      this.logger.success(`✅ Tâche MCP terminée: ${task}`);
      return {
        success: true,
        sessionId,
        agent: agentName,
        task,
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`❌ Erreur tâche MCP ${task}`, error);
      return {
        success: false,
        agent: agentName,
        task,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Pipeline de transformation en 8 étapes avec orchestration MCP
   */
  async orchestrateTransformation(projectData) {
    try {
      this.logger.banner(`ORCHESTRATION TRANSFORMATION - ${projectData.name}`);
      
      const pipeline = this.createTransformationPipeline(projectData);
      const results = {
        projectId: projectData.id || this.generateProjectId(projectData.name),
        projectName: projectData.name,
        startTime: new Date().toISOString(),
        steps: [],
        success: false,
        error: null
      };

      // Exécution séquentielle des 8 étapes
      for (let i = 0; i < pipeline.length; i++) {
        const step = pipeline[i];
        
        try {
          this.logger.info(`🔄 Étape ${i + 1}/8: ${step.title}`);
          
          // Notification temps réel
          this.notifyStepStart(results.projectId, i + 1, step.title);
          
          // Exécution de l'étape avec l'agent MCP approprié
          const stepResult = await this.executeTransformationStep(step, results);
          
          results.steps.push({
            stepNumber: i + 1,
            title: step.title,
            agent: step.agent,
            success: stepResult.success,
            result: stepResult.result,
            error: stepResult.error,
            duration: stepResult.duration,
            timestamp: new Date().toISOString()
          });

          if (!stepResult.success) {
            throw new Error(`Étape ${i + 1} échouée: ${stepResult.error}`);
          }

          // Notification progression
          this.notifyStepComplete(results.projectId, i + 1, Math.round((i + 1) / 8 * 100));

        } catch (stepError) {
          this.logger.error(`❌ Étape ${i + 1} échouée`, stepError);
          results.error = stepError.message;
          this.notifyTransformationError(results.projectId, stepError.message);
          break;
        }
      }

      results.success = results.steps.length === 8 && results.steps.every(s => s.success);
      results.endTime = new Date().toISOString();
      results.duration = new Date(results.endTime) - new Date(results.startTime);

      if (results.success) {
        this.logger.success(`🎉 Transformation terminée: ${projectData.name}`);
        this.notifyTransformationComplete(results.projectId, results);
      } else {
        this.logger.error(`❌ Transformation échouée: ${projectData.name}`);
      }

      return results;

    } catch (error) {
      this.logger.error('❌ Erreur orchestration transformation', error);
      throw error;
    }
  }

  /**
   * Crée le pipeline de transformation en 8 étapes
   */
  createTransformationPipeline(projectData) {
    return [
      {
        title: 'Analyse Projet',
        agent: 'filesystem',
        task: 'analyze_project_structure',
        description: 'Analyse complète de la structure du projet',
        estimatedDuration: '2 minutes'
      },
      {
        title: 'Spécifications Techniques',
        agent: 'sequential-thinking',
        task: 'generate_technical_specs',
        description: 'Génération des spécifications techniques détaillées',
        estimatedDuration: '3 minutes'
      },
      {
        title: 'Schéma Prisma',
        agent: 'prisma',
        task: 'generate_prisma_schema',
        description: 'Création du schéma Prisma avec relations',
        estimatedDuration: '2 minutes'
      },
      {
        title: 'Base de Données',
        agent: 'postgres',
        task: 'setup_database',
        description: 'Configuration PostgreSQL et migrations',
        estimatedDuration: '3 minutes'
      },
      {
        title: 'Super Admin & Seed',
        agent: 'prisma',
        task: 'create_admin_and_seed',
        description: 'Création super admin et données de démonstration',
        estimatedDuration: '2 minutes'
      },
      {
        title: 'Backend APIs',
        agent: 'filesystem',
        task: 'generate_backend_apis',
        description: 'Génération des APIs REST et middleware',
        estimatedDuration: '4 minutes'
      },
      {
        title: 'Frontend Connection',
        agent: 'filesystem',
        task: 'connect_frontend_apis',
        description: 'Connexion frontend aux APIs réelles',
        estimatedDuration: '3 minutes'
      },
      {
        title: 'Déploiement',
        agent: 'git',
        task: 'deploy_production',
        description: 'Déploiement et push branche production',
        estimatedDuration: '2 minutes'
      }
    ];
  }

  /**
   * Exécute une étape de transformation spécifique
   */
  async executeTransformationStep(step, contextResults) {
    const startTime = Date.now();
    
    try {
      // Préparer les paramètres pour l'agent MCP
      const params = {
        step: step.title,
        task: step.task,
        context: contextResults,
        projectData: contextResults.projectData || {}
      };

      // Exécuter avec l'agent MCP approprié
      const result = await this.executeWithMCP(step.agent, step.task, params);
      
      const duration = Date.now() - startTime;
      
      return {
        success: result.success,
        result: result.result,
        error: result.error,
        duration: `${Math.round(duration / 1000)}s`,
        agent: step.agent
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        result: null,
        error: error.message,
        duration: `${Math.round(duration / 1000)}s`,
        agent: step.agent
      };
    }
  }

  /**
   * Spawn Claude Code avec agent MCP (OBLIGATOIRE)
   */
  async spawnClaudeWithMCP(agent, options, sessionId) {
    return new Promise((resolve, reject) => {
      // Claude Code OBLIGATOIRE - pas de fallback
      const { execSync } = require('child_process');
      
      try {
        // Vérifier que Claude Code est disponible
        execSync('which claude', { stdio: 'ignore' });
      } catch (error) {
        reject(new Error('Claude Code requis mais non trouvé. Installez Claude Code depuis https://claude.ai/code'));
        return;
      }
      
      // Commande Claude Code avec configuration MCP
      const claudeArgs = [
        '--mcp-config', this.getMCPConfigPath(),
        '--session-id', sessionId,
        '--print'
      ];

      // Envoyer immédiatement le prompt pour analyse
      const analysisPrompt = this.buildMCPPrompt(agent.name, 'analyze_project_structure', {
        github_url: options.github_url || '',
        github_token: options.github_token || ''
      });

      const claudeProcess = spawn('claude', claudeArgs.concat([analysisPrompt]), {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_AGENT: agent.package,
          MCP_SESSION: sessionId
        }
      });

      let stdout = '';
      let stderr = '';

      claudeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.logger.debug(`[Claude STDOUT] ${output.trim()}`);
      });

      claudeProcess.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        this.logger.debug(`[Claude STDERR] ${error.trim()}`);
      });

      claudeProcess.on('close', (code) => {
        this.logger.debug(`Claude process closed with code ${code}`);
        if (code === 0) {
          // Créer un objet mock process avec les résultats
          resolve({
            stdout: { on: () => {}, emit: (event, data) => {} },
            stderr: { on: () => {} },
            stdin: { write: () => {}, end: () => {} },
            kill: () => {},
            on: () => {},
            _output: stdout,
            _error: stderr
          });
        } else {
          reject(new Error(`Claude Code + MCP failed (code ${code}): ${stderr}`));
        }
      });

      claudeProcess.on('error', (error) => {
        reject(new Error(`Erreur spawn Claude + MCP: ${error.message}`));
      });

      // Timeout de sécurité augmenté pour analyse complète
      setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        reject(new Error('Timeout spawn Claude + MCP (6 minutes)'));
      }, 360000); // 6 minutes
    });
  }

  /**
   * Génère le chemin vers la configuration MCP
   */
  getMCPConfigPath() {
    const os = require('os');
    const path = require('path');
    return path.join(os.homedir(), '.config', 'claude', 'mcp_servers.json');
  }

  /**
   * Envoie une commande à une session MCP active
   */
  async sendMCPCommand(session, prompt) {
    return new Promise((resolve, reject) => {
      if (!session.process) {
        return reject(new Error('Processus MCP non trouvé'));
      }

      // Si c'est notre processus modifié avec _output, utiliser directement
      if (session.process._output) {
        resolve({
          output: session.process._output,
          error: session.process._error || '',
          success: !session.process._error
        });
        return;
      }

      let response = '';
      let errorOutput = '';

      // Écouter la réponse
      session.process.stdout.on('data', (data) => {
        response += data.toString();
      });

      session.process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Envoyer le prompt
      session.process.stdin.write(prompt + '\n');

      // Timeout et résolution pour analyse complète
      const timeout = setTimeout(() => {
        resolve({
          output: response,
          error: errorOutput,
          success: true
        });
      }, 360000); // 6 minutes

      session.process.on('close', () => {
        clearTimeout(timeout);
        resolve({
          output: response,
          error: errorOutput,
          success: errorOutput.length === 0
        });
      });
    });
  }

  /**
   * Construction du prompt MCP spécifique
   */
  buildMCPPrompt(agentName, task, params) {
    const agent = this.agents[agentName];
    
    // Pour l'analyse de projet, utiliser Claude Code natif avec analyse approfondie
    if (task === 'analyze_project_structure') {
      return `Tu es Claude Code avec accès aux agents MCP. Tu dois analyser le projet GitHub de manière APPROFONDIE.

URL GITHUB: ${params.github_url}
TOKEN: ${params.github_token || 'non fourni'}

🎯 MISSION: Analyse PROFESSIONNELLE complète pour PRIXIGRAD.IO

📋 RETOURNER UN JSON AVEC CES SECTIONS COMPLÈTES:

{
  "projectName": "nom du projet",
  "type": "type business détecté (e-commerce, blog, dashboard, etc.)",
  "framework": "framework détecté",
  "pages": [
    {
      "name": "nom de la page",
      "route": "/chemin/route",
      "mainFunctionality": "description détaillée de la fonctionnalité principale",
      "businessContext": "contexte métier spécifique à cette page",
      "hasAuth": true/false,
      "usesStaticData": true/false,
      "detectedComponents": [
        {
          "name": "nom composant",
          "type": "type (form, list, card, etc.)",
          "description": "description détaillée",
          "functionality": "fonctionnalité métier",
          "userActions": ["action1", "action2"]
        }
      ],
      "specificFeatures": [
        {
          "feature": "nom de la fonctionnalité",
          "description": "description détaillée",
          "businessLogic": "logique métier associée",
          "technicalRequirements": ["req1", "req2"]
        }
      ],
      "dataModels": [
        {
          "modelName": "nom du modèle",
          "fields": [
            {
              "name": "nom_champ",
              "type": "type_donnée",
              "description": "description du champ"
            }
          ],
          "businessRules": ["règle1", "règle2"]
        }
      ],
      "detectedActions": [
        {
          "action": "nom action (Create, Read, Update, Delete)",
          "description": "description de l'action",
          "apiNeeded": "POST /api/endpoint",
          "dataModel": "modèle concerné",
          "status": "missing/exists/broken"
        }
      ],
      "hiddenComplexity": [
        {
          "complexity": "nom de la complexité cachée",
          "description": "description du problème",
          "impact": "impact sur le développement",
          "solution": "solution proposée"
        }
      ],
      "crudOperations": ["CREATE", "READ", "UPDATE", "DELETE"],
      "dataEntities": ["entité1", "entité2"],
      "corrections": ["correction1", "correction2"],
      "backendFunctions": [
        {
          "api": "GET /api/endpoint",
          "status": "missing/exists/broken"
        }
      ]
    }
  ],
  "structure": {
    "pages": [{"name": "PageName", "path": "/pages/file.js"}],
    "components": [{"name": "ComponentName", "path": "/components/file.js"}]
  },
  "transformationPlan": {
    "steps": [
      {
        "title": "étape",
        "description": "description",
        "tasks": ["tâche1", "tâche2"],
        "estimatedTime": "temps estimé",
        "priority": "high/medium/low"
      }
    ]
  }
}

🧠 ANALYSE APPROFONDIE REQUISE:
1. Clone/lit tout le code source
2. Comprend la logique métier de chaque page
3. Détecte les patterns de données
4. Identifie les APIs mockées
5. Comprend l'architecture globale
6. Analyse les interactions utilisateur
7. Détecte les complexités cachées
8. Propose des modèles de données Prisma

IMPORTANT: Cette analyse sera utilisée par l'utilisateur pour corriger/valider avant transformation automatique.

COMMENCE L'ANALYSE MAINTENANT:`;
    }
    
    // Pour les autres tâches, utiliser les agents MCP spécialisés
    if (!agent) {
      return `Analyze the GitHub repository ${params.github_url} and return a JSON analysis.`;
    }
    
    return `Tu es l'agent MCP ${agentName} (${agent.description}).

TÂCHE: ${task}
PARAMÈTRES: ${JSON.stringify(params, null, 2)}
CAPACITÉS DISPONIBLES: ${agent.capabilities.join(', ')}

INSTRUCTIONS SPÉCIFIQUES:
${this.getAgentSpecificInstructions(agentName, task)}

IMPORTANT:
- Utilise exclusivement tes capacités MCP natives
- Retourne des résultats structurés en JSON quand possible
- Documente chaque action importante
- Gère les erreurs gracieusement
- Communique le statut de progression

COMMENCE MAINTENANT:`;
  }

  /**
   * Instructions spécifiques par agent et tâche
   */
  getAgentSpecificInstructions(agentName, task) {
    const instructions = {
      filesystem: {
        analyze_project_structure: `
1. Analyse récursivement la structure du projet
2. Identifie les pages, composants, et patterns de données
3. Détecte les données mockées et les APIs factices
4. Retourne un JSON avec: business_type, pages_detected, mock_data_patterns`,
        
        generate_backend_apis: `
1. Crée les routes API REST dans pages/api/
2. Implémente les middlewares d'authentification
3. Connecte aux modèles Prisma existants
4. Ajoute validation et gestion d'erreurs`,
        
        connect_frontend_apis: `
1. Remplace les données mockées par les appels API
2. Ajoute les états de loading et d'erreur
3. Implémente la gestion des erreurs réseau
4. Teste les connexions API`
      },
      
      'sequential-thinking': {
        generate_technical_specs: `
1. Analyse les résultats de l'étape précédente
2. Génère des spécifications techniques détaillées
3. Définis l'architecture backend et les modèles de données
4. Planifie les intégrations et le déploiement`
      },
      
      prisma: {
        generate_prisma_schema: `
1. Crée un schema.prisma complet avec relations
2. Définis les modèles basés sur l'analyse du projet
3. Ajoute les indexes et contraintes nécessaires
4. Prépare les migrations initiales`,
        
        create_admin_and_seed: `
1. Crée un super administrateur avec le bon rôle
2. Génère des données de démonstration réalistes
3. Exécute les seeds via Prisma
4. Vérifie l'intégrité des données`
      },
      
      postgres: {
        setup_database: `
1. Connecte à la base PostgreSQL configurée
2. Exécute les migrations Prisma
3. Vérifie la structure des tables
4. Teste les connexions et permissions`
      },
      
      git: {
        deploy_production: `
1. Crée une nouvelle branche 'prod-auto'
2. Commit tous les changements avec un message descriptif
3. Push la branche sur le remote
4. Génère un rapport de déploiement`
      }
    };

    return instructions[agentName]?.[task] || 'Exécute la tâche demandée avec les meilleures pratiques MCP.';
  }

  /**
   * Notifications temps réel pour l'interface web
   */
  notifyStepStart(projectId, stepNumber, stepTitle) {
    // Envoyer via Server-Sent Events
    this.sendSSENotification('transformation-progress', {
      projectId,
      step: stepNumber,
      totalSteps: 8,
      phase: stepTitle,
      progress: Math.round((stepNumber - 1) / 8 * 100),
      message: `Début ${stepTitle}`,
      timestamp: new Date().toISOString()
    });
  }

  notifyStepComplete(projectId, stepNumber, progress) {
    this.sendSSENotification('transformation-progress', {
      projectId,
      step: stepNumber,
      totalSteps: 8,
      progress,
      message: `Étape ${stepNumber}/8 terminée`,
      timestamp: new Date().toISOString()
    });
  }

  notifyTransformationComplete(projectId, results) {
    this.sendSSENotification('transformation-complete', {
      projectId,
      message: 'Transformation terminée avec succès',
      appUrl: results.deploymentUrl || `http://localhost:3000/project/${projectId}`,
      duration: results.duration,
      timestamp: new Date().toISOString()
    });
  }

  notifyTransformationError(projectId, error) {
    this.sendSSENotification('transformation-error', {
      projectId,
      error,
      message: `Erreur transformation: ${error}`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Envoi notifications SSE (intégration avec BridgeServer)
   */
  sendSSENotification(type, data) {
    // Cette méthode sera intégrée avec le BridgeServer
    // pour envoyer les notifications en temps réel
    this.logger.info(`📡 SSE: ${type}`, data);
  }

  /**
   * Utilitaires
   */
  generateSessionId(agentName) {
    // Générer un UUID v4 valide pour Claude Code
    const crypto = require('crypto');
    return crypto.randomUUID();
  }

  generateProjectId(projectName) {
    return `proj_${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  findActiveSession(agentName) {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.agent === agentName && session.status === 'active') {
        return sessionId;
      }
    }
    return null;
  }

  /**
   * Nettoyage des sessions
   */
  async cleanupSessions() {
    this.logger.info('🧹 Nettoyage sessions MCP...');
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      try {
        if (session.process) {
          session.process.kill('SIGTERM');
        }
        this.activeSessions.delete(sessionId);
      } catch (error) {
        this.logger.error(`Erreur nettoyage session ${sessionId}`, error);
      }
    }
    
    this.logger.success(`✅ ${this.activeSessions.size} sessions nettoyées`);
  }

  /**
   * Arrêt de l'orchestrateur
   */
  async stop() {
    this.logger.info('🛑 Arrêt MCPOrchestrator...');
    await this.cleanupSessions();
    this.logger.success('✅ MCPOrchestrator arrêté');
  }
}

module.exports = MCPOrchestrator;