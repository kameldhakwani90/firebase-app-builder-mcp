/**
 * 🎭 PRIXIGRAD.IO - Script d'initialisation SaaS
 * 
 * Crée le Super Admin et les utilisateurs de test
 */

const UserService = require('../lib/core/user-service');

async function initializeSaaS() {
  const userService = new UserService();
  
  try {
    console.log('🎭 Initialisation du système SaaS PRIXIGRAD.IO...\n');

    // 1. Créer le Super Admin
    console.log('👑 Création Super Admin...');
    const admin = await userService.createSuperAdmin('kamel@prixigrad.io', 'Kamel Dhakwani');
    console.log(`✅ Super Admin: ${admin.email}`);

    // 2. Créer des clients de test
    console.log('\n👤 Création clients de test...');
    
    const kamel = await userService.createClient(
      'kamel.dhakwani@gmail.com', 
      'Kamel Dhakwani', 
      10
    );
    console.log(`✅ Client: ${kamel.email} (${kamel.credits} crédits)`);

    const wife = await userService.createClient(
      'femme.kamel@gmail.com', 
      'Épouse de Kamel', 
      5
    );
    console.log(`✅ Client: ${wife.email} (${wife.credits} crédits)`);

    const testUser = await userService.createClient(
      'test@example.com', 
      'Utilisateur Test', 
      3
    );
    console.log(`✅ Client: ${testUser.email} (${testUser.credits} crédits)`);

    // 3. Afficher les stats
    console.log('\n📊 Statistiques système:');
    const stats = await userService.getUserStats();
    console.log(`- Utilisateurs: ${stats.totalUsers}`);
    console.log(`- Actifs: ${stats.activeUsers}`);
    console.log(`- Projets: ${stats.totalProjects}`);

    console.log('\n🎉 Système SaaS initialisé avec succès !');
    console.log('\n🔑 Comptes créés:');
    console.log('   Super Admin: kamel@prixigrad.io');
    console.log('   Client 1:    kamel.dhakwani@gmail.com (10 crédits)');
    console.log('   Client 2:    femme.kamel@gmail.com (5 crédits)');
    console.log('   Client 3:    test@example.com (3 crédits)');

  } catch (error) {
    console.error('❌ Erreur initialisation:', error.message);
  } finally {
    await userService.disconnect();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  initializeSaaS();
}

module.exports = { initializeSaaS };