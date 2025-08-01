#!/usr/bin/env node

import { FirebaseAppBuilderAgent } from './agent.js';
import { WebServer } from './web-server.js';
import chalk from 'chalk';
import { spawn } from 'child_process';

const BANNER = `
🚀 FirebaseAppBuilder Agent v2.0.7
Agent MCP avec mémoire persistante et tests utilisateur réalistes

Migration automatique: Next.js Mocks → PostgreSQL + Prisma
`;

async function main() {
  console.log(chalk.blue.bold(BANNER));
  
  try {
    // 🚀 ÉTAPE 1: Lancer l'interface web IMMÉDIATEMENT
    console.log(chalk.cyan('🌐 Démarrage de l\'interface web...'));
    
    const webServer = new WebServer({
      port: 3000,
      host: 'localhost'
    });
    
    const webUrl = await webServer.start();
    
    // Ouvrir automatiquement dans le navigateur
    console.log(chalk.green('🚀 Ouverture automatique du navigateur...'));
    openBrowser(webUrl);
    
    console.log(chalk.yellow('\n📋 INSTRUCTIONS:'));
    console.log(chalk.white('1. Configurez votre projet sur l\'interface web'));
    console.log(chalk.white('2. L\'agent démarrera automatiquement après configuration'));
    console.log(chalk.white('3. Surveillez la progression en temps réel'));
    
    // 🚀 ÉTAPE 2: Attendre la configuration puis démarrer l'agent
    const agent = new FirebaseAppBuilderAgent();
    await agent.initialize();
    
    // Récupérer les arguments de la ligne de commande
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }
    
    if (args.includes('--version') || args.includes('-v')) {
      console.log('v2.0.7');
      return;
    }
    
    // Mode web - attendre la configuration via interface
    if (args.length === 0 || !args.includes('--no-web')) {
      console.log(chalk.blue('⏳ En attente de configuration via interface web...'));
      await waitForWebConfiguration(webServer, agent, args);
    } else {
      // Mode classique (ligne de commande)
      await agent.run(args);
    }
    
  } catch (error: any) {
    console.error(chalk.red(`❌ Erreur fatale: ${error.message}`));
    process.exit(1);
  }
}

async function waitForWebConfiguration(webServer: WebServer, agent: FirebaseAppBuilderAgent, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const checkInterval = setInterval(async () => {
      const config = webServer.getProjectConfig();
      
      if (config && config.githubUrl) {
        clearInterval(checkInterval);
        
        console.log(chalk.green('✅ Configuration reçue via interface web !'));
        console.log(chalk.cyan('🚀 Démarrage de la migration...'));
        
        try {
          // Démarrer l'agent avec l'URL GitHub configurée
          await agent.run([config.githubUrl]);
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    }, 2000); // Vérifier toutes les 2 secondes
  });
}

function openBrowser(url: string) {
  const platform = process.platform;
  let command: string;
  
  switch (platform) {
    case 'win32':
      command = 'start';
      break;
    case 'darwin':
      command = 'open';
      break;
    default:
      command = 'xdg-open';
  }
  
  try {
    spawn(command, [url], { detached: true, stdio: 'ignore' });
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Impossible d'ouvrir automatiquement le navigateur`));
    console.log(chalk.white(`🌐 Ouvrez manuellement: ${url}`));
  }
}

function showHelp() {
  console.log(chalk.white(`
📖 Usage:

  firebase-app-builder <url-github>          # Nouveau projet
  firebase-app-builder continue <nom>        # Continuer un projet
  firebase-app-builder                       # Lister les projets

🎯 Exemples:

  # Démarrer une nouvelle migration
  firebase-app-builder https://github.com/user/my-nextjs-app

  # Voir les projets en cours
  firebase-app-builder

  # Continuer un projet existant
  firebase-app-builder continue my-nextjs-app

🔧 Options:

  -h, --help       Afficher cette aide
  -v, --version    Afficher la version

🧠 Fonctionnalités:

  ✅ Mémoire persistante des projets
  ✅ Clone et analyse automatique des mocks
  ✅ Migration vers PostgreSQL + Prisma
  ✅ Génération d'APIs CRUD complètes
  ✅ Tests utilisateur réalistes avec Playwright
  ✅ Gestion Git avec branches automatiques
  ✅ Rapports détaillés de migration

🎭 Tests Utilisateur Réalistes:

  L'agent teste votre app comme un vrai utilisateur :
  - Navigation complète de l'interface
  - Formulaires et interactions
  - Gestion des erreurs
  - Parcours CRUD complets
  - Authentification si présente

💾 Mémoire de Travail:

  L'agent se souvient de tout :
  - Projets en cours et terminés
  - Progression de chaque étape
  - Possibilité de reprendre où on s'est arrêté
  - Historique complet des actions

📂 Espace de Travail:

  Tous vos projets sont organisés dans :
  ~/firebase-migrations/
  ├── project1/
  ├── project2/
  └── projects.json (base de données des projets)

🚀 Résultat Final:

  Application Next.js avec :
  - Base de données PostgreSQL + Prisma
  - APIs CRUD complètes
  - Tests E2E Playwright
  - Documentation de migration
  - Configuration prête pour production
`));
}

// Point d'entrée - Exécuter immédiatement
main().catch(console.error);

export { FirebaseAppBuilderAgent };