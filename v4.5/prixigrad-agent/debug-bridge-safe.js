#!/usr/bin/env node

/**
 * Debug BridgeServer sécurisé
 */

const BridgeServer = require('./lib/core/bridge-server');
const Logger = require('./lib/core/logger');

async function debugBridgeSafe() {
  const logger = new Logger('DebugBridgeSafe');
  
  try {
    logger.info('🌉 Démarrage BridgeServer safe...');
    
    const bridge = new BridgeServer();
    const info = await bridge.start(3002);
    
    logger.success(`✅ BridgeServer: ${info.url}`);
    
    logger.info('Press Ctrl+C to stop');
    
    // Keep alive
    process.on('SIGINT', async () => {
      logger.info('🛑 Arrêt...');
      await bridge.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('❌ Erreur:', error.message);
    logger.error('Stack:', error.stack);
    process.exit(1);
  }
}

debugBridgeSafe();