/**
 * Script de nettoyage des projets en base
 */

require('dotenv').config();
const Database = require('./lib/core/database');

async function cleanAllProjects() {
  console.log('🧹 Nettoyage des projets...');
  
  const db = new Database();
  
  try {
    // Compter les projets existants
    const projects = await db.prisma.project.findMany({
      select: { id: true, name: true, githubUrl: true }
    });
    
    console.log(`📊 ${projects.length} projets trouvés:`);
    projects.forEach(p => console.log(`  - ${p.name} (${p.githubUrl})`));
    
    if (projects.length > 0) {
      // Supprimer toutes les analyses liées
      await db.prisma.analysis.deleteMany({});
      console.log('✅ Analyses supprimées');
      
      // Supprimer toutes les pages
      await db.prisma.page.deleteMany({});
      console.log('✅ Pages supprimées');
      
      // Supprimer tous les rôles
      await db.prisma.userRole.deleteMany({});
      console.log('✅ Rôles utilisateurs supprimés');
      
      // Supprimer tous les projets
      await db.prisma.project.deleteMany({});
      console.log('✅ Projets supprimés');
      
      console.log(`🎉 ${projects.length} projets nettoyés avec succès !`);
    } else {
      console.log('ℹ️ Aucun projet à supprimer');
    }
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  } finally {
    await db.prisma.$disconnect();
    process.exit(0);
  }
}

cleanAllProjects();