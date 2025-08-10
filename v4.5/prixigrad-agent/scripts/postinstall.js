#!/usr/bin/env node

/**
 * 🎭 PRIXIGRAD.IO - Script Post-Installation
 * 
 * Exécuté automatiquement après l'installation NPM
 */

let chalk;
try {
  chalk = require('chalk');
} catch (error) {
  // Fallback si chalk n'est pas disponible
  chalk = {
    blue: (text) => text,
    green: (text) => text,
    yellow: (text) => text,
    cyan: (text) => text,
    white: (text) => text,
    gray: (text) => text,
    red: (text) => text
  };
}

const packageJson = require('../package.json');

function showWelcomeMessage() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                🎭 PRIXIGRAD.IO AGENT                     ║
║              Installation réussie !                     ║
║                   v${packageJson.version}                            ║
╚══════════════════════════════════════════════════════════╝

🎉 Bienvenue dans PRIXIGRAD.IO Agent !

Prochaines étapes:
1. prixigrad init     # Initialise le système
2. prixigrad start    # Lance l'interface web
3. prixigrad transform <github-url> # Transforme une app

Ressources utiles:
📖 Documentation: https://docs.prixigrad.io
🐛 Support: https://github.com/prixigrad/agent/issues
💬 Discord: https://discord.gg/prixigrad

Astuce: prixigrad --help pour voir toutes les commandes
`);
}

function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    console.log(`
⚠️  ATTENTION: Node.js ${nodeVersion} détecté
   PRIXIGRAD.IO requiert Node.js >= 18.0.0
   
   Veuillez mettre à jour Node.js:
   https://nodejs.org/
`);
    return false;
  }
  
  return true;
}

async function main() {
  try {
    // Vérification de la version Node.js
    const nodeOk = checkNodeVersion();
    
    // Message de bienvenue
    showWelcomeMessage();
    
    if (!nodeOk) {
      process.exit(1);
    }
    
    // Note sur la configuration
    console.log(`
💡 Note: La première utilisation nécessite une initialisation
   avec 'prixigrad init' pour vérifier les prérequis.
`);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'installation:');
    console.error(error.message);
    process.exit(1);
  }
}

// Exécution uniquement si appelé directement
if (require.main === module) {
  main();
}