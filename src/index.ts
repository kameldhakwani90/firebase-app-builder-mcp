#!/usr/bin/env node

import { FirebaseAppBuilderAgent } from './agent.js';
import chalk from 'chalk';

const BANNER = `
🚀 FirebaseAppBuilder Agent v2.0.5
Agent MCP avec mémoire persistante et tests utilisateur réalistes

Migration automatique: Next.js Mocks → PostgreSQL + Prisma
`;

async function main() {
  console.log(chalk.blue.bold(BANNER));
  
  try {
    const agent = new FirebaseAppBuilderAgent();
    await agent.initialize();
    
    // Récupérer les arguments de la ligne de commande
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }
    
    if (args.includes('--version') || args.includes('-v')) {
      console.log('v2.0.5');
      return;
    }
    
    // Exécuter l'agent
    await agent.run(args);
    
  } catch (error: any) {
    console.error(chalk.red(`❌ Erreur fatale: ${error.message}`));
    process.exit(1);
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