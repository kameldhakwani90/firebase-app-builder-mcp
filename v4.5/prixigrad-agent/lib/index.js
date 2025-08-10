/**
 * 🎭 PRIXIGRAD.IO AGENT - Entry Point
 * 
 * Point d'entrée principal du package NPM
 */

const SystemChecker = require('./core/system-checker');
const MCPInstaller = require('./core/mcp-installer');
const BridgeServer = require('./core/bridge-server');
const MCPOrchestrator = require('./core/orchestrator');

module.exports = {
  // Core Components
  SystemChecker,
  MCPInstaller,
  BridgeServer,
  MCPOrchestrator,
  
  // Version
  version: require('../package.json').version,
  
  // Utils
  utils: {
    logger: require('./core/logger'),
    config: require('./core/config')
  }
};