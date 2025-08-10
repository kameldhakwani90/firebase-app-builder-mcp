#!/usr/bin/env node

/**
 * Debug BridgeServer avec logs détaillés
 */

const BridgeServer = require('./lib/core/bridge-server');
const Logger = require('./lib/core/logger');

async function debugBridge() {
  const logger = new Logger('DebugBridge');
  
  try {
    logger.info('🌉 Démarrage BridgeServer avec debug...');
    
    const bridge = new BridgeServer();
    
    // Intercepter les méthodes importantes pour debug
    const originalHandleAnalysis = bridge.handleAnalysis;
    bridge.handleAnalysis = async function(req, res) {
      logger.info('📊 Analyse demandée:', req.body);
      try {
        return await originalHandleAnalysis.call(this, req, res);
      } catch (error) {
        logger.error('❌ Erreur dans handleAnalysis:', error.message);
        res.status(500).json({ error: error.message });
      }
    };
    
    const info = await bridge.start(3002);
    
    logger.success(`✅ BridgeServer debug: ${info.url}`);
    logger.info('🎯 Endpoints disponibles:');
    logger.info('  GET /api/projects');
    logger.info('  POST /api/analyze');
    logger.info('  POST /api/transform');
    logger.info('  GET /api/events');
    
    // Test rapide du MCPOrchestrator
    if (bridge.mcpOrchestrator) {
      logger.info('🤖 MCPOrchestrator disponible');
      logger.info('🤖 Agents configurés:', Object.keys(bridge.mcpOrchestrator.agents));
    } else {
      logger.warn('⚠️ MCPOrchestrator non disponible');
    }
    
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

debugBridge();