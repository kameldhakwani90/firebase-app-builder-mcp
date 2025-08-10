// Serveur de test avec la solution git clone qui fonctionne
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

const app = express();
app.use(cors());
app.use(express.json());

// Logger simple
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`)
};

// Fonction de clonage qui fonctionne (avec exec)
async function cloneRepository(githubUrl) {
  const tempDir = path.join(os.tmpdir(), `prixigrad_fixed_${Date.now()}`);
  
  logger.info(`📂 Clonage de ${githubUrl} vers ${tempDir}`);
  
  return new Promise((resolve, reject) => {
    const command = `git clone --depth 1 "${githubUrl}" "${tempDir}"`;
    logger.info(`🔍 Commande git: ${command}`);
    
    exec(command, {
      env: process.env,
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`❌ Git clone error: ${error.message}`);
        reject(new Error(`Erreur clonage git: ${error.message} - ${stderr}`));
        return;
      }
      
      logger.success(`✅ Repository cloné: ${tempDir}`);
      resolve(tempDir);
    });
  });
}

// Scan des pages Next.js
async function scanPagesDirectory(dirPath, route = '') {
  try {
    logger.info(`🔍 Scan de: ${dirPath}`);
    const items = await fs.readdir(dirPath);
    const pages = [];
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        const subPages = await scanPagesDirectory(fullPath, route + '/' + item);
        pages.push(...subPages);
      } else if (item.endsWith('.tsx') || item.endsWith('.jsx') || item.endsWith('.js')) {
        logger.info(`📄 Page trouvée: ${route}/${item}`);
        const content = await fs.readFile(fullPath, 'utf8');
        
        // Analyse intelligente du contenu
        pages.push({
          name: generateIntelligentPageName(item, content),
          route: route + '/' + item.replace(/\\.(tsx|jsx|js)$/, ''),
          file: fullPath,
          contentLength: content.length,
          hasForm: content.includes('form') || content.includes('Form'),
          hasState: content.includes('useState'),
          hasAuth: content.includes('auth') || content.includes('login'),
          components: extractComponents(content),
          businessContext: analyzeBusinessContext(content, route)
        });
      }
    }
    
    return pages;
  } catch (error) {
    logger.error(`❌ Erreur scan ${dirPath}: ${error.message}`);
    return [];
  }
}

// Génération de noms intelligents
function generateIntelligentPageName(fileName, content) {
  const route = fileName.replace(/\\.(tsx|jsx|js)$/, '');
  
  // Analyse du contenu pour générer un nom intelligent
  if (content.includes('sensor') || content.includes('Sensor')) return 'Gestion des Capteurs';
  if (content.includes('machine') || content.includes('Machine')) return 'Gestion des Machines';
  if (content.includes('zone') || content.includes('Zone')) return 'Gestion des Zones';
  if (content.includes('dashboard') || content.includes('Dashboard')) return 'Dashboard Principal';
  if (content.includes('alert') || content.includes('Alert')) return 'Gestion des Alertes';
  if (content.includes('client') || content.includes('Client')) return 'Espace Client';
  if (content.includes('admin') || content.includes('Admin')) return 'Administration';
  if (content.includes('login') || content.includes('Login')) return 'Authentification';
  if (content.includes('site') || content.includes('Site')) return 'Gestion des Sites';
  if (content.includes('monitoring') || content.includes('Monitoring')) return 'Monitoring IoT';
  if (content.includes('form') && content.includes('create')) return 'Création d\'Entité';
  if (content.includes('form') && content.includes('edit')) return 'Modification d\'Entité';
  
  return route.charAt(0).toUpperCase() + route.slice(1).replace(/-/g, ' ');
}

// Extraction des composants
function extractComponents(content) {
  const components = [];
  const importMatches = content.match(/import.*from ['"]@\/components\/.*['"]/g) || [];
  importMatches.forEach(match => {
    const componentMatch = match.match(/import\\s*{([^}]+)}/);
    if (componentMatch) {
      components.push(...componentMatch[1].split(',').map(c => c.trim()));
    }
  });
  return components;
}

// Analyse du contexte business
function analyzeBusinessContext(content, route) {
  if (route.includes('admin')) return 'Interface d\'administration pour la gestion système';
  if (route.includes('client')) return 'Interface client pour la surveillance IoT';
  if (route.includes('sensor')) return 'Gestion des capteurs et données IoT';
  if (route.includes('machine')) return 'Contrôle et surveillance des machines industrielles';
  if (route.includes('monitoring')) return 'Supervision temps réel des équipements';
  if (route.includes('alert')) return 'Système de notifications et alertes';
  
  return 'Interface utilisateur de l\'application IoT Capnio';
}

// Analyse complète d'un projet
async function analyzeProject(githubUrl) {
  try {
    logger.info(`🚀 Début analyse de: ${githubUrl}`);
    
    // 1. Cloner le repository
    const repoPath = await cloneRepository(githubUrl);
    logger.success(`✅ Repository cloné dans: ${repoPath}`);
    
    // 2. Détecter le framework
    const packageJsonPath = path.join(repoPath, 'package.json');
    let framework = 'unknown';
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (packageJson.dependencies?.next) framework = 'Next.js';
      else if (packageJson.dependencies?.react) framework = 'React';
    } catch (e) {
      logger.error('Package.json non trouvé ou invalide');
    }
    
    // 3. Scanner les pages
    const appDir = path.join(repoPath, 'src', 'app');
    const pages = await scanPagesDirectory(appDir);
    
    logger.success(`🎉 Analyse terminée: ${pages.length} pages détectées`);
    
    // 4. Nettoyage (optionnel en mode debug)
    // await fs.rm(repoPath, { recursive: true, force: true });
    
    return {
      projectName: githubUrl.split('/').pop(),
      framework: framework,
      pagesCount: pages.length,
      pages: pages,
      status: 'analyzed',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`💥 Erreur analyse: ${error.message}`);
    throw error;
  }
}

// Routes API
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: 'FIXED-1.0.0'
  });
});

app.post('/api/analyze-test', async (req, res) => {
  const { github_url } = req.body;
  
  if (!github_url) {
    return res.status(400).json({ error: 'github_url requis' });
  }
  
  try {
    logger.info(`🔄 Analyse test démarrée pour: ${github_url}`);
    const result = await analyzeProject(github_url);
    
    res.json({
      success: true,
      message: 'Analyse terminée avec succès !',
      result: result
    });
    
  } catch (error) {
    logger.error(`❌ Erreur analyse: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Démarrage serveur
const PORT = 3003;
app.listen(PORT, () => {
  logger.success(`🚀 Serveur de test démarré sur port ${PORT}`);
  logger.info(`📋 Test disponible sur: http://localhost:${PORT}/health`);
  logger.info(`🔬 Analyse test: POST http://localhost:${PORT}/api/analyze-test`);
});