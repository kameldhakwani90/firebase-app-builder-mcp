/**
 * 🎭 PRIXIGRAD.IO - MCP Installer
 * 
 * Installation et gestion des agents MCP externes
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Logger = require('./logger');

class MCPInstaller {
  constructor() {
    this.logger = new Logger('MCPInstaller');
    
    // Agents MCP requis avec leurs configurations
    this.requiredAgents = {
      'filesystem': {
        package: '@modelcontextprotocol/server-filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        description: 'Agent de gestion des fichiers et répertoires'
      },
      'postgres': {
        package: '@modelcontextprotocol/server-postgres',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        description: 'Agent de gestion PostgreSQL'
      },
      'sequential-thinking': {
        package: '@modelcontextprotocol/server-sequential-thinking',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
        description: 'Agent de planification séquentielle'
      },
      'prisma': {
        package: 'prisma',
        command: 'npx',
        args: ['-y', 'prisma'],
        description: 'ORM Prisma pour gestion base de données'
      },
      'git': {
        package: '@modelcontextprotocol/server-git',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
        description: 'Agent de gestion Git'
      }
    };

    this.claudeConfigDir = path.join(os.homedir(), '.config', 'claude');
    this.mcpConfigFile = path.join(this.claudeConfigDir, 'mcp_servers.json');
  }

  /**
   * Installation de tous les agents MCP requis
   */
  async installAll() {
    this.logger.banner('INSTALLATION AGENTS MCP');

    const results = {
      success: true,
      installed: [],
      failed: [],
      skipped: [],
      errors: []
    };

    for (const [agentName, config] of Object.entries(this.requiredAgents)) {
      try {
        this.logger.info(`🤖 Installation ${agentName}...`);
        
        const installed = await this.installAgent(agentName, config);
        
        if (installed.success) {
          results.installed.push(agentName);
          this.logger.success(`✅ ${agentName} installé`);
        } else if (installed.skipped) {
          results.skipped.push(agentName);
          this.logger.info(`⏭️ ${agentName} déjà installé`);
        } else {
          results.failed.push(agentName);
          results.errors.push(installed.error);
          this.logger.error(`❌ Erreur ${agentName}: ${installed.error}`);
        }
      } catch (error) {
        results.success = false;
        results.failed.push(agentName);
        results.errors.push(error.message);
        this.logger.error(`❌ Exception ${agentName}`, error);
      }
    }

    // Configuration Claude Code avec les agents installés
    if (results.installed.length > 0 || results.skipped.length > 0) {
      await this.configureClaudeCode();
    }

    // Résumé
    this.logger.separator();
    console.log(`📊 Résumé installation MCP:`);
    console.log(`   ✅ Installés: ${results.installed.length}`);
    console.log(`   ⏭️ Ignorés: ${results.skipped.length}`);
    console.log(`   ❌ Échecs: ${results.failed.length}`);

    if (results.failed.length > 0) {
      results.success = false;
      console.log(`\n❌ Agents en échec: ${results.failed.join(', ')}`);
    }

    return results;
  }

  /**
   * Récupère la liste des agents MCP disponibles
   */
  getAvailableAgents() {
    return Object.entries(this.requiredAgents).map(([name, config]) => ({
      name,
      package: config.package,
      description: config.description,
      command: config.command,
      args: config.args
    }));
  }

  /**
   * Installation d'un agent MCP spécifique
   */
  async installAgent(agentName, config) {
    try {
      // Vérifier si déjà installé
      if (await this.isAgentInstalled(config.package)) {
        return { success: true, skipped: true };
      }

      // Installation globale du package
      this.logger.info(`📦 Installation package ${config.package}...`);
      
      const installCommand = `npm install -g ${config.package}`;
      
      await this.executeCommand(installCommand, {
        description: `Installation ${config.package}`,
        timeout: 300000 // 5 minutes
      });

      // Vérification post-installation
      const isInstalled = await this.isAgentInstalled(config.package);
      
      if (!isInstalled) {
        throw new Error(`Package installé mais non détecté: ${config.package}`);
      }

      // Test de fonctionnement
      await this.testAgent(agentName, config);

      return { success: true, skipped: false };

    } catch (error) {
      return { 
        success: false, 
        skipped: false, 
        error: error.message 
      };
    }
  }

  /**
   * Vérification si un agent est installé
   */
  async isAgentInstalled(packageName) {
    try {
      execSync(`npm list -g ${packageName}`, { 
        stdio: 'ignore',
        timeout: 10000
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test de fonctionnement d'un agent
   */
  async testAgent(agentName, config) {
    this.logger.debug(`🧪 Test agent ${agentName}...`);

    try {
      // Test différent selon le type d'agent
      switch (agentName) {
        case 'prisma':
          execSync('npx prisma --version', { 
            stdio: 'ignore',
            timeout: 15000
          });
          break;
          
        case 'git':
          // Test Git déjà fait dans SystemChecker
          break;
          
        default:
          // Test générique: vérifier que le package répond
          const testCommand = `${config.command} ${config.args.join(' ')} --help`;
          execSync(testCommand, { 
            stdio: 'ignore',
            timeout: 15000
          });
      }

      this.logger.debug(`✅ Test ${agentName} réussi`);
      return true;

    } catch (error) {
      this.logger.warn(`⚠️ Test ${agentName} échoué: ${error.message}`);
      // Ne pas faire échouer l'installation pour un test
      return true;
    }
  }

  /**
   * Configuration Claude Code avec les agents MCP
   */
  async configureClaudeCode() {
    this.logger.info('⚙️ Configuration Claude Code...');

    try {
      // Créer le répertoire de config Claude si nécessaire
      if (!fs.existsSync(this.claudeConfigDir)) {
        fs.mkdirSync(this.claudeConfigDir, { recursive: true });
      }

      // Configuration MCP pour Claude Code
      const mcpConfig = {
        mcpServers: {
          "prixigrad-filesystem": {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", os.homedir()]
          },
          "prixigrad-postgres": {
            command: "npx", 
            args: ["-y", "@modelcontextprotocol/server-postgres"]
          },
          "prixigrad-sequential": {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-sequential-thinking"]
          },
          "prixigrad-prisma": {
            command: "npx",
            args: ["-y", "prisma", "mcp"]
          }
        }
      };

      // Sauvegarder la configuration
      fs.writeFileSync(this.mcpConfigFile, JSON.stringify(mcpConfig, null, 2));
      
      this.logger.success('✅ Configuration Claude Code sauvegardée');
      
      return true;

    } catch (error) {
      this.logger.error('❌ Erreur configuration Claude Code', error);
      return false;
    }
  }

  /**
   * Installation des agents manquants seulement
   */
  async installAgents(agentNames) {
    this.logger.info(`🤖 Installation agents spécifiques: ${agentNames.join(', ')}`);

    const results = {
      success: true,
      installed: [],
      failed: [],
      errors: []
    };

    for (const agentName of agentNames) {
      const config = this.requiredAgents[agentName];
      
      if (!config) {
        this.logger.warn(`⚠️ Agent inconnu: ${agentName}`);
        continue;
      }

      try {
        const result = await this.installAgent(agentName, config);
        
        if (result.success && !result.skipped) {
          results.installed.push(agentName);
        } else if (!result.success) {
          results.failed.push(agentName);
          results.errors.push(result.error);
        }
      } catch (error) {
        results.failed.push(agentName);
        results.errors.push(error.message);
      }
    }

    if (results.failed.length > 0) {
      results.success = false;
    }

    return results;
  }

  /**
   * Désinstallation d'un agent MCP
   */
  async uninstallAgent(agentName) {
    const config = this.requiredAgents[agentName];
    
    if (!config) {
      throw new Error(`Agent inconnu: ${agentName}`);
    }

    try {
      this.logger.info(`🗑️ Désinstallation ${agentName}...`);
      
      const uninstallCommand = `npm uninstall -g ${config.package}`;
      
      await this.executeCommand(uninstallCommand, {
        description: `Désinstallation ${config.package}`
      });

      this.logger.success(`✅ ${agentName} désinstallé`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Erreur désinstallation ${agentName}`, error);
      return false;
    }
  }

  /**
   * Mise à jour des agents MCP
   */
  async updateAgents() {
    this.logger.info('🔄 Mise à jour agents MCP...');

    const results = {
      success: true,
      updated: [],
      failed: [],
      errors: []
    };

    for (const [agentName, config] of Object.entries(this.requiredAgents)) {
      try {
        if (await this.isAgentInstalled(config.package)) {
          this.logger.info(`🔄 Mise à jour ${agentName}...`);
          
          const updateCommand = `npm update -g ${config.package}`;
          
          await this.executeCommand(updateCommand, {
            description: `Mise à jour ${config.package}`
          });

          results.updated.push(agentName);
          this.logger.success(`✅ ${agentName} mis à jour`);
        }
      } catch (error) {
        results.failed.push(agentName);
        results.errors.push(error.message);
        this.logger.error(`❌ Erreur mise à jour ${agentName}`, error);
      }
    }

    if (results.failed.length > 0) {
      results.success = false;
    }

    return results;
  }

  /**
   * Statut des agents MCP installés
   */
  async getAgentsStatus() {
    const status = {};

    for (const [agentName, config] of Object.entries(this.requiredAgents)) {
      try {
        const installed = await this.isAgentInstalled(config.package);
        
        if (installed) {
          // Tenter de récupérer la version
          try {
            let version = 'unknown';
            const versionCommand = `npm list -g ${config.package} --depth=0`;
            const output = execSync(versionCommand, { encoding: 'utf8', timeout: 5000 });
            const versionMatch = output.match(new RegExp(`${config.package}@([\\d\\.]+)`));
            if (versionMatch) {
              version = versionMatch[1];
            }
            
            status[agentName] = {
              installed: true,
              version: version,
              package: config.package,
              description: config.description
            };
          } catch (versionError) {
            status[agentName] = {
              installed: true,
              version: 'unknown',
              package: config.package,
              description: config.description
            };
          }
        } else {
          status[agentName] = {
            installed: false,
            package: config.package,
            description: config.description
          };
        }
      } catch (error) {
        status[agentName] = {
          installed: false,
          error: error.message,
          package: config.package,
          description: config.description
        };
      }
    }

    return status;
  }

  /**
   * Exécution de commande avec gestion d'erreurs
   */
  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 60000;
      const description = options.description || command;

      this.logger.debug(`Exécution: ${command}`);

      const child = spawn('sh', ['-c', command], {
        stdio: options.silent ? 'ignore' : 'pipe'
      });

      let stdout = '';
      let stderr = '';

      if (!options.silent) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Timeout (${timeout}ms): ${description}`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Commande échouée (code ${code}): ${description}\n${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Erreur exécution: ${description}\n${error.message}`));
      });
    });
  }

  /**
   * Nettoyage et réinitialisation
   */
  async cleanup() {
    this.logger.info('🧹 Nettoyage configuration MCP...');

    try {
      if (fs.existsSync(this.mcpConfigFile)) {
        fs.unlinkSync(this.mcpConfigFile);
        this.logger.success('Configuration MCP supprimée');
      }

      return true;
    } catch (error) {
      this.logger.error('Erreur lors du nettoyage', error);
      return false;
    }
  }
}

module.exports = MCPInstaller;