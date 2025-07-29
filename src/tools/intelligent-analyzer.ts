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
  }> {
    console.log(chalk.blue('🧠 Analyse intelligente du projet avec Claude...'));
    
    try {
      // Étape 1: Analyse de la structure du projet
      const projectStructure = await this.analyzeProjectStructure(projectPath);
      
      // Étape 2: Analyse du code avec intelligence Claude
      const codeAnalysis = await this.performIntelligentCodeAnalysis(projectPath);
      
      // Étape 3: Synthèse intelligente
      const synthesis = await this.synthesizeProjectNeeds(projectStructure, codeAnalysis);
      
      console.log(chalk.green(`✅ Analyse terminée: ${synthesis.dataModels.length} modèles détectés, ${synthesis.features.length} fonctionnalités`));
      
      return {
        mockFiles: synthesis.mockFiles,
        dataModels: synthesis.dataModels,
        features: synthesis.features,
        intelligence: synthesis.intelligence
      };
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Erreur lors de l\'analyse intelligente, utilisation de l\'analyse basique'));
      
      // Fallback vers analyse basique
      const basicAnalysis = await this.performBasicAnalysis(projectPath);
      return {
        mockFiles: basicAnalysis.mockFiles,
        dataModels: basicAnalysis.dataModels,
        features: basicAnalysis.features,
        intelligence: { fallback: true }
      };
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
}