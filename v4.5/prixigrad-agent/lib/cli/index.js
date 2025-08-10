#!/usr/bin/env node
/**
 * 🎭 PRIXIGRAD.IO CLI - Index
 * 
 * Point d'entrée pour les commandes CLI
 */

const chalk = require('chalk');

class PrixigradCLI {
  constructor() {
    this.commands = {
      init: require('./commands/init'),
      start: require('./commands/start'),
      transform: require('./commands/transform'),
      status: require('./commands/status'),
      config: require('./commands/config'),
      logs: require('./commands/logs')
    };
  }

  async executeCommand(commandName, options = {}, args = []) {
    try {
      if (!this.commands[commandName]) {
        throw new Error(`Commande inconnue: ${commandName}`);
      }

      await this.commands[commandName](options, ...args);
    } catch (error) {
      console.error(chalk.red(`❌ Erreur lors de l'exécution de ${commandName}:`));
      console.error(chalk.red(error.message));
      
      if (options.verbose) {
        console.error('\n📋 Stack trace:');
        console.error(chalk.gray(error.stack));
      }
      
      process.exit(1);
    }
  }
}

const cli = new PrixigradCLI();

// Si appelé directement depuis la ligne de commande
if (require.main === module) {
  const [,, commandName, ...args] = process.argv;
  
  if (commandName) {
    cli.executeCommand(commandName, {}, args);
  } else {
    console.log('Usage: node lib/cli/index.js <command>');
    console.log('Commandes disponibles:', Object.keys(cli.commands).join(', '));
  }
}

module.exports = cli;