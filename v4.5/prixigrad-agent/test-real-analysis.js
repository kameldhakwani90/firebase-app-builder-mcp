#!/usr/bin/env node

/**
 * Test de l'analyse MCP réelle pour corriger le problème
 */

const BridgeServer = require('./lib/core/bridge-server');

async function testRealAnalysis() {
  console.log('🧪 Test analyse MCP réelle...');
  
  try {
    const bridgeServer = new BridgeServer();
    
    const project = {
      id: 'test-123',
      name: 'capnionext', 
      githubUrl: 'https://github.com/kameldhakwani90/capnionext',
      description: 'Système IoT de gestion de capteurs avec interface admin/client'
    };
    
    console.log('🎯 Test performRealMCPAnalysis...');
    const result = await bridgeServer.performRealMCPAnalysis(project);
    
    console.log('📊 RÉSULTAT:');
    console.log(`- Type: ${result.type}`);
    console.log(`- Framework: ${result.framework}`);
    console.log(`- Pages: ${result.pages?.length || 0}`);
    console.log(`- UserRoles: ${result.userRoles?.length || 0}`);
    console.log(`- Business Type: ${result.businessType}`);
    
    if (result.pages && result.pages.length > 0) {
      console.log('\n🔍 Première page analysée:');
      const firstPage = result.pages[0];
      console.log(`  - Nom: ${firstPage.name}`);
      console.log(`  - Route: ${firstPage.route}`);
      console.log(`  - Functionality: ${firstPage.mainFunctionality}`);
      console.log(`  - Business Context: ${firstPage.businessContext}`);
    }
    
    console.log('\n✅ Test réussi !');
    
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
    console.error(error.stack);
  }
}

testRealAnalysis();