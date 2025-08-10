#!/usr/bin/env node

/**
 * Installation directe des agents MCP (bypass commande init buggée)
 */

const MCPInstaller = require('./lib/core/mcp-installer');
const Logger = require('./lib/core/logger');

async function installMCPAgentsDirect() {
  const logger = new Logger('MCPInstall');
  
  try {
    logger.banner('INSTALLATION DIRECTE AGENTS MCP');
    
    const installer = new MCPInstaller();
    
    logger.info('📦 Agents à installer:');
    const agents = installer.getAvailableAgents();
    agents.forEach(agent => {
      logger.info(`  • ${agent.name}: ${agent.description}`);
    });
    
    logger.info('🚀 Début installation...');
    const result = await installer.installAll();
    
    if (result.success) {
      logger.success('✅ Tous les agents MCP installés avec succès !');
      logger.info('📊 Résumé:');
      logger.info(`  • Installés: ${result.installed.length}`);
      logger.info(`  • Échoués: ${result.failed.length}`);
      
      if (result.installed.length > 0) {
        logger.info('✅ Agents installés:');
        result.installed.forEach(agent => {
          logger.info(`  • ${agent}`);
        });
      }
      
      if (result.failed.length > 0) {
        logger.warn('❌ Agents échoués:');
        result.failed.forEach(failure => {
          logger.error(`  • ${failure.agent}: ${failure.error}`);
        });
      }
      
    } else {
      logger.error('❌ Erreur installation globale:', result.error);
    }
    
    // Vérification post-installation
    logger.info('🔍 Vérification post-installation...');
    const status = installer.checkInstallationStatus();
    
    logger.info('📊 Status final:');
    Object.entries(status).forEach(([agent, isInstalled]) => {
      const icon = isInstalled ? '✅' : '❌';
      logger.info(`  ${icon} ${agent}`);
    });
    
    const allInstalled = Object.values(status).every(Boolean);
    
    if (allInstalled) {
      logger.success('🎉 INSTALLATION COMPLÈTE ! Tous les agents MCP sont opérationnels.');
      logger.info('💡 Vous pouvez maintenant utiliser: prixigrad start');
    } else {
      logger.warn('⚠️ Installation partielle. Certains agents manquent encore.');
    }
    
  } catch (error) {
    logger.error('❌ Erreur installation MCP:', error.message);
    logger.error('Stack:', error.stack);
    process.exit(1);
  }
}

installMCPAgentsDirect();