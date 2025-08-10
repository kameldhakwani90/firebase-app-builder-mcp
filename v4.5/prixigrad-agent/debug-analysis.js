/**
 * Debug direct de l'analyse MCP
 */

const BridgeServer = require('./lib/core/bridge-server');

async function debugAnalysis() {
  console.log('🔍 Debug direct de l\'analyse MCP');
  
  const server = new BridgeServer();
  
  const mockProject = {
    name: 'capnionext',
    githubUrl: 'https://github.com/kameldhakwani90/capnionext',
    description: 'CapnioNext IoT monitoring pour restaurants avec capteurs et Raspberry Pi'
  };
  
  try {
    console.log('🎯 Test performRealMCPAnalysis...');
    const result = await server.performRealMCPAnalysis(mockProject);
    
    console.log('✅ Résultat analyse:', {
      success: !!result,
      pages: result?.pages?.length || 0,
      userRoles: result?.userRoles?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Erreur performRealMCPAnalysis:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n🔄 Test du fallback...');
    try {
      const fallbackResult = server.generateEnhancedAnalysis(mockProject.githubUrl, mockProject.description);
      console.log('✅ Fallback result:', {
        success: !!fallbackResult,
        pages: fallbackResult?.pages?.length || 0,
        userRoles: fallbackResult?.userRoles?.length || 0
      });
    } catch (fallbackError) {
      console.error('❌ Erreur fallback:', fallbackError.message);
    }
  }
  
  process.exit(0);
}

debugAnalysis();