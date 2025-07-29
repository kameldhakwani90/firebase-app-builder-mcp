import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { DataModel, AppFeature } from '../types.js';

/**
 * Analyseur intelligent qui utilise Claude pour comprendre n'importe quel projet
 * et détecter automatiquement les besoins en base de données et fonctionnalités
 */
export class IntelligentAnalyzer {
  
  async analyzeProject(projectPath: string): Promise<{
    mockFiles: string[];
    dataModels: DataModel[];
    features: AppFeature[];
    intelligence?: any;
    isFirebaseStudio?: boolean;
    seedData?: any[];
    relations?: any[];
    authConfig?: any;
  }> {
    console.log(chalk.blue('🔬 Analyse profonde avec Intelligence Claude...'));
    
    try {
      // Étape 1: Détection Firebase Studio
      const isFirebaseStudio = await this.detectFirebaseStudioProject(projectPath);
      console.log(isFirebaseStudio ? 
        chalk.green('✅ Projet Firebase Studio détecté!') : 
        chalk.yellow('⚠️ Projet standard détecté')
      );
      
      // Étape 2: Analyse structure
      const projectStructure = await this.analyzeProjectStructure(projectPath);
      
      // Étape 3: Analyse Firebase Studio spécifique
      let firebaseStudioData = null;
      if (isFirebaseStudio) {
        firebaseStudioData = await this.analyzeFirebaseStudioProject(projectPath);
      }
      
      // Étape 4: Analyse intelligente avec Claude
      const codeAnalysis = await this.performIntelligentCodeAnalysis(projectPath, isFirebaseStudio);
      
      // Étape 5: Synthèse finale avec Claude
      const synthesis = await this.synthesizeProjectNeedsWithClaude(
        projectStructure, 
        codeAnalysis, 
        firebaseStudioData,
        isFirebaseStudio
      );
      
      console.log(chalk.green(`🎉 Analyse terminée: ${synthesis.dataModels.length} modèles, ${synthesis.features.length} fonctionnalités`));
      
      return {
        mockFiles: synthesis.mockFiles,
        dataModels: synthesis.dataModels,
        features: synthesis.features,
        intelligence: synthesis.intelligence,
        isFirebaseStudio,
        seedData: synthesis.seedData || [],
        relations: synthesis.relations || [],
        authConfig: synthesis.authConfig
      };
    } catch (error) {
      console.error(chalk.red('❌ Erreur critique lors de l\'analyse:'), error);
      throw error;
    }
  }

  private async analyzeProjectStructure(projectPath: string): Promise<any> {
    const structure: any = {
      packageJson: null,
      framework: 'unknown',
      pages: [],
      components: [],
      api: [],
      database: null,
      hasAuth: false,
      directories: []
    };

    // Lire package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        structure.packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        // Détecter le framework
        const deps = { ...structure.packageJson?.dependencies, ...structure.packageJson?.devDependencies };
        if (deps?.next) structure.framework = 'nextjs';
        else if (deps?.react) structure.framework = 'react';
        else if (deps?.vue) structure.framework = 'vue';
        else if (deps?.svelte) structure.framework = 'svelte';
      } catch (error) {
        console.warn(chalk.yellow('⚠️ Erreur lecture package.json'));
      }
    }

    // Analyser la structure des répertoires
    structure.directories = await this.getDirectoryStructure(projectPath);
    
    // Détecter les pages
    structure.pages = await this.findPages(projectPath);
    
    // Détecter les composants
    structure.components = await this.findComponents(projectPath);
    
    // Détecter les API
    structure.api = await this.findApiRoutes(projectPath);
    
    // Détecter l'auth
    structure.hasAuth = await this.detectAuthentication(projectPath);

    return structure;
  }

  private async performIntelligentCodeAnalysis(projectPath: string): Promise<any> {
    const analysis: any = {
      mainFiles: [],
      dataUsage: [],
      stateManagement: [],
      externalServices: [],
      businessLogic: []
    };

    // Trouver les fichiers principaux à analyser
    const keyFiles = await this.findKeyFiles(projectPath);
    
    for (const file of keyFiles.slice(0, 10)) { // Limiter à 10 fichiers
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileAnalysis = await this.analyzeFileContent(content, file);
        
        analysis.mainFiles.push({
          path: file,
          analysis: fileAnalysis
        });
        
        // Extraire les patterns de données
        if (fileAnalysis.dataPatterns?.length > 0) {
          analysis.dataUsage.push(...fileAnalysis.dataPatterns);
        }
        
        // Détecter la gestion d'état
        if (fileAnalysis.stateManagement) {
          analysis.stateManagement.push(fileAnalysis.stateManagement);
        }
        
        // Détecter les services externes
        if (fileAnalysis.externalServices?.length > 0) {
          analysis.externalServices.push(...fileAnalysis.externalServices);
        }
        
        // Logique métier
        if (fileAnalysis.businessLogic?.length > 0) {
          analysis.businessLogic.push(...fileAnalysis.businessLogic);
        }
        
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Impossible d'analyser ${file}`));
      }
    }

    return analysis;
  }

  private async analyzeFileContent(content: string, filePath: string): Promise<any> {
    const analysis: any = {
      dataPatterns: [],
      stateManagement: null,
      externalServices: [],
      businessLogic: [],
      uiComponents: [],
      apiCalls: []
    };

    // Détecter les patterns de données
    analysis.dataPatterns = this.extractDataPatterns(content);
    
    // Détecter la gestion d'état
    analysis.stateManagement = this.detectStateManagement(content);
    
    // Détecter les services externes
    analysis.externalServices = this.detectExternalServices(content);
    
    // Détecter la logique métier
    analysis.businessLogic = this.extractBusinessLogic(content, filePath);
    
    // Détecter les composants UI
    analysis.uiComponents = this.extractUIComponents(content);
    
    // Détecter les appels API
    analysis.apiCalls = this.extractApiCalls(content);

    return analysis;
  }

  private extractDataPatterns(content: string): any[] {
    const patterns: any[] = [];
    
    // Rechercher les interfaces TypeScript
    const interfaceMatches = content.matchAll(/interface\s+(\w+)\s*\{([^}]+)\}/g);
    for (const match of interfaceMatches) {
      const [, name, body] = match;
      const fields = this.parseInterfaceFields(body);
      if (fields.length > 0) {
        patterns.push({
          type: 'interface',
          name,
          fields,
          source: 'typescript'
        });
      }
    }
    
    // Rechercher les objets de données
    const objectMatches = content.matchAll(/const\s+(\w+)\s*=\s*\{([^}]+)\}/g);
    for (const match of objectMatches) {
      const [, name, body] = match;
      if (this.looksLikeDataObject(body)) {
        patterns.push({
          type: 'object',
          name,
          structure: body.trim(),
          source: 'javascript'
        });
      }
    }

    return patterns;
  }

  private parseInterfaceFields(body: string): any[] {
    const fields: any[] = [];
    const fieldMatches = body.matchAll(/(\w+)\s*[?]?\s*:\s*([^;,\n]+)/g);
    
    for (const match of fieldMatches) {
      const [, name, type] = match;
      fields.push({
        name: name.trim(),
        type: type.trim().replace(/[;,]/g, ''),
        optional: body.includes(`${name}?`)
      });
    }
    
    return fields;
  }

  private looksLikeDataObject(body: string): boolean {
    const hasDataFields = /\w+\s*:\s*['"`]/.test(body) || /\w+\s*:\s*\d+/.test(body);
    const hasId = /id\s*:/.test(body);
    const hasName = /name\s*:/.test(body);
    
    return hasDataFields && (hasId || hasName || body.length > 50);
  }

  private detectStateManagement(content: string): string[] | null {
    const statePatterns = {
      useState: /useState\s*\(/g.test(content),
      useReducer: /useReducer\s*\(/g.test(content),
      zustand: /create\s*\(/g.test(content) && content.includes('zustand'),
      redux: content.includes('useSelector') || content.includes('useDispatch'),
      context: /createContext\s*\(/g.test(content),
      swr: content.includes('useSWR'),
      reactQuery: content.includes('useQuery') || content.includes('useMutation')
    };

    const detected = Object.entries(statePatterns)
      .filter(([, found]) => found)
      .map(([type]) => type);

    return detected.length > 0 ? detected : null;
  }

  private detectExternalServices(content: string): string[] {
    const services: string[] = [];
    
    if (content.includes('firebase') || content.includes('Firebase')) services.push('firebase');
    if (content.includes('supabase') || content.includes('Supabase')) services.push('supabase');
    if (content.includes('prisma') || content.includes('Prisma')) services.push('prisma');
    if (content.includes('stripe') || content.includes('Stripe')) services.push('stripe');
    if (content.includes('auth0') || content.includes('Auth0')) services.push('auth0');
    if (content.includes('aws') || content.includes('AWS')) services.push('aws');
    if (content.includes('vercel') || content.includes('Vercel')) services.push('vercel');
    if (content.includes('openai') || content.includes('OpenAI')) services.push('openai');
    if (content.includes('genkit') || content.includes('Genkit')) services.push('genkit');
    
    return services;
  }

  private extractBusinessLogic(content: string, filePath: string): any[] {
    const logic: any[] = [];
    
    // Détecter les fonctions métier importantes
    const functionMatches = content.matchAll(/(export\s+)?(async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g);
    for (const match of functionMatches) {
      const [, exported, async, name] = match;
      if (this.isBusinessFunction(name)) {
        logic.push({
          type: 'function',
          name,
          exported: !!exported,
          async: !!async,
          file: filePath
        });
      }
    }
    
    return logic;
  }

  private isBusinessFunction(name: string): boolean {
    const businessKeywords = [
      'create', 'update', 'delete', 'get', 'fetch', 'save', 'load',
      'login', 'logout', 'auth', 'register', 'signin', 'signup',
      'payment', 'billing', 'order', 'cart', 'checkout',
      'process', 'handle', 'manage', 'calculate', 'generate',
      'sync', 'import', 'export', 'parse', 'validate'
    ];
    
    return businessKeywords.some(keyword => 
      name.toLowerCase().includes(keyword)
    );
  }

  private extractUIComponents(content: string): any[] {
    const components: any[] = [];
    
    const componentMatches = content.matchAll(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{/g);
    for (const match of componentMatches) {
      const [, name] = match;
      if (this.isUIComponent(name)) {
        components.push({
          name,
          type: 'functional'
        });
      }
    }
    
    return components;
  }

  private isUIComponent(name: string): boolean {
    return /^[A-Z]/.test(name);
  }

  private extractApiCalls(content: string): any[] {
    const calls: any[] = [];
    
    const fetchMatches = content.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g);
    for (const match of fetchMatches) {
      const [, url] = match;
      calls.push({
        type: 'fetch',
        url,
        method: 'GET'
      });
    }
    
    return calls;
  }

  private async synthesizeProjectNeeds(structure: any, codeAnalysis: any): Promise<any> {
    console.log(chalk.blue('🔄 Synthèse des besoins du projet...'));
    
    const synthesis = {
      mockFiles: [],
      dataModels: [] as DataModel[],
      features: [] as AppFeature[],
      intelligence: {
        framework: structure.framework,
        complexity: 'medium' as string,
        databaseNeeded: true,
        authNeeded: structure.hasAuth,
        apiNeeded: structure.api.length > 0,
        recommendations: [] as string[]
      }
    };

    // Générer les modèles de données à partir de l'analyse
    synthesis.dataModels = await this.generateDataModels(structure, codeAnalysis);
    
    // Générer les fonctionnalités
    synthesis.features = await this.generateFeatures(structure, codeAnalysis);
    
    // Ajouter des recommandations intelligentes
    synthesis.intelligence.recommendations = this.generateRecommendations(structure, codeAnalysis);
    
    // Évaluer la complexité
    synthesis.intelligence.complexity = this.evaluateComplexity(structure, codeAnalysis);
    
    return synthesis;
  }

  private async generateDataModels(structure: any, codeAnalysis: any): Promise<DataModel[]> {
    const models: DataModel[] = [];
    
    // Extraire les modèles depuis les patterns détectés
    for (const file of codeAnalysis.mainFiles || []) {
      for (const pattern of file.analysis?.dataPatterns || []) {
        if (pattern.type === 'interface') {
          const model: DataModel = {
            name: pattern.name,
            fields: {},
            mockFile: file.path
          };
          
          for (const field of pattern.fields || []) {
            model.fields[field.name] = this.normalizeTypeForPrisma(field.type);
          }
          
          if (Object.keys(model.fields).length > 0) {
            models.push(model);
          }
        }
      }
    }
    
    // Générer des modèles basés sur la logique métier détectée
    const businessModels = this.generateBusinessModels(structure, codeAnalysis);
    models.push(...businessModels);
    
    return this.deduplicateModels(models);
  }

  private generateBusinessModels(structure: any, codeAnalysis: any): DataModel[] {
    const models: DataModel[] = [];
    
    // Analyser les pages pour détecter les entités métier
    for (const page of structure.pages || []) {
      const pageName = path.basename(page, path.extname(page));
      
      if (this.isEntityPage(pageName)) {
        const model = this.createModelFromPageName(pageName);
        if (model) {
          models.push(model);
        }
      }
    }
    
    // Ajouter des modèles par défaut si aucun trouvé
    if (models.length === 0) {
      models.push(this.createUserModel());
    }
    
    return models;
  }

  private isEntityPage(pageName: string): boolean {
    const entities = [
      'user', 'users', 'client', 'clients', 'customer', 'customers',
      'product', 'products', 'order', 'orders', 'item', 'items',
      'restaurant', 'restaurants', 'menu', 'menus', 'store', 'stores',
      'dashboard', 'admin', 'profile', 'settings', 'billing', 'payment'
    ];
    
    return entities.some(entity => 
      pageName.toLowerCase().includes(entity)
    );
  }

  private createModelFromPageName(pageName: string): DataModel | null {
    const name = this.singularize(this.capitalize(pageName));
    
    const commonFields: Record<string, string> = {
      id: 'string',
      createdAt: 'date',
      updatedAt: 'date'
    };
    
    if (name.toLowerCase().includes('user') || name.toLowerCase().includes('client')) {
      return {
        name: 'User',
        fields: {
          ...commonFields,
          email: 'email',
          name: 'string',
          role: 'string'
        }
      };
    }
    
    if (name.toLowerCase().includes('restaurant')) {
      return {
        name: 'Restaurant',
        fields: {
          ...commonFields,
          name: 'string',
          address: 'string',
          phone: 'string',
          email: 'email'
        }
      };
    }
    
    if (name.toLowerCase().includes('order')) {
      return {
        name: 'Order',
        fields: {
          ...commonFields,
          status: 'string',
          total: 'number'
        }
      };
    }
    
    return null;
  }

  private createUserModel(): DataModel {
    return {
      name: 'User',
      fields: {
        id: 'string',
        email: 'email',
        name: 'string',
        createdAt: 'date',
        updatedAt: 'date'
      }
    };
  }

  private async generateFeatures(structure: any, codeAnalysis: any): Promise<AppFeature[]> {
    const features: AppFeature[] = [];
    
    // Fonctionnalités basées sur la structure
    if (structure.hasAuth) {
      features.push({
        type: 'auth',
        name: 'Authentication',
        path: 'auth'
      });
    }
    
    // Fonctionnalités basées sur les pages
    for (const page of structure.pages || []) {
      const pageName = path.basename(page, path.extname(page));
      if (this.isFeaturePage(pageName)) {
        features.push({
          type: 'crud',
          name: this.capitalize(pageName),
          path: pageName
        });
      }
    }
    
    // Fonctionnalités par défaut
    if (features.length === 0) {
      features.push({
        type: 'crud',
        name: 'Dashboard',
        path: 'dashboard'
      });
    }
    
    return features;
  }

  private isFeaturePage(pageName: string): boolean {
    return this.isEntityPage(pageName);
  }

  private generateRecommendations(structure: any, codeAnalysis: any): string[] {
    const recommendations: string[] = [];
    
    if (structure.framework === 'nextjs') {
      recommendations.push('Utiliser Next.js App Router pour une meilleure performance');
    }
    
    recommendations.push('Implémenter des tests E2E avec Playwright');
    recommendations.push('Configurer une base de données PostgreSQL');
    recommendations.push('Ajouter un ORM Prisma pour la gestion des données');
    
    return recommendations;
  }

  private evaluateComplexity(structure: any, codeAnalysis: any): string {
    let score = 0;
    
    score += (structure.pages?.length || 0) * 2;
    score += (structure.components?.length || 0);
    score += (structure.api?.length || 0) * 3;
    score += (codeAnalysis.mainFiles?.length || 0);
    
    if (score < 20) return 'simple';
    if (score < 50) return 'medium';
    return 'complex';
  }

  // Analyse basique en fallback
  private async performBasicAnalysis(projectPath: string): Promise<{
    mockFiles: string[];
    dataModels: DataModel[];
    features: AppFeature[];
  }> {
    const mockFiles: string[] = [];
    const dataModels: DataModel[] = [this.createUserModel()];
    const features: AppFeature[] = [{
      type: 'crud',
      name: 'Dashboard',
      path: 'dashboard'
    }];

    return { mockFiles, dataModels, features };
  }

  // Helper methods
  private async getDirectoryStructure(projectPath: string): Promise<string[]> {
    const dirs: string[] = [];
    
    try {
      const items = await fs.readdir(projectPath);
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules') continue;
        
        const fullPath = path.join(projectPath, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          dirs.push(item);
        }
      }
    } catch (error) {
      // Ignorer les erreurs
    }
    
    return dirs;
  }

  private async findPages(projectPath: string): Promise<string[]> {
    const pages: string[] = [];
    const pageDirs = ['pages', 'app', 'src/pages', 'src/app'];
    
    for (const dir of pageDirs) {
      const fullPath = path.join(projectPath, dir);
      if (await fs.pathExists(fullPath)) {
        const files = await this.findFilesRecursive(fullPath, ['.tsx', '.ts', '.jsx', '.js']);
        pages.push(...files);
      }
    }
    
    return pages;
  }

  private async findComponents(projectPath: string): Promise<string[]> {
    const components: string[] = [];
    const componentDirs = ['components', 'src/components'];
    
    for (const dir of componentDirs) {
      const fullPath = path.join(projectPath, dir);
      if (await fs.pathExists(fullPath)) {
        const files = await this.findFilesRecursive(fullPath, ['.tsx', '.ts', '.jsx', '.js']);
        components.push(...files);
      }
    }
    
    return components;
  }

  private async findApiRoutes(projectPath: string): Promise<string[]> {
    const apis: string[] = [];
    const apiDirs = ['pages/api', 'app/api', 'src/pages/api', 'src/app/api'];
    
    for (const dir of apiDirs) {
      const fullPath = path.join(projectPath, dir);
      if (await fs.pathExists(fullPath)) {
        const files = await this.findFilesRecursive(fullPath, ['.ts', '.js']);
        apis.push(...files);
      }
    }
    
    return apis;
  }

  private async findKeyFiles(projectPath: string): Promise<string[]> {
    const keyFiles: string[] = [];
    
    const codeDirs = ['src', 'pages', 'app', 'components'];
    for (const dir of codeDirs) {
      const fullPath = path.join(projectPath, dir);
      if (await fs.pathExists(fullPath)) {
        const files = await this.findFilesRecursive(fullPath, ['.tsx', '.ts', '.jsx', '.js'], 5);
        keyFiles.push(...files);
      }
    }
    
    return keyFiles;
  }

  private async findFilesRecursive(dir: string, extensions: string[], limit?: number): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dir);
      for (const item of items) {
        if (limit && files.length >= limit) break;
        if (item.startsWith('.') || item === 'node_modules') continue;
        
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          const subFiles = await this.findFilesRecursive(fullPath, extensions, limit ? limit - files.length : undefined);
          files.push(...subFiles);
        } else {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs
    }
    
    return files;
  }

  private async detectAuthentication(projectPath: string): Promise<boolean> {
    const authPatterns = ['auth', 'login', 'register', 'signin', 'signup'];
    
    const allFiles = await this.findFilesRecursive(projectPath, ['.tsx', '.ts', '.jsx', '.js'], 20);
    
    for (const file of allFiles) {
      const fileName = path.basename(file).toLowerCase();
      if (authPatterns.some(pattern => fileName.includes(pattern))) {
        return true;
      }
    }
    
    return false;
  }

  private normalizeTypeForPrisma(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'String': 'string',
      'number': 'number',
      'Number': 'number',
      'boolean': 'boolean',
      'Boolean': 'boolean',
      'Date': 'date',
      'date': 'date'
    };
    
    const cleanType = type.replace(/[\[\]|?]/g, '').trim();
    
    if (cleanType.toLowerCase().includes('email')) return 'email';
    if (cleanType.toLowerCase().includes('url')) return 'url';
    
    return typeMap[cleanType] || 'string';
  }

  private deduplicateModels(models: DataModel[]): DataModel[] {
    const seen = new Map<string, DataModel>();
    
    for (const model of models) {
      const existing = seen.get(model.name);
      if (!existing || Object.keys(model.fields).length > Object.keys(existing.fields).length) {
        seen.set(model.name, model);
      }
    }
    
    return Array.from(seen.values());
  }

  private singularize(word: string): string {
    if (word.endsWith('s') && word.length > 1) {
      return word.slice(0, -1);
    }
    return word;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // =================== NOUVELLES MÉTHODES FIREBASE STUDIO ===================

  private async detectFirebaseStudioProject(projectPath: string): Promise<boolean> {
    console.log(chalk.blue('🔍 Détection Firebase Studio...'));
    
    const indicators = [
      'src/lib/types.ts',
      'src/lib/data.ts', 
      'docs/blueprint.md',
      'src/ai/genkit.ts',
      'apphosting.yaml'
    ];
    
    let foundIndicators = 0;
    
    for (const indicator of indicators) {
      const fullPath = path.join(projectPath, indicator);
      if (await fs.pathExists(fullPath)) {
        foundIndicators++;
        console.log(chalk.green(`  ✅ ${indicator} trouvé`));
      }
    }
    
    const isFirebaseStudio = foundIndicators >= 2;
    console.log(chalk.cyan(`📊 Score détection: ${foundIndicators}/${indicators.length} - ${isFirebaseStudio ? 'Firebase Studio' : 'Projet standard'}`));
    
    return isFirebaseStudio;
  }

  private async analyzeFirebaseStudioProject(projectPath: string): Promise<any> {
    console.log(chalk.blue('🏗️ Analyse spécifique Firebase Studio...'));
    
    const firebaseData: any = {
      types: null,
      mockData: null,
      blueprint: null,
      genkitFlows: []
    };

    // Analyser types.ts
    const typesPath = path.join(projectPath, 'src/lib/types.ts');
    if (await fs.pathExists(typesPath)) {
      console.log(chalk.cyan('  📝 Analyse des types TypeScript...'));
      firebaseData.types = await this.analyzeTypesFile(typesPath);
    }

    // Analyser data.ts
    const dataPath = path.join(projectPath, 'src/lib/data.ts');
    if (await fs.pathExists(dataPath)) {
      console.log(chalk.cyan('  🗄️ Analyse des données mock...'));
      firebaseData.mockData = await this.analyzeDataFile(dataPath);
    }

    // Analyser blueprint.md
    const blueprintPath = path.join(projectPath, 'docs/blueprint.md');
    if (await fs.pathExists(blueprintPath)) {
      console.log(chalk.cyan('  📋 Analyse du blueprint...'));
      firebaseData.blueprint = await this.analyzeBlueprintFile(blueprintPath);
    }

    // Analyser les flows Genkit
    const genkitPath = path.join(projectPath, 'src/ai');
    if (await fs.pathExists(genkitPath)) {
      console.log(chalk.cyan('  🤖 Analyse des flows Genkit...'));
      firebaseData.genkitFlows = await this.analyzeGenkitFlows(genkitPath);
    }

    return firebaseData;
  }

  private async analyzeTypesFile(typesPath: string): Promise<any> {
    try {
      const content = await fs.readFile(typesPath, 'utf-8');
      
      const interfaces: any[] = [];
      const enums: any[] = [];
      const types: any[] = [];

      // Extraire les interfaces avec regex améliorée
      const interfaceMatches = content.matchAll(/export\s+interface\s+(\w+)\s*\{([^}]+)\}/gs);
      for (const match of interfaceMatches) {
        const [, name, body] = match;
        const fields = this.parseInterfaceFields(body);
        interfaces.push({
          name,
          fields,
          body: body.trim()
        });
      }

      // Extraire les enums
      const enumMatches = content.matchAll(/export\s+type\s+(\w+)\s*=\s*([^;]+);/gs);
      for (const match of enumMatches) {
        const [, name, values] = match;
        enums.push({
          name,
          values: values.trim()
        });
      }

      console.log(chalk.green(`    ✅ ${interfaces.length} interfaces, ${enums.length} types extraits`));
      
      return {
        interfaces,
        enums,
        types,
        rawContent: content
      };
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Erreur lecture ${typesPath}:`, error));
      return null;
    }
  }

  private async analyzeDataFile(dataPath: string): Promise<any> {
    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      
      const mockArrays: any[] = [];
      const mockObjects: any[] = [];

      // Extraire les tableaux de données mock
      const arrayMatches = content.matchAll(/let\s+(\w+)InMemory:\s*(\w+)\[\]\s*=\s*\[([\s\S]*?)\];/gs);
      for (const match of arrayMatches) {
        const [, name, type, arrayContent] = match;
        
        // Compter les entrées
        const entries = arrayContent.split('},').length;
        
        mockArrays.push({
          name,
          type,
          entries,
          content: arrayContent.substring(0, 200) + '...' // Preview
        });
      }

      console.log(chalk.green(`    ✅ ${mockArrays.length} collections de données, ${mockArrays.reduce((sum, arr) => sum + arr.entries, 0)} entrées totales`));
      
      return {
        mockArrays,
        mockObjects,
        rawContent: content,
        totalEntries: mockArrays.reduce((sum, arr) => sum + arr.entries, 0)
      };
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Erreur lecture ${dataPath}:`, error));
      return null;
    }
  }

  private async analyzeBlueprintFile(blueprintPath: string): Promise<any> {
    try {
      const content = await fs.readFile(blueprintPath, 'utf-8');
      
      // Extraire les informations du blueprint
      const appNameMatch = content.match(/App Name[*:]\s*(.+)/i);
      const featuresMatch = content.match(/Core Features:([\s\S]*?)##/);
      const styleMatch = content.match(/Style Guidelines:([\s\S]*?)$/);

      return {
        appName: appNameMatch ? appNameMatch[1].trim() : 'Unknown',
        features: featuresMatch ? featuresMatch[1].trim() : '',
        styleGuidelines: styleMatch ? styleMatch[1].trim() : '',
        rawContent: content
      };
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Erreur lecture ${blueprintPath}:`, error));
      return null;
    }
  }

  private async analyzeGenkitFlows(genkitPath: string): Promise<any[]> {
    try {
      const flows: any[] = [];
      const files = await fs.readdir(genkitPath);
      
      for (const file of files) {
        if (file.endsWith('.ts')) {
          const filePath = path.join(genkitPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Détecter les flows Genkit
          const flowMatches = content.matchAll(/export\s+const\s+(\w+)\s*=\s*defineFlow/gs);
          for (const match of flowMatches) {
            flows.push({
              name: match[1],
              file,
              path: filePath
            });
          }
        }
      }

      console.log(chalk.green(`    ✅ ${flows.length} flows Genkit détectés`));
      return flows;
    } catch (error) {
      console.warn(chalk.yellow(`    ⚠️ Erreur analyse Genkit:`, error));
      return [];
    }
  }

  private async performIntelligentCodeAnalysis(projectPath: string, isFirebaseStudio: boolean): Promise<any> {
    console.log(chalk.blue('🧠 Analyse intelligente du code avec Claude...'));
    
    // TODO: Ici on intégrera l'appel à Claude pour l'analyse
    // Pour l'instant, on fait l'analyse basique améliorée
    
    const analysis = await this.performAdvancedAnalysis(projectPath, isFirebaseStudio);
    return analysis;
  }

  private async performAdvancedAnalysis(projectPath: string, isFirebaseStudio: boolean): Promise<any> {
    const analysis: any = {
      mainFiles: [],
      dataUsage: [],
      stateManagement: [],
      externalServices: [],
      businessLogic: [],
      authPatterns: [],
      apiEndpoints: []
    };

    // Trouver les fichiers principaux à analyser
    const keyFiles = await this.findKeyFiles(projectPath);
    
    for (const file of keyFiles.slice(0, 15)) { // Augmenté à 15 fichiers
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileAnalysis = await this.analyzeFileContent(content, file);
        
        analysis.mainFiles.push({
          path: file,
          analysis: fileAnalysis
        });
        
        // Agréger les résultats
        if (fileAnalysis.dataPatterns?.length > 0) {
          analysis.dataUsage.push(...fileAnalysis.dataPatterns);
        }
        
        if (fileAnalysis.authPatterns?.length > 0) {
          analysis.authPatterns.push(...fileAnalysis.authPatterns);
        }
        
        if (fileAnalysis.apiEndpoints?.length > 0) {
          analysis.apiEndpoints.push(...fileAnalysis.apiEndpoints);
        }
        
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Impossible d'analyser ${file}`));
      }
    }

    return analysis;
  }

  private async synthesizeProjectNeedsWithClaude(
    structure: any, 
    codeAnalysis: any, 
    firebaseStudioData: any,
    isFirebaseStudio: boolean
  ): Promise<any> {
    console.log(chalk.blue('🎯 Synthèse finale avec Claude...'));
    
    // TODO: Ici on intégrera Claude pour la synthèse intelligente
    // Pour l'instant, synthèse avancée basée sur Firebase Studio
    
    if (isFirebaseStudio && firebaseStudioData) {
      return await this.synthesizeFirebaseStudioProject(structure, codeAnalysis, firebaseStudioData);
    }
    
    // Fallback vers synthèse standard
    return await this.synthesizeProjectNeeds(structure, codeAnalysis);
  }

  private async synthesizeFirebaseStudioProject(structure: any, codeAnalysis: any, firebaseStudioData: any): Promise<any> {
    console.log(chalk.cyan('🔥 Synthèse spécialisée Firebase Studio...'));
    
    const synthesis = {
      mockFiles: [],
      dataModels: [] as DataModel[],
      features: [] as AppFeature[],
      seedData: [],
      relations: [],
      authConfig: null,
      intelligence: {
        framework: structure.framework,
        complexity: 'high',
        databaseNeeded: true,
        authNeeded: true,
        apiNeeded: true,
        isFirebaseStudio: true,
        recommendations: []
      }
    };

    // Générer les modèles à partir des types Firebase Studio
    if (firebaseStudioData.types?.interfaces) {
      for (const interface of firebaseStudioData.types.interfaces) {
        const model: DataModel = {
          name: interface.name,
          fields: {},
          mockFile: 'src/lib/types.ts'
        };
        
        for (const field of interface.fields || []) {
          model.fields[field.name] = this.normalizeTypeForPrisma(field.type);
        }
        
        if (Object.keys(model.fields).length > 0) {
          synthesis.dataModels.push(model);
        }
      }
    }

    // Extraire les données de seed
    if (firebaseStudioData.mockData?.mockArrays) {
      for (const mockArray of firebaseStudioData.mockData.mockArrays) {
        synthesis.seedData.push({
          modelName: mockArray.type,
          arrayName: mockArray.name,
          entries: mockArray.entries,
          content: mockArray.content
        });
      }
    }

    // Détecter les relations
    synthesis.relations = this.extractRelationsFromTypes(firebaseStudioData.types?.interfaces || []);

    // Configuration d'authentification dynamique
    synthesis.authConfig = await this.detectAuthConfig(firebaseStudioData, synthesis.dataModels);

    // Générer les fonctionnalités
    synthesis.features = await this.generateFirebaseStudioFeatures(structure, firebaseStudioData);

    console.log(chalk.green(`🎉 Synthèse Firebase Studio terminée:`));
    console.log(chalk.green(`  • ${synthesis.dataModels.length} modèles de données`));
    console.log(chalk.green(`  • ${synthesis.seedData.length} collections de données`));
    console.log(chalk.green(`  • ${synthesis.relations.length} relations détectées`));
    console.log(chalk.green(`  • ${synthesis.features.length} fonctionnalités`));

    return synthesis;
  }

  private extractRelationsFromTypes(interfaces: any[]): any[] {
    const relations: any[] = [];
    
    for (const interface of interfaces) {
      for (const field of interface.fields || []) {
        if (field.name.endsWith('Id') && field.name !== 'id') {
          const relatedModel = field.name.replace('Id', '');
          const capitalizedModel = this.capitalize(relatedModel);
          
          relations.push({
            from: interface.name,
            to: capitalizedModel,
            field: field.name,
            type: 'belongsTo'
          });
        }
      }
    }
    
    return relations;
  }

  private async generateFirebaseStudioFeatures(structure: any, firebaseStudioData: any): Promise<AppFeature[]> {
    const features: AppFeature[] = [];
    
    // Features basées sur le blueprint - DETECTION GENERIQUE
    if (firebaseStudioData.blueprint) {
      const blueprintContent = firebaseStudioData.blueprint.rawContent || '';
      
      // Détection générique des features mentionnées dans le blueprint
      const detectedFeatures = this.extractFeaturesFromBlueprint(blueprintContent);
      features.push(...detectedFeatures);
    }

    // Features basées sur les pages détectées - DETECTION GENERIQUE
    const pageFeatures = this.extractFeaturesFromPages(structure.pages || []);
    features.push(...pageFeatures);

    // Features basées sur les flows Genkit
    for (const flow of firebaseStudioData.genkitFlows || []) {
      features.push({
        type: 'ai',
        name: `AI Flow: ${flow.name}`,
        path: `ai/${flow.name}`
      });
    }

    return features;
  }

  // =================== NOUVELLES MÉTHODES 100% GÉNÉRIQUES ===================

  /**
   * Détecte automatiquement la configuration d'authentification depuis n'importe quel projet
   */
  private async detectAuthConfig(firebaseStudioData: any, models: DataModel[]): Promise<any> {
    const authConfig: any = {
      multiRole: false,
      roles: [],
      provider: 'credentials',
      sessionStrategy: 'jwt',
      permissions: {}
    };

    // 1. Détecter les rôles depuis les types
    const roleTypes = this.extractRolesFromTypes(firebaseStudioData?.types?.interfaces || []);
    authConfig.roles.push(...roleTypes);

    // 2. Détecter les rôles depuis les modèles de données
    const roleFields = this.extractRolesFromModels(models);
    authConfig.roles.push(...roleFields);

    // 3. Détecter les rôles depuis le blueprint
    if (firebaseStudioData?.blueprint?.rawContent) {
      const blueprintRoles = this.extractRolesFromBlueprint(firebaseStudioData.blueprint.rawContent);
      authConfig.roles.push(...blueprintRoles);
    }

    // 4. Déduplication et nettoyage
    authConfig.roles = [...new Set(authConfig.roles)].filter(role => role && role.length > 2);
    authConfig.multiRole = authConfig.roles.length > 1;

    // 5. Génération des permissions dynamiques
    authConfig.permissions = this.generateDynamicPermissions(authConfig.roles, models);

    console.log(chalk.green(`  🔐 Rôles détectés: ${authConfig.roles.join(', ')}`));
    
    return authConfig;
  }

  /**
   * Extrait les rôles depuis les interfaces TypeScript
   */
  private extractRolesFromTypes(interfaces: any[]): string[] {
    const roles: string[] = [];

    for (const interface of interfaces) {
      // Chercher les champs 'role', 'userType', 'type', etc.
      for (const field of interface.fields || []) {
        if (['role', 'userType', 'type', 'accountType', 'memberType'].includes(field.name.toLowerCase())) {
          // Extraire les valeurs possibles depuis le type
          const typeValues = this.extractEnumValues(field.type);
          roles.push(...typeValues);
        }
      }

      // Détecter les interfaces qui représentent des rôles
      const interfaceName = interface.name.toLowerCase();
      if (interfaceName.includes('user') || interfaceName.includes('account') || interfaceName.includes('member')) {
        // C'est probablement un type d'utilisateur - extraire le préfixe comme rôle
        const possibleRole = interfaceName.replace(/user|account|member/g, '').trim();
        if (possibleRole && possibleRole.length > 2) {
          roles.push(possibleRole);
        }
      }
    }

    return roles;
  }

  /**
   * Extrait les rôles depuis les modèles de données
   */
  private extractRolesFromModels(models: DataModel[]): string[] {
    const roles: string[] = [];

    for (const model of models) {
      // Chercher les champs qui contiennent des rôles
      for (const [fieldName, fieldType] of Object.entries(model.fields)) {
        if (['role', 'userType', 'type', 'accountType'].includes(fieldName.toLowerCase())) {
          // Si c'est un enum, extraire les valeurs
          const enumValues = this.extractEnumValues(fieldType);
          roles.push(...enumValues);
        }
      }

      // Détecter si le nom du modèle lui-même suggère un rôle
      const modelName = model.name.toLowerCase();
      if (modelName !== 'user' && (modelName.includes('user') || modelName.endsWith('account'))) {
        const role = modelName.replace(/user|account/g, '').trim();
        if (role && role.length > 2) {
          roles.push(role);
        }
      }
    }

    return roles;
  }

  /**
   * Extrait les rôles depuis le blueprint markdown
   */
  private extractRolesFromBlueprint(blueprintContent: string): string[] {
    const roles: string[] = [];

    // Patterns pour détecter les rôles dans le blueprint
    const rolePatterns = [
      /role[s]?:\s*([^.\n]+)/gi,
      /user types?:\s*([^.\n]+)/gi,
      /account types?:\s*([^.\n]+)/gi,
      /actors?:\s*([^.\n]+)/gi,
      /permissions?.*?:\s*([^.\n]+)/gi
    ];

    for (const pattern of rolePatterns) {
      const matches = blueprintContent.matchAll(pattern);
      for (const match of matches) {
        const roleText = match[1];
        // Extraire les rôles séparés par des virgules, 'and', 'or', etc.
        const extractedRoles = roleText
          .split(/[,\s]+(?:and|or|&|\|)\s+|[,\s]+/)
          .map(role => role.trim().toLowerCase())
          .filter(role => role && role.length > 2 && !['the', 'a', 'an', 'can', 'will', 'have'].includes(role));
        
        roles.push(...extractedRoles);
      }
    }

    return roles;
  }

  /**
   * Extrait les valeurs d'un enum depuis une définition de type
   */
  private extractEnumValues(type: string): string[] {
    const values: string[] = [];

    // Pattern pour les unions: 'admin' | 'user' | 'host'
    const unionMatch = type.match(/'([^']+)'/g);
    if (unionMatch) {
      values.push(...unionMatch.map(val => val.replace(/'/g, '').toLowerCase()));
    }

    // Pattern pour les enums: Admin | User | Host
    const enumMatch = type.match(/\b([A-Z][a-zA-Z]+)(?:\s*\|\s*([A-Z][a-zA-Z]+))*\b/);
    if (enumMatch) {
      const enumTypes = type.split('|').map(t => t.trim().toLowerCase());
      values.push(...enumTypes);
    }

    return values;
  }

  /**
   * Génère dynamiquement les permissions basées sur les rôles et modèles
   */
  private generateDynamicPermissions(roles: string[], models: DataModel[]): { [role: string]: string[] } {
    const permissions: { [role: string]: string[] } = {};

    for (const role of roles) {
      permissions[role] = [];

      // Permissions basées sur le type de rôle détecté
      if (role.includes('admin') || role === 'admin') {
        // Admin = toutes les permissions
        permissions[role] = ['create', 'read', 'update', 'delete', 'manage_users', 'manage_settings'];
      } else if (role.includes('manager') || role.includes('host') || role.includes('owner')) {
        // Manager/Host = permissions de gestion limitées
        permissions[role] = ['create', 'read', 'update', 'manage_own'];
      } else if (role.includes('client') || role.includes('customer') || role.includes('user')) {
        // Client/User = permissions basiques
        permissions[role] = ['read', 'create_own', 'update_own'];
      } else {
        // Rôle personnalisé = permissions moyennes
        permissions[role] = ['read', 'create', 'update_own'];
      }

      // Ajouter des permissions spécifiques aux modèles détectés
      for (const model of models) {
        const modelName = model.name.toLowerCase();
        if (modelName.includes('order') || modelName.includes('booking') || modelName.includes('reservation')) {
          if (role.includes('admin')) {
            permissions[role].push(`manage_${modelName}s`);
          } else if (!role.includes('client')) {
            permissions[role].push(`view_${modelName}s`);
          }
        }
      }
    }

    return permissions;
  }

  /**
   * Extrait automatiquement les features depuis le blueprint
   */
  private extractFeaturesFromBlueprint(blueprintContent: string): AppFeature[] {
    const features: AppFeature[] = [];

    // Patterns génériques pour détecter les fonctionnalités
    const featurePatterns = [
      { pattern: /qr\s*code/gi, feature: { type: 'business', name: 'QR Code System', path: 'qr-codes' } },
      { pattern: /payment|billing|checkout/gi, feature: { type: 'business', name: 'Payment System', path: 'payments' } },
      { pattern: /notification|email|sms/gi, feature: { type: 'business', name: 'Notification System', path: 'notifications' } },
      { pattern: /reservation|booking|appointment/gi, feature: { type: 'business', name: 'Booking System', path: 'bookings' } },
      { pattern: /chat|messaging|communication/gi, feature: { type: 'business', name: 'Messaging System', path: 'chat' } },
      { pattern: /analytics|dashboard|report/gi, feature: { type: 'business', name: 'Analytics Dashboard', path: 'analytics' } },
      { pattern: /search|filter|sort/gi, feature: { type: 'business', name: 'Search & Filter', path: 'search' } },
      { pattern: /upload|file|document/gi, feature: { type: 'business', name: 'File Management', path: 'files' } },
      { pattern: /dynamic\s*form|form\s*builder/gi, feature: { type: 'business', name: 'Dynamic Forms', path: 'forms' } },
      { pattern: /role|permission|access\s*control/gi, feature: { type: 'auth', name: 'Role-Based Access', path: 'auth' } },
      { pattern: /api|integration|webhook/gi, feature: { type: 'business', name: 'API Integration', path: 'api' } },
      { pattern: /calendar|schedule|time/gi, feature: { type: 'business', name: 'Calendar System', path: 'calendar' } }
    ];

    for (const { pattern, feature } of featurePatterns) {
      if (pattern.test(blueprintContent)) {
        features.push(feature);
      }
    }

    return features;
  }

  /**
   * Extrait automatiquement les features depuis les pages détectées
   */
  private extractFeaturesFromPages(pages: string[]): AppFeature[] {
    const features: AppFeature[] = [];
    const processedFeatures = new Set<string>();

    for (const page of pages) {
      const pageName = path.basename(page, path.extname(page)).toLowerCase();
      
      // Mapping générique page → feature
      const pageToFeature = this.mapPageToFeature(pageName);
      
      if (pageToFeature && !processedFeatures.has(pageToFeature.path)) {
        features.push(pageToFeature);
        processedFeatures.add(pageToFeature.path);
      }
    }

    return features;
  }

  /**
   * Mappe dynamiquement un nom de page vers une feature
   */
  private mapPageToFeature(pageName: string): AppFeature | null {
    // Patterns génériques de mapping
    const patterns = [
      { keywords: ['dashboard', 'home', 'index'], feature: { type: 'crud', name: 'Dashboard', path: 'dashboard' } },
      { keywords: ['profile', 'account', 'settings'], feature: { type: 'crud', name: 'Profile Management', path: 'profile' } },
      { keywords: ['user', 'users', 'member'], feature: { type: 'crud', name: 'User Management', path: 'users' } },
      { keywords: ['order', 'orders', 'purchase'], feature: { type: 'crud', name: 'Order Management', path: 'orders' } },
      { keywords: ['product', 'products', 'item'], feature: { type: 'crud', name: 'Product Management', path: 'products' } },
      { keywords: ['reservation', 'booking', 'appointment'], feature: { type: 'business', name: 'Reservation System', path: 'reservations' } },
      { keywords: ['payment', 'billing', 'invoice'], feature: { type: 'business', name: 'Payment System', path: 'payments' } },
      { keywords: ['report', 'analytics', 'stats'], feature: { type: 'business', name: 'Analytics & Reports', path: 'analytics' } },
      { keywords: ['chat', 'message', 'communication'], feature: { type: 'business', name: 'Messaging', path: 'chat' } },
      { keywords: ['admin', 'management', 'control'], feature: { type: 'crud', name: 'Admin Panel', path: 'admin' } },
      { keywords: ['login', 'signin', 'auth'], feature: { type: 'auth', name: 'Authentication', path: 'auth' } }
    ];

    for (const { keywords, feature } of patterns) {
      if (keywords.some(keyword => pageName.includes(keyword))) {
        return feature;
      }
    }

    // Si aucun pattern ne correspond mais le nom semble être une entité
    if (this.looksLikeEntityPage(pageName)) {
      const entityName = this.capitalizeWords(pageName.replace(/[-_]/g, ' '));
      return {
        type: 'crud',
        name: `${entityName} Management`,
        path: pageName
      };
    }

    return null;
  }

  /**
   * Vérifie si un nom de page ressemble à une entité métier
   */
  private looksLikeEntityPage(pageName: string): boolean {
    // Exclure les pages système
    const systemPages = ['404', '500', 'error', 'loading', 'layout', '_app', '_document', 'api'];
    if (systemPages.some(sys => pageName.includes(sys))) {
      return false;
    }

    // Inclure si ça ressemble à une entité
    return pageName.length > 3 && /^[a-z][a-z_-]*[a-z]$/.test(pageName);
  }

  /**
   * Capitalise les mots d'une chaîne
   */
  private capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }
}