#!/usr/bin/env node

/**
 * Version minimale BridgeServer pour debug
 */

const express = require('express');
const cors = require('cors');
const Logger = require('./lib/core/logger');
const MCPOrchestrator = require('./lib/core/mcp-orchestrator');

const logger = new Logger('MinimalBridge');

try {
  logger.info('🚀 Démarrage serveur minimal...');
  
  const app = express();
  
  // CORS simple
  app.use(cors());
  app.use(express.json());
  
  // MCPOrchestrator
  const orchestrator = new MCPOrchestrator();
  logger.success('✅ MCPOrchestrator initialisé');
  
  // Routes basiques
  app.get('/api/projects', (req, res) => {
    logger.info('📊 GET /api/projects');
    res.json([]);
  });
  
  app.post('/api/analyze', async (req, res) => {
    logger.info('📊 POST /api/analyze:', req.body);
    
    try {
      const { github_url } = req.body;
      
      if (!github_url) {
        return res.status(400).json({ error: 'github_url requis' });
      }
      
      // Simulation analyse simple
      const result = {
        project_id: `project_${Date.now()}`,
        github_url,
        business_type: 'e-commerce',
        status: 'analyzed',
        analysis: {
          type: 'e-commerce',
          pages: ['products', 'cart', 'checkout'],
          framework: 'Next.js'
        }
      };
      
      logger.success('✅ Analyse simulée:', result.project_id);
      res.json(result);
      
    } catch (error) {
      logger.error('❌ Erreur analyse:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get('/api/events', (req, res) => {
    logger.info('📡 GET /api/events (SSE)');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    res.write('data: {"type":"connected","message":"SSE connecté"}\n\n');
    
    // Ping périodique
    const pingInterval = setInterval(() => {
      res.write('data: {"type":"ping","timestamp":' + Date.now() + '}\n\n');
    }, 30000);
    
    req.on('close', () => {
      clearInterval(pingInterval);
      logger.info('📡 SSE déconnecté');
    });
  });
  
  // Démarrage
  const server = app.listen(3002, () => {
    logger.success('✅ Serveur minimal: http://localhost:3002');
    logger.info('🎯 Testez: curl http://localhost:3002/api/projects');
  });
  
  // Arrêt propre
  process.on('SIGINT', () => {
    logger.info('🛑 Arrêt serveur...');
    server.close(() => {
      logger.success('✅ Serveur arrêté');
      process.exit(0);
    });
  });
  
} catch (error) {
  logger.error('❌ Erreur démarrage:', error.message);
  logger.error('Stack:', error.stack);
  process.exit(1);
}