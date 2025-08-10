#!/usr/bin/env node

const BridgeServer = require('./lib/core/bridge-server');

async function startBridge() {
  try {
    console.log('🌉 Démarrage Bridge Server...');
    const bridge = new BridgeServer();
    await bridge.start(3002);
    console.log('✅ Bridge Server démarré sur http://localhost:3002');
  } catch (error) {
    console.error('❌ Erreur démarrage:', error.message);
  }
}

startBridge();