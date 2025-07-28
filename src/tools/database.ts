import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { DataModel } from '../types.js';

export class DatabaseMigrator {
  
  async setupPrismaDatabase(
    projectPath: string, 
    dataModels: DataModel[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(chalk.blue('🗄️  Configuration de la base de données Prisma...'));
      
      // 1. Installer Prisma
      await this.installPrisma(projectPath);
      
      // 2. Initialiser Prisma
      await this.initializePrisma(projectPath);
      
      // 3. Générer le schéma depuis les modèles
      await this.generatePrismaSchema(projectPath, dataModels);
      
      // 4. Créer la migration initiale
      await this.createInitialMigration(projectPath);
      
      // 5. Générer le client Prisma
      await this.generatePrismaClient(projectPath);
      
      // 6. Configurer les variables d'environnement
      await this.setupEnvironmentVariables(projectPath);
      
      console.log(chalk.green('✅ Base de données Prisma configurée'));
      return { success: true };
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur configuration DB: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  private async installPrisma(projectPath: string): Promise<void> {
    console.log(chalk.blue('📦 Installation de Prisma...'));
    
    return new Promise((resolve, reject) => {
      const install = spawn('npm', ['install', 'prisma', '@prisma/client'], {
        cwd: projectPath,
        stdio: 'pipe'
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ Prisma installé'));
          resolve();
        } else {
          reject(new Error(`Installation Prisma échouée avec le code ${code}`));
        }
      });
    });
  }

  private async initializePrisma(projectPath: string): Promise<void> {
    const prismaDir = path.join(projectPath, 'prisma');
    
    if (!await fs.pathExists(prismaDir)) {
      console.log(chalk.blue('🔧 Initialisation de Prisma...'));
      
      return new Promise((resolve, reject) => {
        const init = spawn('npx', ['prisma', 'init'], {
          cwd: projectPath,
          stdio: 'pipe'
        });
        
        init.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green('✅ Prisma initialisé'));
            resolve();
          } else {
            reject(new Error(`Initialisation Prisma échouée avec le code ${code}`));
          }
        });
      });
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
    console.log(chalk.blue('🔄 Création de la migration initiale...'));
    
    return new Promise((resolve, reject) => {
      const migrate = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'init'], {
        cwd: projectPath,
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: 'postgresql://user:password@localhost:5432/mydb?schema=public' }
      });
      
      migrate.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ Migration initiale créée'));
          resolve();
        } else {
          console.log(chalk.yellow('⚠️  Migration ignorée (base de données non accessible)'));
          resolve(); // Ne pas faire échouer si pas de DB
        }
      });
    });
  }

  private async generatePrismaClient(projectPath: string): Promise<void> {
    console.log(chalk.blue('🔧 Génération du client Prisma...'));
    
    return new Promise((resolve, reject) => {
      const generate = spawn('npx', ['prisma', 'generate'], {
        cwd: projectPath,
        stdio: 'pipe'
      });
      
      generate.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ Client Prisma généré'));
          resolve();
        } else {
          reject(new Error(`Génération client Prisma échouée avec le code ${code}`));
        }
      });
    });
  }

  private async setupEnvironmentVariables(projectPath: string): Promise<void> {
    console.log(chalk.blue('🔧 Configuration des variables d\'environnement...'));
    
    const envContent = `# Environment variables declared in this file are available at build-time and run-time.
# Next.js will automatically read this file and make the variables available.

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# Prisma
PRISMA_CLI_QUERY_ENGINE_TYPE="binary"

# Development
NODE_ENV="development"

# Add your other environment variables here
`;
    
    const envPath = path.join(projectPath, '.env.local');
    
    if (!await fs.pathExists(envPath)) {
      await fs.writeFile(envPath, envContent);
      console.log(chalk.green('✅ Fichier .env.local créé'));
    } else {
      console.log(chalk.yellow('⚠️  Fichier .env.local existe déjà'));
    }

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