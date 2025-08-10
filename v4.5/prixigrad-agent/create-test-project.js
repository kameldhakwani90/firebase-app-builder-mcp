/**
 * Créer un projet de test qui persiste
 */

const DatabaseService = require('./lib/core/database');

async function createTestProject() {
  const database = new DatabaseService();
  
  try {
    console.log('📦 Création projet de test persistant...');
    const project = await database.createProject({
      name: 'Projet Test HTTP',
      githubUrl: 'https://github.com/test/http-deletion-test',
      status: 'analyzed',
      type: 'webapp',
      framework: 'react'
    }, 'cme0kq8880002ewcsvogih8k1'); // ID de Kamel
    
    console.log(`✅ Projet créé: ${project.name}`);
    console.log(`🆔 ID: ${project.id}`);
    console.log(`🌐 Test suppression: curl -X DELETE "http://localhost:3002/api/projects/${project.id}?userId=cme0kq8880002ewcsvogih8k1"`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await database.disconnect();
  }
}

if (require.main === module) {
  createTestProject();
}