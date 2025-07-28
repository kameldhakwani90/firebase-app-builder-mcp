import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { DataModel, AppFeature } from '../types.js';

export class MockAnalyzer {
  
  async analyzeMocks(projectPath: string): Promise<{
    mockFiles: string[];
    dataModels: DataModel[];
    features: AppFeature[];
  }> {
    console.log(chalk.blue('🔍 Analyse des mocks et de la structure...'));
    
    const mockFiles = await this.findMockFiles(projectPath);
    const dataModels = await this.extractDataModels(projectPath, mockFiles);
    const features = await this.detectFeatures(projectPath);
    
    console.log(chalk.green(`✅ Trouvé: ${mockFiles.length} fichiers mock, ${dataModels.length} modèles, ${features.length} fonctionnalités`));
    
    return { mockFiles, dataModels, features };
  }

  private async findMockFiles(projectPath: string): Promise<string[]> {
    const mockFiles: string[] = [];
    const patterns = [
      '**/mockData.*',
      '**/data.*',
      '**/lib/data/**',
      '**/*mock*',
      '**/fixtures/**',
      '**/test-data/**',
      '**/dummy/**'
    ];

    for (const pattern of patterns) {
      const files = await this.globFiles(projectPath, pattern);
      mockFiles.push(...files);
    }

    // Filtrer les doublons et les fichiers inexistants
    const uniqueFiles = [...new Set(mockFiles)];
    const existingFiles = [];
    
    for (const file of uniqueFiles) {
      if (await fs.pathExists(file)) {
        existingFiles.push(file);
      }
    }

    return existingFiles;
  }

  private async globFiles(rootPath: string, pattern: string): Promise<string[]> {
    const files: string[] = [];
    
    async function walkDir(dir: string): Promise<void> {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules et .git
          if (!item.startsWith('.') && item !== 'node_modules') {
            await walkDir(fullPath);
          }
        } else {
          // Vérifier si le fichier correspond au pattern
          if (matchPatternHelper(fullPath, pattern)) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await walkDir(rootPath);
    return files;
  }

  private matchPattern(filePath: string, pattern: string): boolean {
    return matchPatternHelper(filePath, pattern);
  }

  private async extractDataModels(projectPath: string, mockFiles: string[]): Promise<DataModel[]> {
    const models: DataModel[] = [];
    
    for (const mockFile of mockFiles) {
      try {
        const content = await fs.readFile(mockFile, 'utf-8');
        const extractedModels = await this.parseDataFromFile(content, mockFile);
        models.push(...extractedModels);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Impossible de lire ${mockFile}`));
      }
    }

    // Analyse aussi les types TypeScript
    const typeFiles = await this.globFiles(projectPath, '**/*.ts');
    for (const typeFile of typeFiles) {
      if (typeFile.includes('types') || typeFile.includes('interfaces')) {
        try {
          const content = await fs.readFile(typeFile, 'utf-8');
          const typedModels = await this.parseTypesFromFile(content, typeFile);
          models.push(...typedModels);
        } catch (error) {
          // Ignorer les erreurs de lecture
        }
      }
    }

    return this.deduplicateModels(models);
  }

  private async parseDataFromFile(content: string, filePath: string): Promise<DataModel[]> {
    const models: DataModel[] = [];
    
    try {
      // Essayer de parser en JSON
      if (filePath.endsWith('.json')) {
        const data = JSON.parse(content);
        if (Array.isArray(data) && data.length > 0) {
          const model = this.inferModelFromObject(data[0], path.basename(filePath, '.json'));
          model.mockFile = filePath;
          models.push(model);
        }
      }
      
      // Parser les exports JavaScript/TypeScript
      if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
        const exportMatches = content.match(/export\s+const\s+(\w+)\s*=\s*\[([^\]]+)\]/g);
        if (exportMatches) {
          for (const match of exportMatches) {
            const nameMatch = match.match(/export\s+const\s+(\w+)/);
            if (nameMatch) {
              const modelName = nameMatch[1];
              // Essayer d'extraire la structure depuis le premier élément
              const arrayMatch = match.match(/\[([^\]]+)\]/);
              if (arrayMatch) {
                try {
                  const firstObjectMatch = arrayMatch[1].match(/\{[^}]+\}/);
                  if (firstObjectMatch) {
                    const objStr = firstObjectMatch[0];
                    const obj = eval(`(${objStr})`); // Attention: eval en production
                    const model = this.inferModelFromObject(obj, modelName);
                    model.mockFile = filePath;
                    models.push(model);
                  }
                } catch (e) {
                  // Ignorer les erreurs de parsing
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Erreur parsing ${filePath}`));
    }
    
    return models;
  }

  private async parseTypesFromFile(content: string, filePath: string): Promise<DataModel[]> {
    const models: DataModel[] = [];
    
    // Extraire les interfaces TypeScript
    const interfaceMatches = content.match(/interface\s+(\w+)\s*\{([^}]+)\}/g);
    if (interfaceMatches) {
      for (const match of interfaceMatches) {
        const nameMatch = match.match(/interface\s+(\w+)/);
        const bodyMatch = match.match(/\{([^}]+)\}/);
        
        if (nameMatch && bodyMatch) {
          const name = nameMatch[1];
          const body = bodyMatch[1];
          
          const fields: Record<string, string> = {};
          const fieldMatches = body.match(/(\w+)\s*:\s*([^;,\n]+)/g);
          
          if (fieldMatches) {
            for (const fieldMatch of fieldMatches) {
              const [, fieldName, fieldType] = fieldMatch.match(/(\w+)\s*:\s*([^;,\n]+)/) || [];
              if (fieldName && fieldType) {
                fields[fieldName] = this.normalizeType(fieldType.trim());
              }
            }
          }
          
          if (Object.keys(fields).length > 0) {
            models.push({
              name,
              fields,
              mockFile: filePath
            });
          }
        }
      }
    }
    
    return models;
  }

  private inferModelFromObject(obj: any, name: string): DataModel {
    const fields: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      fields[key] = this.inferType(value);
    }
    
    return {
      name: this.capitalize(name),
      fields
    };
  }

  private inferType(value: any): string {
    if (typeof value === 'string') {
      if (value.includes('@')) return 'email';
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
      if (value.startsWith('http')) return 'url';
      return 'string';
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (value && typeof value === 'object') return 'object';
    return 'string';
  }

  private normalizeType(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'Date': 'date',
      'string[]': 'array',
      'number[]': 'array'
    };
    
    return typeMap[type] || 'string';
  }

  private async detectFeatures(projectPath: string): Promise<AppFeature[]> {
    const features: AppFeature[] = [];
    
    // Détecter l'authentification
    if (await this.hasAuthentication(projectPath)) {
      features.push({
        type: 'auth',
        name: 'Authentication',
        path: 'auth'
      });
    }
    
    // Détecter les pages CRUD
    const crudFeatures = await this.detectCrudPages(projectPath);
    features.push(...crudFeatures);
    
    // Détecter les APIs
    const apiFeatures = await this.detectApiRoutes(projectPath);
    features.push(...apiFeatures);
    
    return features;
  }

  private async hasAuthentication(projectPath: string): Promise<boolean> {
    const authPatterns = [
      'pages/login',
      'pages/auth',
      'app/login',
      'app/auth',
      'src/auth',
      'components/Auth',
      'lib/auth'
    ];
    
    for (const pattern of authPatterns) {
      const fullPath = path.join(projectPath, pattern);
      if (await fs.pathExists(fullPath)) {
        return true;
      }
    }
    
    return false;
  }

  private async detectCrudPages(projectPath: string): Promise<AppFeature[]> {
    const features: AppFeature[] = [];
    const pagesDir = path.join(projectPath, 'pages');
    const appDir = path.join(projectPath, 'app');
    
    const checkDir = async (dir: string) => {
      if (await fs.pathExists(dir)) {
        const items = await fs.readdir(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = await fs.stat(itemPath);
          if (stat.isDirectory() && !item.startsWith('.')) {
            features.push({
              type: 'crud',
              name: this.capitalize(item),
              path: item
            });
          }
        }
      }
    };
    
    await checkDir(pagesDir);
    await checkDir(appDir);
    
    return features;
  }

  private async detectApiRoutes(projectPath: string): Promise<AppFeature[]> {
    const features: AppFeature[] = [];
    const apiDir = path.join(projectPath, 'pages', 'api');
    const appApiDir = path.join(projectPath, 'app', 'api');
    
    const checkApiDir = async (dir: string) => {
      if (await fs.pathExists(dir)) {
        const items = await fs.readdir(dir);
        for (const item of items) {
          if (item.endsWith('.ts') || item.endsWith('.js')) {
            const name = path.basename(item, path.extname(item));
            features.push({
              type: 'api',
              name: this.capitalize(name),
              path: `api/${name}`
            });
          }
        }
      }
    };
    
    await checkApiDir(apiDir);
    await checkApiDir(appApiDir);
    
    return features;
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

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Helper function outside the class
function matchPatternHelper(filePath: string, pattern: string): boolean {
  // Simple pattern matching (améliorer avec une vraie lib glob si nécessaire)
  const fileName = path.basename(filePath);
  const simplePattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
  
  return fileName.toLowerCase().includes(simplePattern.toLowerCase());
}