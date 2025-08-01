import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { DataModel } from '../types.js';
import { UserInputManager, DatabaseConfig } from '../utils/user-input.js';
import { VersionManager } from '../utils/version-manager.js';

const execAsync = promisify(exec);

export class DatabaseMigrator {
  private userInput = new UserInputManager();
  private versionManager = new VersionManager();
  private databaseConfig?: DatabaseConfig;
  
  private async validateEnvironment(): Promise<void> {
    console.log(chalk.blue('🔍 Validation de l\'environnement...'));
    
    const envCheck = await this.versionManager.validateEnvironment();
    
    if (!envCheck.compatible) {
      throw new Error(`Environnement incompatible: ${envCheck.issues.join(', ')}`);
    }
  }
  
  private async getDatabaseUrl(projectPath: string): Promise<string> {
    // Utiliser la config saisie par l'utilisateur si disponible
    if (this.databaseConfig) {
      return this.userInput.buildDatabaseUrl(this.databaseConfig);
    }
    
    // Vérifier dans .env.local d'abord
    const envLocalPath = path.join(projectPath, '.env.local');
    if (await fs.pathExists(envLocalPath)) {
      const content = await fs.readFile(envLocalPath, 'utf-8');
      const match = content.match(/DATABASE_URL\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    }
    
    // Puis dans .env
    const envPath = path.join(projectPath, '.env');
    if (await fs.pathExists(envPath)) {
      const content = await fs.readFile(envPath, 'utf-8');
      const match = content.match(/DATABASE_URL\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    }
    
    // Valeur par défaut si rien trouvé
    return 'postgresql://postgres:admin@localhost:5432/mydb?schema=public';
  }

  async setupPrismaDatabase(
    projectPath: string, 
    dataModels: DataModel[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(chalk.blue('🗄️  Configuration de la base de données Prisma...'));
      
      // 0. Valider l'environnement (Node.js, npm)
      await this.validateEnvironment();
      
      // 1. Demander la configuration de la base de données
      const projectName = path.basename(projectPath);
      this.databaseConfig = await this.userInput.promptDatabaseConfig(projectName);
      
      // 2. Installer Prisma avec gestion des versions
      await this.installPrismaWithVersionCheck(projectPath);
      
      // 3. Initialiser Prisma
      await this.initializePrisma(projectPath);
      
      // 3. Configurer les variables d'environnement (avant le schéma)
      await this.setupEnvironmentVariables(projectPath);
      
      // 4. Générer le schéma depuis les modèles
      await this.generatePrismaSchema(projectPath, dataModels);
      
      // 5. Demander quand faire la migration
      const migrationChoice = await this.userInput.promptMigrationChoice();
      
      if (migrationChoice === 'now') {
        // 6. Créer la migration initiale
        await this.createInitialMigration(projectPath);
        
        // 7. Générer le client Prisma
        await this.generatePrismaClient(projectPath);
      } else if (migrationChoice === 'later') {
        console.log(chalk.yellow('⏳ Migration reportée - pensez à exécuter "prisma migrate dev" plus tard'));
        // Générer le client quand même
        try {
          await this.generatePrismaClient(projectPath);
        } catch (error) {
          console.log(chalk.yellow('⚠️  Client Prisma non généré - exécutez "prisma generate" après la migration'));
        }
      } else {
        console.log(chalk.yellow('⏭️  Migration ignorée - fichiers générés uniquement'));
      }
      
      console.log(chalk.green('✅ Base de données Prisma configurée'));
      return { success: true };
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur configuration DB: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  private async installPrismaWithVersionCheck(projectPath: string): Promise<void> {
    try {
      // Vérifier si Prisma est déjà installé
      const currentVersion = await this.versionManager.checkPrismaVersion(projectPath);
      
      if (currentVersion) {
        console.log(chalk.green(`✅ Prisma v${currentVersion.version} déjà installé`));
        return;
      }
      
      // Installer la version recommandée
      await this.versionManager.installSpecificPrismaVersion(projectPath);
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur installation Prisma: ${error.message}`));
      throw new Error(`Installation Prisma échouée: ${error.message}`);
    }
  }

  private async initializePrisma(projectPath: string): Promise<void> {
    const prismaDir = path.join(projectPath, 'prisma');
    
    if (!await fs.pathExists(prismaDir)) {
      console.log(chalk.blue('🔧 Initialisation de Prisma (Windows fix)...'));
      
      try {
        // Windows fix: Create Prisma files manually to avoid npx issues
        await fs.ensureDir(prismaDir);
        
        // Create basic schema.prisma instead of using npx prisma init
        const basicSchema = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;
        
        const schemaPath = path.join(prismaDir, 'schema.prisma');
        await fs.writeFile(schemaPath, basicSchema);
        
        // Create .env if it doesn't exist
        const envPath = path.join(projectPath, '.env');
        if (!await fs.pathExists(envPath)) {
          await fs.writeFile(envPath, 'DATABASE_URL="postgresql://postgres:password@localhost:5432/mydb?schema=public"\n');
        }
        
        console.log(chalk.green('✅ Prisma initialisé (Windows fix appliqué)'));
      } catch (error: any) {
        throw new Error(`Initialisation Prisma échouée (Windows fix): ${error.message}`);
      }
    }
  }

  private async generatePrismaSchema(projectPath: string, dataModels: DataModel[]): Promise<void> {
    console.log(chalk.blue('📝 Génération du schéma Prisma...'));
    
    const schema = this.buildPrismaSchema(dataModels);
    const schemaPath = path.join(projectPath, 'prisma', 'schema.prisma');
    
    await fs.writeFile(schemaPath, schema);
    console.log(chalk.green(`✅ Schéma Prisma généré: ${schemaPath}`));
  }

  private buildPrismaSchema(dataModels: DataModel[]): string {
    const header = `
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;

    const models = dataModels.map(model => this.generatePrismaModel(model)).join('\n\n');
    
    return header + models;
  }

  private generatePrismaModel(model: DataModel): string {
    const fields = Object.entries(model.fields)
      .map(([name, type]) => {
        const prismaType = this.convertToPrismaType(type);
        const isId = name.toLowerCase() === 'id';
        const attributes = isId ? ' @id @default(cuid())' : '';
        
        return `  ${name} ${prismaType}${attributes}`;
      })
      .join('\n');

    // Ajouter un ID si le modèle n'en a pas
    const hasId = Object.keys(model.fields).some(name => name.toLowerCase() === 'id');
    const idField = hasId ? '' : '  id        String   @id @default(cuid())\n';
    
    // Ajouter les timestamps
    const timestamps = `  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt`;

    return `model ${model.name} {
${idField}${fields}
${timestamps}
}`;
  }

  private convertToPrismaType(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'String',
      'number': 'Int',
      'boolean': 'Boolean',
      'date': 'DateTime',
      'email': 'String',
      'url': 'String',
      'array': 'String[]',
      'object': 'Json'
    };
    
    return typeMap[type] || 'String';
  }

  private async createInitialMigration(projectPath: string): Promise<void> {
    console.log(chalk.blue('🔄 Création de la migration initiale (Windows fix)...'));
    
    try {
      // Windows fix: Skip automatic migration to avoid npx issues
      console.log(chalk.yellow('⚠️ Migration automatique désactivée sur Windows'));
      console.log(chalk.blue('💡 Utilisez "npx prisma db push" manuellement après la génération'));
    } catch (error: any) {
      console.log(chalk.yellow(`⚠️ Migration ignorée: ${error.message}`));
    }
  }

  private async generatePrismaClient(projectPath: string): Promise<void> {
    console.log(chalk.blue('🔧 Génération du client Prisma (Windows fix)...'));
    
    try {
      // Windows fix: Skip automatic client generation to avoid npx issues
      console.log(chalk.yellow('⚠️ Génération client automatique désactivée sur Windows'));
      console.log(chalk.blue('💡 Utilisez "npm install && npx prisma generate" manuellement après'));
    } catch (error: any) {
      console.log(chalk.yellow(`⚠️ Génération client ignorée: ${error.message}`));
    }
  }

  private async setupEnvironmentVariables(projectPath: string): Promise<void> {
    console.log(chalk.blue('🔧 Configuration des variables d\'environnement...'));
    
    if (!this.databaseConfig) {
      throw new Error('Configuration de base de données manquante');
    }
    
    const databaseUrl = this.userInput.buildDatabaseUrl(this.databaseConfig);
    
    const envContent = `# Environment variables declared in this file are available at build-time and run-time.
# Next.js will automatically read this file and make the variables available.

# Database Configuration
DATABASE_URL="${databaseUrl}"
DB_HOST="${this.databaseConfig.host}"
DB_PORT="${this.databaseConfig.port}"
DB_USER="${this.databaseConfig.username}"
DB_NAME="${this.databaseConfig.database}"

# Prisma
PRISMA_CLI_QUERY_ENGINE_TYPE="binary"

# Development
NODE_ENV="development"

# Add your other environment variables here
`;
    
    const envPath = path.join(projectPath, '.env.local');
    
    if (await fs.pathExists(envPath)) {
      const shouldOverwrite = await this.userInput.promptOverwriteConfirmation('.env.local');
      if (!shouldOverwrite) {
        console.log(chalk.yellow('⚠️  Fichier .env.local conservé tel quel'));
        return;
      }
    }
    
    await fs.writeFile(envPath, envContent);
    console.log(chalk.green('✅ Fichier .env.local créé avec votre configuration'));

    // Ajouter .env.local au .gitignore
    await this.updateGitignore(projectPath);
  }

  private async updateGitignore(projectPath: string): Promise<void> {
    const gitignorePath = path.join(projectPath, '.gitignore');
    
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      
      if (!content.includes('.env.local')) {
        const newContent = content + '\n# Environment variables\n.env.local\n.env\n';
        await fs.writeFile(gitignorePath, newContent);
        console.log(chalk.green('✅ .gitignore mis à jour'));
      }
    }
  }

  async generateApiRoutes(projectPath: string, dataModels: DataModel[]): Promise<void> {
    console.log(chalk.blue('🔗 Génération des routes API...'));
    
    for (const model of dataModels) {
      await this.generateApiRoute(projectPath, model);
    }
    
    console.log(chalk.green(`✅ ${dataModels.length} routes API générées`));
  }

  private async generateApiRoute(projectPath: string, model: DataModel): Promise<void> {
    const apiContent = this.generateApiRouteContent(model);
    
    // Déterminer le répertoire API (Next.js)
    const apiDir = await this.findApiDirectory(projectPath);
    const routePath = path.join(apiDir, model.name.toLowerCase());
    
    await fs.ensureDir(routePath);
    await fs.writeFile(path.join(routePath, 'index.ts'), apiContent);
    
    console.log(chalk.gray(`   📁 Route créée: /api/${model.name.toLowerCase()}`));
  }

  private async findApiDirectory(projectPath: string): Promise<string> {
    // Next.js App Router
    const appApiDir = path.join(projectPath, 'app', 'api');
    if (await fs.pathExists(path.join(projectPath, 'app'))) {
      await fs.ensureDir(appApiDir);
      return appApiDir;
    }
    
    // Next.js Pages Router
    const pagesApiDir = path.join(projectPath, 'pages', 'api');
    await fs.ensureDir(pagesApiDir);
    return pagesApiDir;
  }

  private generateApiRouteContent(model: DataModel): string {
    const modelName = model.name;
    const modelNameLower = model.name.toLowerCase();
    
    return `
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/${modelNameLower} - Récupérer tous les ${modelNameLower}s
export async function GET(request: NextRequest) {
  try {
    const ${modelNameLower}s = await prisma.${modelNameLower}.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(${modelNameLower}s);
  } catch (error) {
    console.error('Erreur GET /${modelNameLower}:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des ${modelNameLower}s' },
      { status: 500 }
    );
  }
}

// POST /api/${modelNameLower} - Créer un nouveau ${modelNameLower}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation basique
    ${Object.entries(model.fields)
      .filter(([name, type]) => name !== 'id' && type === 'string')
      .map(([name]) => `
    if (!body.${name}) {
      return NextResponse.json(
        { error: '${name} est requis' },
        { status: 400 }
      );
    }`)
      .join('')}
    
    const new${modelName} = await prisma.${modelNameLower}.create({
      data: body
    });
    
    return NextResponse.json(new${modelName}, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /${modelNameLower}:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du ${modelNameLower}' },
      { status: 500 }
    );
  }
}

// PUT /api/${modelNameLower}/[id] - Mettre à jour un ${modelNameLower}
export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID requis' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    const updated${modelName} = await prisma.${modelNameLower}.update({
      where: { id },
      data: body
    });
    
    return NextResponse.json(updated${modelName});
  } catch (error) {
    console.error('Erreur PUT /${modelNameLower}:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du ${modelNameLower}' },
      { status: 500 }
    );
  }
}

// DELETE /api/${modelNameLower}/[id] - Supprimer un ${modelNameLower}
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID requis' },
        { status: 400 }
      );
    }
    
    await prisma.${modelNameLower}.delete({
      where: { id }
    });
    
    return NextResponse.json({ message: '${modelName} supprimé avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /${modelNameLower}:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du ${modelNameLower}' },
      { status: 500 }
    );
  }
}
`;
  }
}