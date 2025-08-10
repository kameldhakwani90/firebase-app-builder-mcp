/**
 * Debug spécifique API pour voir les logs
 */

const BridgeServer = require('./lib/core/bridge-server');

async function testAPIFlow() {
  console.log('🔍 Test spécifique du flux API');
  
  const server = new BridgeServer();
  
  // Simuler l'objet project comme l'API le crée
  const mockProjectFromDB = {
    id: 'test123',
    name: 'capnionext', 
    githubUrl: 'https://github.com/kameldhakwani90/capnionext',
    // Probablement pas de 'description' ici !
    status: 'analyzing',
    userId: 'user123'
  };
  
  console.log('📋 Objet project API:', mockProjectFromDB);
  
  try {
    console.log('🎯 Test runMCPAnalysisSaaS...');
    await server.runMCPAnalysisSaaS(mockProjectFromDB, 'user123');
  } catch (error) {
    console.error('❌ Erreur API flow:', error.message);
  }
}

testAPIFlow();