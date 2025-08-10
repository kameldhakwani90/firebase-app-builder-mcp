#!/usr/bin/env node

/**
 * Test de l'API projet pour voir si les données sont là
 */

async function testProjectAPI() {
  console.log('🧪 Test de récupération projet via API');
  
  // Simuler l'appel API depuis le frontend
  try {
    const response = await fetch('http://localhost:3002/api/projects/cme1ygal20001113xgfqiaxap');
    const data = await response.json();
    
    console.log('📊 DONNÉES DU PROJET:');
    console.log('========================');
    console.log(`ID: ${data.id}`);
    console.log(`Nom: ${data.name}`);
    console.log(`Framework: ${data.framework}`);
    console.log(`Type: ${data.type}`);
    console.log(`Pages: ${data.pages ? data.pages.length : 'undefined'}`);
    console.log(`Rôles: ${data.userRoles ? data.userRoles.length : 'undefined'}`);
    
    if (data.pages) {
      console.log('\n📄 PAGES:');
      data.pages.slice(0, 3).forEach((page, i) => {
        console.log(`  ${i+1}. ${page.name} (${page.route})`);
        console.log(`     Objectif: ${page.pageObjective}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur API:', error.message);
  }
}

testProjectAPI();