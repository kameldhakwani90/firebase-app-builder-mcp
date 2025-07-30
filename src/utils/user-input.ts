import inquirer from 'inquirer';
import chalk from 'chalk';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export class UserInputManager {
  
  async promptDatabaseConfig(projectName: string): Promise<DatabaseConfig> {
    console.log(chalk.blue('\n🗄️ Configuration de la base de données PostgreSQL'));
    console.log(chalk.gray(`Pour le projet: ${projectName}\n`));
    
    const questions = [
      {
        type: 'input',
        name: 'host',
        message: 'Hôte PostgreSQL:',
        default: 'localhost',
        validate: (input: string) => input.trim() !== '' || 'L\'hôte est requis'
      },
      {
        type: 'input',
        name: 'port',
        message: 'Port PostgreSQL:',
        default: '5432',
        validate: (input: string) => {
          const port = parseInt(input);
          return (port > 0 && port < 65536) || 'Port invalide (1-65535)';
        },
        filter: (input: string) => parseInt(input)
      },
      {
        type: 'input',
        name: 'username',
        message: 'Nom d\'utilisateur PostgreSQL:',
        default: 'postgres',
        validate: (input: string) => input.trim() !== '' || 'Le nom d\'utilisateur est requis'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Mot de passe PostgreSQL:',
        mask: '*',
        validate: (input: string) => input.trim() !== '' || 'Le mot de passe est requis'
      },
      {
        type: 'input',
        name: 'database',
        message: 'Nom de la base de données:',
        default: `${projectName.toLowerCase()}_db`,
        validate: (input: string) => {
          const dbName = input.trim();
          if (dbName === '') return 'Le nom de la base est requis';
          if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(dbName)) {
            return 'Nom invalide (lettres, chiffres, _ seulement, commence par une lettre)';
          }
          return true;
        }
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    // Tester la connexion
    console.log(chalk.blue('\n🔍 Test de la connexion...'));
    const isValid = await this.testDatabaseConnection(answers);
    
    if (!isValid) {
      console.log(chalk.yellow('⚠️  Connexion échouée, mais on continue (la base sera créée si nécessaire)'));
    } else {
      console.log(chalk.green('✅ Connexion réussie !'));
    }
    
    return answers;
  }

  async confirmDatabaseCreation(databaseName: string): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Créer la base de données "${databaseName}" si elle n'existe pas ?`,
        default: true
      }
    ]);
    
    return confirm;
  }

  private async testDatabaseConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      // Utiliser require pour éviter les erreurs TypeScript avec les imports dynamiques
      const pg = await eval('import("pg")').catch(() => null);
      
      if (!pg) {
        // pg n'est pas installé, on ne peut pas tester
        return false;
      }
      
      const client = new pg.Client({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: 'postgres', // Se connecter à la DB par défaut pour tester
        connectTimeoutMillis: 5000,
      });

      await client.connect();
      await client.query('SELECT NOW()');
      await client.end();
      
      return true;
    } catch (error) {
      // Si connexion échoue ou autre erreur
      return false;
    }
  }

  buildDatabaseUrl(config: DatabaseConfig): string {
    return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}?schema=public`;
  }

  async promptMigrationChoice(): Promise<'now' | 'later' | 'skip'> {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'Quand exécuter les migrations Prisma ?',
        choices: [
          { name: 'Maintenant (base de données accessible)', value: 'now' },
          { name: 'Plus tard (je configurerai la DB moi-même)', value: 'later' },
          { name: 'Ignorer (juste générer les fichiers)', value: 'skip' }
        ],
        default: 'now'
      }
    ]);
    
    return choice;
  }

  async promptOverwriteConfirmation(filePath: string): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Le fichier ${filePath} existe déjà. L'écraser ?`,
        default: false
      }
    ]);
    
    return confirm;
  }
}