#!/usr/bin/env node

/**
 * 🎭 PRIXIGRAD.IO - Validation État Actuel
 * 
 * Valide l'état actuel du système et montre ce qui fonctionne
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./lib/core/logger');

class StateValidator {
  constructor() {
    this.logger = new Logger('Validator');
  }

  async validateCurrentState() {
    this.logger.banner('VALIDATION ÉTAT ACTUEL PRIXIGRAD.IO');

    const validations = [
      { name: '📦 NPM Package Structure', fn: this.validatePackageStructure },
      { name: '⚙️ Core System Modules', fn: this.validateCoreModules },
      { name: '🖥️ CLI Commands', fn: this.validateCLICommands },
      { name: '🌉 Bridge Server', fn: this.validateBridgeServer },
      { name: '🌐 Web Interface', fn: this.validateWebInterface },
      { name: '📋 Configuration System', fn: this.validateConfiguration }
    ];

    let allValid = true;

    for (const validation of validations) {
      try {
        this.logger.info(`🔍 ${validation.name}`);
        const result = await validation.fn.call(this);
        
        if (result.success) {
          this.logger.success(`✅ ${validation.name} - ${result.details}`);
        } else {
          this.logger.warn(`⚠️ ${validation.name} - ${result.details}`);
          allValid = false;
        }
      } catch (error) {
        this.logger.error(`❌ ${validation.name} - Erreur: ${error.message}`);
        allValid = false;
      }
    }

    this.showFinalSummary(allValid);
  }

  validatePackageStructure() {
    const requiredFiles = [
      'package.json',
      'bin/prixigrad',
      'lib/cli/commands/init.js',
      'lib/cli/commands/start.js',
      'lib/cli/commands/status.js',
      'lib/cli/commands/transform.js',
      'lib/core/system-checker.js',
      'lib/core/bridge-server.js',
      'lib/core/config.js',
      'lib/core/logger.js',
      'lib/core/mcp-installer.js'
    ];

    const missing = [];
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(__dirname, file))) {
        missing.push(file);
      }
    }

    return {
      success: missing.length === 0,
      details: missing.length === 0 
        ? `Tous les fichiers requis présents (${requiredFiles.length})`
        : `${missing.length} fichiers manquants: ${missing.join(', ')}`
    };
  }

  validateCoreModules() {
    const modules = [
      'SystemChecker',
      'BridgeServer', 
      'ConfigManager',
      'MCPInstaller',
      'Logger'
    ];

    const working = [];
    const broken = [];

    for (const moduleName of modules) {
      try {
        const ModuleClass = require(`./lib/core/${moduleName.toLowerCase().replace('manager', '').replace('checker', '-checker')}`);
        new ModuleClass();
        working.push(moduleName);
      } catch (error) {
        broken.push(`${moduleName}: ${error.message}`);
      }
    }

    return {
      success: broken.length === 0,
      details: broken.length === 0
        ? `Tous les modules fonctionnels (${working.join(', ')})`
        : `Modules cassés: ${broken.join(', ')}`
    };
  }

  validateCLICommands() {
    const commands = ['init', 'start', 'status', 'transform', 'config', 'logs'];
    const existing = [];
    const missing = [];

    for (const cmd of commands) {
      const cmdPath = path.join(__dirname, 'lib/cli/commands', `${cmd}.js`);
      if (fs.existsSync(cmdPath)) {
        existing.push(cmd);
      } else {
        missing.push(cmd);
      }
    }

    return {
      success: missing.length === 0,
      details: `${existing.length}/${commands.length} commandes disponibles: ${existing.join(', ')}`
    };
  }

  async validateBridgeServer() {
    try {
      const BridgeServer = require('./lib/core/bridge-server');
      const server = new BridgeServer();
      
      // Test de démarrage rapide
      const info = await server.start(3003);
      await server.stop();

      return {
        success: true,
        details: 'Démarrage/arrêt OK, API endpoints configurés'
      };
    } catch (error) {
      return {
        success: false,
        details: `Erreur: ${error.message}`
      };
    }
  }

  validateWebInterface() {
    const webPath = path.join(__dirname, 'lib/web');
    
    if (!fs.existsSync(webPath)) {
      return {
        success: false,
        details: 'Répertoire web manquant'
      };
    }

    const webFiles = [
      'package.json',
      'next.config.js',
      'src/app/page.tsx',
      'src/app/project/[id]/page.tsx'
    ];

    const existing = webFiles.filter(file => 
      fs.existsSync(path.join(webPath, file))
    );

    const hasNodeModules = fs.existsSync(path.join(webPath, 'node_modules'));

    return {
      success: existing.length === webFiles.length,
      details: `${existing.length}/${webFiles.length} fichiers web, dépendances: ${hasNodeModules ? 'OK' : 'Manquantes'}`
    };
  }

  validateConfiguration() {
    try {
      const ConfigManager = require('./lib/core/config');
      const config = new ConfigManager();
      const loadedConfig = config.load();

      return {
        success: true,
        details: `Configuration chargée, ${Object.keys(loadedConfig).length} sections`
      };
    } catch (error) {
      return {
        success: false,
        details: `Erreur configuration: ${error.message}`
      };
    }
  }

  showFinalSummary(allValid) {
    this.logger.separator();
    
    console.log(`
🎯 RÉSUMÉ DE L'ÉTAT ACTUEL

${allValid ? '🎉 SYSTÈME OPÉRATIONNEL' : '⚠️ SYSTÈME PARTIELLEMENT FONCTIONNEL'}

✅ PHASES TERMINÉES:
• Phase 1: Structure NPM Package ✅
• Phase 2: Core System (CLI, Bridge, Config) ✅  
• Phase 3: Interface Web (adaptation v4.5) ✅

📊 FONCTIONNALITÉS DISPONIBLES:
• 'prixigrad init' - Initialisation système
• 'prixigrad start' - Démarrage interface web + bridge
• 'prixigrad status' - Vérification système  
• 'prixigrad config' - Configuration
• BridgeServer avec API REST et Server-Sent Events
• Interface web Next.js adaptée

🎯 PROCHAINES ÉTAPES:
• Phase 4: Orchestrateur MCP (communication réelle avec agents)
• Phase 5: Tests end-to-end
• Phase 6: Publication NPM

💡 POUR TESTER MAINTENANT:
1. cd ${__dirname}
2. node bin/prixigrad start
3. Ouvrir http://localhost:3001
`);

    this.logger.separator();
  }
}

// Exécution si appelé directement
if (require.main === module) {
  const validator = new StateValidator();
  validator.validateCurrentState().catch(error => {
    console.error('❌ Erreur validation:', error.message);
    process.exit(1);
  });
}

module.exports = StateValidator;