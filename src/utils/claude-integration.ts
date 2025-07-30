import chalk from 'chalk';
import { logger } from './logger.js';

export interface ClaudeRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  type: 'analysis' | 'generation' | 'correction' | 'validation' | 'optimization';
}

export interface ClaudeResponse {
  content: string;
  tokensUsed: number;
  confidence: number;
  suggestions?: string[];
  warnings?: string[];
}

export class ClaudeIntegration {
  private totalTokensUsed = 0;
  private requestCount = 0;
  private maxTokensPerProject = 20000; // Limite pour une application solide

  /**
   * Interface principale pour communiquer avec Claude
   */
  async askClaude(request: ClaudeRequest): Promise<ClaudeResponse> {
    console.log(chalk.blue(`🧠 Consultation Claude (${request.type})...`));
    
    const startTime = Date.now();
    this.requestCount++;

    try {
      // Vérifier les limites de tokens
      if (this.totalTokensUsed >= this.maxTokensPerProject) {
        throw new Error(`Limite de tokens atteinte (${this.maxTokensPerProject})`);
      }

      // Préparer le prompt optimisé
      const optimizedPrompt = this.optimizePrompt(request);
      
      // TODO: Intégration réelle avec Claude API
      // Pour l'instant, on simule une réponse intelligente
      const response = await this.simulateClaudeResponse(request, optimizedPrompt);
      
      // Tracking des tokens
      this.totalTokensUsed += response.tokensUsed;
      
      const duration = Date.now() - startTime;
      console.log(chalk.green(`✅ Claude répond (${response.tokensUsed} tokens, ${duration}ms)`));
      
      // Logger la requête
      logger.info(`Claude ${request.type}`, {
        tokensUsed: response.tokensUsed,
        duration,
        confidence: response.confidence,
        totalTokens: this.totalTokensUsed
      });

      return response;

    } catch (error) {
      logger.error(`Erreur Claude ${request.type}`, error);
      console.error(chalk.red(`❌ Erreur Claude:`, error));
      throw error;
    }
  }

  /**
   * Analyse profonde GÉNÉRIQUE d'un projet Firebase Studio - S'adapte à N'IMPORTE QUEL projet
   */
  async analyzeFirebaseStudioProject(projectPath: string, files: any): Promise<ClaudeResponse> {
    const projectName = projectPath.split('/').pop() || 'Projet Inconnu';
    
    const prompt = `Tu es un expert en développement Firebase Studio et Next.js. 

CONTEXTE:
Je veux migrer le projet "${projectName}" depuis Firebase Studio vers une application Next.js complète avec Prisma et NextAuth.
⚠️ IMPORTANT: Ce projet peut être de N'IMPORTE QUEL domaine (e-commerce, réservation, social, CRM, blog, etc.)

PROJET À ANALYSER:
- Nom: ${projectName}
- Path: ${projectPath}
- Fichier types.ts: ${files.types ? JSON.stringify(files.types, null, 2).substring(0, 1000) : 'Non trouvé'}...
- Fichier data.ts: ${files.mockData ? JSON.stringify(files.mockData, null, 2).substring(0, 1000) : 'Non trouvé'}...
- Blueprint: ${files.blueprint?.rawContent ? files.blueprint.rawContent.substring(0, 500) : 'Non trouvé'}...

TÂCHE - ANALYSE 100% ADAPTATIVE:
Analyse ce projet Firebase Studio et identifie AUTOMATIQUEMENT:
1. TOUS les modèles de données avec leurs relations exactes (PAS seulement User/Host/Client)
2. Le DOMAINE MÉTIER et la logique spécifique (détecte automatiquement le secteur)
3. Les rôles d'authentification RÉELS trouvés dans le code
4. Les fonctionnalités à implémenter selon le DOMAINE détecté
5. L'architecture recommandée pour CE type de projet

RÉPONSE ATTENDUE (format JSON):
{
  "projectDomain": "...", // e.g., "restaurant", "ecommerce", "booking", "social", etc.
  "businessDescription": "...", // Description du métier détecté
  "models": [{"name": "...", "fields": {...}, "relations": [...]}],
  "detectedBusinessLogic": [...], // Logique métier spécifique détectée
  "authSystem": {
    "roles": [...], // Rôles RÉELS trouvés dans le code
    "permissions": {...},
    "isMultiTenant": boolean
  },
  "priorityFeatures": [...], // Features selon le domaine détecté
  "architecture": "...",
  "recommendations": [...] // Recommandations spécifiques au domaine
}

⚡ ADAPTE-TOI au projet analysé. Ne présuppose RIEN. Détecte le domaine et adapte l'analyse.`;

    return await this.askClaude({
      prompt,
      type: 'analysis',
      maxTokens: 4000,
      temperature: 0.1
    });
  }

  /**
   * Génération de schéma Prisma intelligent
   */
  async generatePrismaSchema(models: any[], relations: any[]): Promise<ClaudeResponse> {
    const prompt = `Tu es un expert Prisma et PostgreSQL.

MODÈLES DÉTECTÉS:
${JSON.stringify(models, null, 2)}

RELATIONS DÉTECTÉES:
${JSON.stringify(relations, null, 2)}

TÂCHE:
Génère un schema.prisma COMPLET et OPTIMISÉ avec:
1. Tous les modèles avec types PostgreSQL appropriés
2. Toutes les relations (1:1, 1:N, N:N) correctement définies
3. Index pour optimiser les performances
4. Contraintes de sécurité et validation
5. Champs créés/modifiés automatiques

RÈGLES:
- Utilise PostgreSQL comme provider  
- Ajoute des @@map pour les noms de tables
- Inclus des @@index pour les champs de recherche
- Relations bidirectionnelles complètes
- Types appropriés (DateTime, Json, Decimal...)

RÉPONSE: Schema Prisma complet prêt à l'emploi.`;

    return await this.askClaude({
      prompt,
      type: 'generation',
      maxTokens: 3000,
      temperature: 0.1
    });
  }

  /**
   * Génération d'APIs REST intelligentes GÉNÉRIQUES - S'adapte à n'importe quel projet
   */
  async generateApiRoutes(models: any[], authConfig: any, projectDomain?: string): Promise<ClaudeResponse> {
    const prompt = `Tu es un expert Next.js API Routes et sécurité.

CONTEXTE PROJET:
- Domaine: ${projectDomain || 'Générique'}
- Architecture: Next.js App Router + Prisma + NextAuth

MODÈLES DÉTECTÉS:
${JSON.stringify(models, null, 2)}

AUTH CONFIG DÉTECTÉE:
${JSON.stringify(authConfig, null, 2)}

TÂCHE - GÉNÉRATION ADAPTATIVE:
Génère des API Routes Next.js SÉCURISÉES qui s'adaptent automatiquement aux modèles détectés:

1. STRUCTURE DYNAMIQUE basée sur les rôles RÉELS:
   ${authConfig?.roles?.map(role => `/api/${role}/[resource]/route.ts`).join('\n   ') || '/api/[resource]/route.ts'}

2. MÉTHODES selon le type de modèle:
   - GET: Lecture avec filtres adaptés au domaine
   - POST: Création avec validation métier
   - PUT: Mise à jour avec contrôles d'autorisation
   - DELETE: Suppression avec vérifications CASCADE

3. SÉCURITÉ ADAPTÉE:
   - Authentification NextAuth
   - Validation Zod dynamique selon les modèles
   - Autorisation basée sur les rôles DÉTECTÉS
   - Rate limiting selon le domaine métier

4. BUSINESS LOGIC:
   - Filtres spécifiques au domaine (ex: par tenant, par utilisateur, etc.)
   - Pagination intelligente
   - Recherche contextualisée

RÉPONSE ATTENDUE:
Code complet des API routes avec toute la logique métier adaptée au projet analysé.
⚡ ADAPTE les endpoints et la logique selon les modèles et le domaine détectés.`;

    return await this.askClaude({
      prompt,
      type: 'generation',
      maxTokens: 5000,
      temperature: 0.2
    });
  }

  /**
   * Génération de tests Playwright intelligents GÉNÉRIQUES - S'adapte à tout type de projet
   */
  async generatePlaywrightTests(features: any[], models: any[], authConfig: any, projectDomain?: string): Promise<ClaudeResponse> {
    const prompt = `Tu es un expert en tests E2E Playwright.

CONTEXTE PROJET:
- Domaine: ${projectDomain || 'Générique'}
- Type: Application Next.js avec authentification multi-rôles

FONCTIONNALITÉS DÉTECTÉES:
${JSON.stringify(features, null, 2)}

MODÈLES DÉTECTÉS:
${JSON.stringify(models, null, 2)}

AUTH CONFIG DÉTECTÉE:
${JSON.stringify(authConfig, null, 2)}

TÂCHE - GÉNÉRATION ADAPTATIVE:
Génère des tests Playwright COMPLETS qui s'adaptent automatiquement au projet:

1. AUTHENTIFICATION DYNAMIQUE:
   - Login/logout pour CHAQUE rôle détecté: ${authConfig?.roles?.join(', ') || 'aucun rôle spécifique'}
   - Protection des routes selon les permissions réelles
   - Sessions et autorisation contextuelle

2. CRUD OPERATIONS ADAPTÉES:
   - Tests pour CHAQUE modèle détecté
   - Validation des formulaires selon les champs réels
   - Gestion d'erreurs spécifique au domaine

3. BUSINESS LOGIC DU DOMAINE:
   - Workflows métier selon le domaine détecté
   - Intégrations entre modèles réels
   - Cas d'usage spécifiques au secteur

4. PARCOURS UTILISATEUR RÉELS:
   ${authConfig?.roles?.map(role => `- ${role}: actions selon permissions détectées`).join('\n   ') || '- Utilisateur générique: actions CRUD basiques'}

STRUCTURE ADAPTÉE:
- tests/auth.spec.ts (auth générique)
${authConfig?.roles?.map(role => `- tests/${role}.spec.ts`).join('\n') || '- tests/user.spec.ts'}
- tests/integration.spec.ts (workflows métier)
- tests/models/ (tests par modèle)

RÉPONSE ATTENDUE:
Code complet des tests avec assertions robustes adaptées au projet analysé.
⚡ GÉNÈRE uniquement les tests pertinents selon les fonctionnalités et modèles détectés.`;

    return await this.askClaude({
      prompt,
      type: 'generation',
      maxTokens: 4000,
      temperature: 0.2
    });
  }

  /**
   * Auto-correction avec Claude
   */
  async autoCorrectError(error: string, code: string, context: string): Promise<ClaudeResponse> {
    const prompt = `Tu es un expert débogueur Next.js/Prisma/TypeScript.

ERREUR DÉTECTÉE:
${error}

CODE PROBLÉMATIQUE:
\`\`\`typescript
${code.substring(0, 1500)}
\`\`\`

CONTEXTE:
${context}

TÂCHE:
1. IDENTIFIE la cause exacte de l'erreur
2. CORRIGE le code avec la solution la plus propre
3. EXPLIQUE pourquoi cette erreur s'est produite
4. SUGGÈRE des améliorations pour éviter des erreurs similaires

RÉPONSE (format JSON):
{
  "diagnosis": "...",
  "correctedCode": "...",
  "explanation": "...",
  "improvements": [...]
}

Sois précis et donne du code qui fonctionne.`;

    return await this.askClaude({
      prompt,
      type: 'correction',
      maxTokens: 2500,
      temperature: 0.1
    });
  }

  /**
   * Validation de code avec Claude
   */
  async validateCode(code: string, type: 'prisma' | 'api' | 'component' | 'test'): Promise<ClaudeResponse> {
    const prompt = `Tu es un expert en revue de code ${type}.

CODE À VALIDER:
\`\`\`typescript
${code.substring(0, 2000)}
\`\`\`

TÂCHE:
Analyse ce code et identifie:
1. ERREURS potentielles
2. PROBLÈMES de sécurité
3. OPTIMISATIONS possibles
4. BONNES PRATIQUES manquantes
5. COMPATIBILITÉ avec l'écosystème Next.js

CRITÈRES D'ÉVALUATION:
- Sécurité (injection, XSS, etc.)
- Performance (N+1, indexation, etc.)
- Maintenabilité (lisibilité, structure)
- TypeScript (typage, strictness)
- Standards (ESLint, Prettier)

RÉPONSE (format JSON):
{
  "score": 85,
  "errors": [...],
  "warnings": [...],
  "optimizations": [...],
  "isProductionReady": true
}`;

    return await this.askClaude({
      prompt,
      type: 'validation',
      maxTokens: 2000,
      temperature: 0.1
    });
  }

  /**
   * Optimisation finale avec Claude
   */
  async optimizeApplication(codebase: any): Promise<ClaudeResponse> {
    const prompt = `Tu es un architecte logiciel expert en Next.js.

CODEBASE GÉNÉRÉ:
- Modèles Prisma: ${codebase.models?.length || 0}
- API Routes: ${codebase.apis?.length || 0}
- Tests: ${codebase.tests?.length || 0}
- Pages: ${codebase.pages?.length || 0}

TÂCHE:
Optimise cette application pour la PRODUCTION:

1. PERFORMANCE:
   - Lazy loading des composants
   - Optimisation des requêtes DB
   - Cache strategy

2. SÉCURITÉ:
   - Headers de sécurité
   - Rate limiting
   - Input validation

3. SEO:
   - Meta tags
   - Sitemap
   - Structured data

4. MONITORING:
   - Error tracking
   - Analytics
   - Health checks

RÉPONSE (format JSON):
{
  "performanceOptimizations": [...],
  "securityEnhancements": [...],
  "seoImprovements": [...],
  "monitoringSetup": [...],
  "deploymentConfig": {...}
}`;

    return await this.askClaude({
      prompt,
      type: 'optimization',
      maxTokens: 3000,
      temperature: 0.2
    });
  }

  /**
   * Optimise un prompt pour Claude
   */
  private optimizePrompt(request: ClaudeRequest): string {
    let optimizedPrompt = request.prompt;

    // Ajouter le contexte si fourni
    if (request.context) {
      optimizedPrompt = `CONTEXTE:\n${request.context}\n\n${optimizedPrompt}`;
    }

    // Ajouter des instructions spécifiques selon le type
    switch (request.type) {
      case 'analysis':
        optimizedPrompt += '\n\nSOIS PRÉCIS ET EXHAUSTIF. Cette analyse est critique pour le succès du projet.';
        break;
      case 'generation':
        optimizedPrompt += '\n\nGÉNÈRE DU CODE PRODUCTION-READY. Inclus la gestion d\'erreurs et les bonnes pratiques.';
        break;
      case 'correction':
        optimizedPrompt += '\n\nDONNE UNE SOLUTION QUI FONCTIONNE À 100%. Explique clairement le problème et la correction.';
        break;
      case 'validation':
        optimizedPrompt += '\n\nSOIS STRICT ET DÉTAILLÉ. Identifie tous les problèmes potentiels.';
        break;
      case 'optimization':
        optimizedPrompt += '\n\nFOCUS SUR LA PERFORMANCE ET LA SÉCURITÉ. Prépare pour la production.';
        break;
    }

    return optimizedPrompt;
  }

  /**
   * Simulation de réponse Claude (remplacé par vraie API plus tard)
   */
  private async simulateClaudeResponse(request: ClaudeRequest, optimizedPrompt: string): Promise<ClaudeResponse> {
    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Simuler l'usage de tokens
    const baseTokens = optimizedPrompt.length / 4; // Approximation
    const responseTokens = (request.maxTokens || 2000) * (0.7 + Math.random() * 0.3);
    const totalTokens = Math.round(baseTokens + responseTokens);

    // Générer une réponse intelligente selon le type
    let content = '';
    const confidence = 0.85 + Math.random() * 0.1;

    switch (request.type) {
      case 'analysis':
        content = this.generateAnalysisResponse();
        break;
      case 'generation':
        content = this.generateCodeResponse();
        break;
      case 'correction':
        content = this.generateCorrectionResponse();
        break;
      case 'validation':
        content = this.generateValidationResponse();
        break;
      case 'optimization':
        content = this.generateOptimizationResponse();
        break;
    }

    return {
      content,
      tokensUsed: totalTokens,
      confidence,
      suggestions: ['Suggestion 1', 'Suggestion 2'],
      warnings: confidence < 0.9 ? ['Faible confiance sur certains points'] : undefined
    };
  }

  // Méthodes de génération de réponses simulées - ADAPTATIVES
  private generateAnalysisResponse(): string {
    // Génération d'une réponse générique adaptative
    const domains = ['ecommerce', 'booking', 'social', 'crm', 'blog', 'marketplace'];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    
    const adaptiveModels = this.generateAdaptiveModels(randomDomain);
    const adaptiveRoles = this.generateAdaptiveRoles(randomDomain);
    const adaptiveFeatures = this.generateAdaptiveFeatures(randomDomain);
    
    return JSON.stringify({
      projectDomain: randomDomain,
      businessDescription: `Application ${randomDomain} avec architecture moderne`,
      models: adaptiveModels,
      detectedBusinessLogic: this.generateBusinessLogic(randomDomain),
      authSystem: {
        roles: adaptiveRoles,
        permissions: this.generatePermissions(adaptiveRoles),
        isMultiTenant: randomDomain !== 'blog'
      },
      priorityFeatures: adaptiveFeatures,
      architecture: 'Next.js with Prisma and NextAuth',
      recommendations: this.generateDomainRecommendations(randomDomain)
    }, null, 2);
  }

  private generateAdaptiveModels(domain: string): any[] {
    const modelMappings = {
      ecommerce: [
        { name: 'User', fields: { id: 'string', email: 'string', role: 'string' }, relations: ['orders'] },
        { name: 'Product', fields: { id: 'string', name: 'string', price: 'number', categoryId: 'string' }, relations: ['category', 'orders'] },
        { name: 'Order', fields: { id: 'string', userId: 'string', status: 'string', total: 'number' }, relations: ['user', 'products'] }
      ],
      booking: [
        { name: 'User', fields: { id: 'string', email: 'string', role: 'string' }, relations: ['bookings'] },
        { name: 'Service', fields: { id: 'string', name: 'string', duration: 'number', price: 'number' }, relations: ['bookings'] },
        { name: 'Booking', fields: { id: 'string', userId: 'string', serviceId: 'string', date: 'date' }, relations: ['user', 'service'] }
      ],
      social: [
        { name: 'User', fields: { id: 'string', username: 'string', email: 'string' }, relations: ['posts', 'followers'] },
        { name: 'Post', fields: { id: 'string', content: 'string', userId: 'string', createdAt: 'date' }, relations: ['user', 'likes'] },
        { name: 'Comment', fields: { id: 'string', content: 'string', postId: 'string', userId: 'string' }, relations: ['post', 'user'] }
      ]
    };

    return modelMappings[domain] || modelMappings.ecommerce;
  }

  private generateAdaptiveRoles(domain: string): string[] {
    const roleMappings = {
      ecommerce: ['admin', 'merchant', 'customer'],
      booking: ['admin', 'provider', 'client'],
      social: ['admin', 'moderator', 'user'],
      crm: ['admin', 'manager', 'agent'],
      blog: ['admin', 'author', 'reader'],
      marketplace: ['admin', 'seller', 'buyer']
    };

    return roleMappings[domain] || ['admin', 'user'];
  }

  private generateAdaptiveFeatures(domain: string): string[] {
    const featureMappings = {
      ecommerce: ['Product Catalog', 'Shopping Cart', 'Payment Processing', 'Order Management'],
      booking: ['Calendar System', 'Booking Management', 'Service Catalog', 'Notification System'],
      social: ['User Profiles', 'Post System', 'Social Interactions', 'Content Moderation'],
      crm: ['Contact Management', 'Lead Tracking', 'Sales Pipeline', 'Analytics Dashboard'],
      blog: ['Content Management', 'Comment System', 'SEO Optimization', 'Analytics'],
      marketplace: ['Vendor Management', 'Product Listings', 'Transaction System', 'Review System']
    };

    return featureMappings[domain] || ['Authentication', 'User Management', 'Dashboard'];
  }

  private generateBusinessLogic(domain: string): string[] {
    const businessLogicMappings = {
      ecommerce: ['Inventory management', 'Payment processing', 'Order fulfillment', 'Customer segmentation'],
      booking: ['Availability management', 'Appointment scheduling', 'Resource allocation', 'Reminder system'],
      social: ['Content moderation', 'User engagement', 'Feed algorithms', 'Privacy controls'],
      crm: ['Lead scoring', 'Sales pipeline', 'Customer segmentation', 'Reporting'],
      blog: ['Content publishing', 'SEO optimization', 'Comment moderation', 'Analytics'],
      marketplace: ['Vendor onboarding', 'Commission calculation', 'Dispute resolution', 'Quality control']
    };

    return businessLogicMappings[domain] || ['Multi-tenant architecture', 'Role-based access'];
  }

  private generatePermissions(roles: string[]): { [key: string]: string[] } {
    const permissions: { [key: string]: string[] } = {};
    
    for (const role of roles) {
      if (role.includes('admin')) {
        permissions[role] = ['create', 'read', 'update', 'delete', 'manage_users', 'manage_settings'];
      } else if (role.includes('manager') || role.includes('provider') || role.includes('merchant')) {
        permissions[role] = ['create', 'read', 'update', 'manage_own'];
      } else {
        permissions[role] = ['read', 'create_own', 'update_own'];
      }
    }

    return permissions;
  }

  private generateDomainRecommendations(domain: string): string[] {
    const recommendationMappings = {
      ecommerce: ['Implement secure payment gateway', 'Add inventory tracking', 'Set up automated emails'],
      booking: ['Add calendar integration', 'Implement SMS notifications', 'Set up automated reminders'],
      social: ['Implement content moderation', 'Add real-time features', 'Optimize for mobile'],
      crm: ['Add email integration', 'Implement lead scoring', 'Set up analytics dashboard'],
      blog: ['Optimize for SEO', 'Add social sharing', 'Implement comment system'],
      marketplace: ['Add vendor verification', 'Implement escrow system', 'Set up review system']
    };

    return recommendationMappings[domain] || ['Use PostgreSQL', 'Implement rate limiting', 'Add comprehensive tests'];
  }

  private generateCodeResponse(): string {
    return `// Generated by Claude AI
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Implementation here...
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}`;
  }

  private generateCorrectionResponse(): string {
    return JSON.stringify({
      diagnosis: 'Type mismatch in Prisma query',
      correctedCode: 'const user = await prisma.user.findUnique({ where: { id: userId } });',
      explanation: 'The error occurred because the ID was passed as string instead of the expected type',
      improvements: ['Add proper TypeScript types', 'Use Zod validation', 'Add error boundaries']
    }, null, 2);
  }

  private generateValidationResponse(): string {
    return JSON.stringify({
      score: 88,
      errors: [],
      warnings: ['Consider adding input validation'],
      optimizations: ['Add database indexes', 'Implement caching'],
      isProductionReady: true
    }, null, 2);
  }

  private generateOptimizationResponse(): string {
    return JSON.stringify({
      performanceOptimizations: ['Enable Next.js static optimization', 'Add Redis caching'],
      securityEnhancements: ['Add CSRF protection', 'Implement rate limiting'],
      seoImprovements: ['Add meta tags', 'Generate sitemap'],
      monitoringSetup: ['Sentry error tracking', 'Analytics integration'],
      deploymentConfig: { platform: 'Vercel', database: 'PostgreSQL' }
    }, null, 2);
  }

  /**
   * Statistiques d'utilisation
   */
  getUsageStats(): { totalTokens: number; requestCount: number; averageTokensPerRequest: number; remainingTokens: number } {
    return {
      totalTokens: this.totalTokensUsed,
      requestCount: this.requestCount,
      averageTokensPerRequest: this.requestCount > 0 ? Math.round(this.totalTokensUsed / this.requestCount) : 0,
      remainingTokens: this.maxTokensPerProject - this.totalTokensUsed
    };
  }

  /**
   * Reset des compteurs pour un nouveau projet
   */
  resetForNewProject(): void {
    this.totalTokensUsed = 0;
    this.requestCount = 0;
    console.log(chalk.blue('🔄 Compteurs Claude réinitialisés pour nouveau projet'));
  }
}

// Instance globale de l'intégration Claude
export const claudeIntegration = new ClaudeIntegration();