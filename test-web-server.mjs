import { WebServer } from './dist/web-server.js';

const server = new WebServer({ 
  port: 3000, 
  host: 'localhost' 
});

try {
  const url = await server.start();
  console.log('🌐 Serveur web de test lancé:', url);
  console.log('🚀 Ouvrez votre navigateur sur:', url);
  
  // Garder le serveur en vie
  process.on('SIGINT', async () => {
    console.log('\n🔴 Arrêt du serveur...');
    await server.stop();
    process.exit(0);
  });
  
} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}