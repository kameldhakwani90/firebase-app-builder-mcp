/**
 * 🎭 PRIXIGRAD.IO - Configuration Manager
 * 
 * Gestion centralisée de la configuration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const Logger = require('./logger');

class ConfigManager {
  constructor() {
    this.logger = new Logger('ConfigManager');
    this.configDir = path.join(os.homedir(), '.prixigrad');
    this.configFile = path.join(this.configDir, 'config.json');
    this.defaultConfig = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      
      // Configuration PostgreSQL
      postgresql: {
        host: 'localhost',
        port: 5432,
        database: 'prixigrad_default',
        username: 'postgres',
        password: null,
        ssl: false
      },
      
      // Configuration GitHub
      github: {
        token: null,
        defaultBranch: 'prod-auto'
      },
      
      // Configuration MCP
      mcp: {
        timeout: 120000, // 2 minutes
        retries: 3,
        agents: {
          filesystem: true,
          postgres: true,
          prisma: true,
          sequential: true
        }
      },
      
      // Configuration déploiement
      deployment: {
        docker: true,
        branch: 'prod-auto',
        autoCommit: true,
        autoPush: false // Sécurité: ne pas push automatiquement
      },
      
      // Configuration interface web
      web: {
        port: 3001,      // Interface Next.js
        bridgePort: 3002, // BridgeServer API
        autoOpen: true
      },
      
      // Configuration logging
      logging: {
        level: 'info',
        keepDays: 7,
        debug: false
      }
    };
  }

  /**
   * Initialise le répertoire de configuration
   */
  ensureConfigDirectory() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        this.logger.info('Répertoire de configuration créé');
      }
    } catch (error) {
      this.logger.error('Impossible de créer le répertoire de configuration', error);
      throw error;
    }
  }

  /**
   * Charge la configuration
   */
  load() {
    try {
      if (fs.existsSync(this.configFile)) {
        const configData = fs.readFileSync(this.configFile, 'utf8');
        const userConfig = JSON.parse(configData);
        
        // Merge avec la config par défaut pour les nouvelles clés
        const config = this.mergeConfig(this.defaultConfig, userConfig);
        
        this.logger.debug('Configuration chargée avec succès');
        return config;
      } else {
        this.logger.info('Aucune configuration trouvée, utilisation des valeurs par défaut');
        return this.defaultConfig;
      }
    } catch (error) {
      this.logger.error('Erreur lors du chargement de la configuration', error);
      this.logger.warn('Utilisation de la configuration par défaut');
      return this.defaultConfig;
    }
  }

  /**
   * Sauvegarde la configuration
   */
  save(config) {
    try {
      this.ensureConfigDirectory();
      
      // Mise à jour du timestamp
      config.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      this.logger.success('Configuration sauvegardée');
      
      return true;
    } catch (error) {
      this.logger.error('Erreur lors de la sauvegarde de la configuration', error);
      return false;
    }
  }

  /**
   * Met à jour une valeur de configuration
   */
  set(key, value) {
    try {
      const config = this.load();
      
      // Support pour les clés imbriquées (ex: "postgresql.host")
      const keys = key.split('.');
      let current = config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      return this.save(config);
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour de ${key}`, error);
      return false;
    }
  }

  /**
   * Récupère une valeur de configuration
   */
  get(key, defaultValue = null) {
    try {
      const config = this.load();
      
      // Support pour les clés imbriquées
      const keys = key.split('.');
      let current = config;
      
      for (const k of keys) {
        if (current[k] === undefined) {
          return defaultValue;
        }
        current = current[k];
      }
      
      return current;
    } catch (error) {
      this.logger.error(`Erreur lors de la lecture de ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * Réinitialise la configuration
   */
  reset() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
        this.logger.info('Configuration réinitialisée');
      }
      
      return this.save(this.defaultConfig);
    } catch (error) {
      this.logger.error('Erreur lors de la réinitialisation', error);
      return false;
    }
  }

  /**
   * Affiche la configuration actuelle
   */
  show() {
    const config = this.load();
    
    console.log('\n📋 Configuration PRIXIGRAD.IO:');
    console.log('━'.repeat(50));
    
    // Masquer les informations sensibles
    const sanitized = JSON.parse(JSON.stringify(config));
    if (sanitized.postgresql.password) {
      sanitized.postgresql.password = '***masked***';
    }
    if (sanitized.github.token) {
      sanitized.github.token = '***masked***';
    }
    
    console.log(JSON.stringify(sanitized, null, 2));
    console.log('━'.repeat(50));
    console.log(`📁 Fichier: ${this.configFile}\n`);
  }

  /**
   * Merge récursif de deux objets de configuration
   */
  mergeConfig(defaultConfig, userConfig) {
    const result = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (userConfig[key] && typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        result[key] = this.mergeConfig(result[key] || {}, userConfig[key]);
      } else {
        result[key] = userConfig[key];
      }
    }
    
    return result;
  }

  /**
   * Validation de la configuration
   */
  validate(config = null) {
    if (!config) {
      config = this.load();
    }

    const errors = [];
    
    // Validation PostgreSQL
    if (!config.postgresql.host) {
      errors.push('postgresql.host est requis');
    }
    
    if (!config.postgresql.port || config.postgresql.port < 1 || config.postgresql.port > 65535) {
      errors.push('postgresql.port doit être entre 1 et 65535');
    }
    
    // Validation ports web
    if (config.web.port === config.web.bridgePort) {
      errors.push('web.port et web.bridgePort doivent être différents');
    }
    
    if (errors.length > 0) {
      this.logger.error('Configuration invalide:', { errors });
      return { valid: false, errors };
    }
    
    this.logger.success('Configuration valide');
    return { valid: true, errors: [] };
  }
}

module.exports = ConfigManager;