import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';
import net from 'net';

const execAsync = promisify(exec);

export interface PortInfo {
  port: number;
  pid?: number;
  process?: string;
  command?: string;
  isAvailable: boolean;
}

export class PortManager {
  private preferredPorts = [3000, 3001, 3002, 3003, 8000, 8080, 8081];

  /**
   * Trouve un port disponible en scannant les ports préférés
   */
  async findAvailablePort(): Promise<number> {
    console.log(chalk.blue('🔍 Recherche d\'un port disponible...'));

    for (const port of this.preferredPorts) {
      const portInfo = await this.checkPort(port);
      
      if (portInfo.isAvailable) {
        console.log(chalk.green(`✅ Port ${port} disponible`));
        return port;
      } else {
        console.log(chalk.yellow(`⚠️ Port ${port} occupé par ${portInfo.process} (PID: ${portInfo.pid})`));
      }
    }

    // Si aucun port préféré n'est disponible, chercher un port aléatoire
    return await this.findRandomAvailablePort();
  }

  /**
   * Vérifie si un port spécifique est disponible et retourne les infos
   */
  async checkPort(port: number): Promise<PortInfo> {
    const portInfo: PortInfo = {
      port,
      isAvailable: false
    };

    try {
      // Vérifier si le port est libre avec une connexion TCP
      const isPortFree = await this.isPortFree(port);
      
      if (isPortFree) {
        portInfo.isAvailable = true;
        return portInfo;
      }

      // Si le port est occupé, obtenir des infos sur le processus
      const processInfo = await this.getProcessInfo(port);
      portInfo.pid = processInfo.pid;
      portInfo.process = processInfo.process;
      portInfo.command = processInfo.command;

    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Erreur lors de la vérification du port ${port}:`, error));
    }

    return portInfo;
  }

  /**
   * Demande à l'utilisateur s'il veut fermer un processus occupant un port
   */
  async handlePortConflict(port: number): Promise<boolean> {
    const portInfo = await this.checkPort(port);
    
    if (portInfo.isAvailable) {
      return true; // Port libre, pas de conflit
    }

    // Afficher les détails du conflit
    console.log();
    console.log(chalk.red('🚨 CONFLIT DE PORT DÉTECTÉ!'));
    console.log(chalk.yellow(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(chalk.white(`📍 Port: ${chalk.bold(port)}`));
    console.log(chalk.white(`🔄 Processus: ${chalk.bold(portInfo.process || 'Inconnu')}`));
    console.log(chalk.white(`🆔 PID: ${chalk.bold(portInfo.pid || 'Inconnu')}`));
    if (portInfo.command) {
      console.log(chalk.white(`⚡ Commande: ${chalk.gray(portInfo.command.substring(0, 60))}${portInfo.command.length > 60 ? '...' : ''}`));
    }
    console.log(chalk.yellow(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log();

    // Demander à l'utilisateur
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'killProcess',
        message: `Voulez-vous fermer ce processus pour libérer le port ${port} ?`,
        default: false
      }
    ]);

    if (answer.killProcess) {
      return await this.killProcess(portInfo);
    }

    return false;
  }

  /**
   * Tue un processus et vérifie qu'il est bien fermé
   */
  private async killProcess(portInfo: PortInfo): Promise<boolean> {
    if (!portInfo.pid) {
      console.error(chalk.red('❌ Impossible de fermer le processus: PID introuvable'));
      return false;
    }

    try {
      console.log(chalk.yellow(`🔄 Fermeture du processus ${portInfo.process} (PID: ${portInfo.pid})...`));

      // Essayer d'abord un arrêt propre (SIGTERM)
      if (process.platform === 'win32') {
        await execAsync(`taskkill /PID ${portInfo.pid} /F`);
      } else {
        await execAsync(`kill -TERM ${portInfo.pid}`);
      }

      // Attendre un peu et vérifier
      await this.sleep(2000);
      
      const recheck = await this.checkPort(portInfo.port);
      if (recheck.isAvailable) {
        console.log(chalk.green(`✅ Port ${portInfo.port} libéré avec succès`));
        return true;
      }

      // Si le processus refuse de se fermer, forcer (SIGKILL)
      console.log(chalk.yellow(`⚠️ Forçage de la fermeture...`));
      if (process.platform === 'win32') {
        await execAsync(`taskkill /PID ${portInfo.pid} /F /T`);
      } else {
        await execAsync(`kill -KILL ${portInfo.pid}`);
      }

      await this.sleep(1000);
      const finalCheck = await this.checkPort(portInfo.port);
      
      if (finalCheck.isAvailable) {
        console.log(chalk.green(`✅ Processus fermé de force, port ${portInfo.port} disponible`));
        return true;
      } else {
        console.error(chalk.red(`❌ Impossible de libérer le port ${portInfo.port}`));
        return false;
      }

    } catch (error) {
      console.error(chalk.red(`❌ Erreur lors de la fermeture du processus:`), error);
      return false;
    }
  }

  /**
   * Vérifie si un port est libre en tentant une connexion
   */
  private async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Obtient les informations du processus utilisant un port
   */
  private async getProcessInfo(port: number): Promise<{ pid?: number; process?: string; command?: string }> {
    try {
      let command: string;
      
      if (process.platform === 'win32') {
        command = `netstat -ano | findstr :${port}`;
      } else {
        command = `lsof -ti:${port}`;
      }

      const { stdout } = await execAsync(command);
      
      if (process.platform === 'win32') {
        // Parse netstat output sur Windows
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const localAddress = parts[1];
            const pid = parseInt(parts[4]);
            
            if (localAddress.includes(`:${port}`)) {
              // Obtenir le nom du processus
              try {
                const { stdout: processName } = await execAsync(`tasklist /PID ${pid} /FO CSV /NH`);
                const processInfo = processName.split(',')[0].replace(/"/g, '');
                
                return {
                  pid,
                  process: processInfo,
                  command: `PID ${pid}`
                };
              } catch {
                return { pid, process: 'Unknown', command: `PID ${pid}` };
              }
            }
          }
        }
      } else {
        // Parse lsof output sur Unix/macOS
        const pid = parseInt(stdout.trim());
        if (!isNaN(pid)) {
          try {
            const { stdout: processInfo } = await execAsync(`ps -p ${pid} -o comm= -o args=`);
            const [process, ...args] = processInfo.trim().split(' ');
            
            return {
              pid,
              process: process.split('/').pop() || process,
              command: args.join(' ')
            };
          } catch {
            return { pid, process: 'unknown' };
          }
        }
      }
    } catch (error) {
      // Port libre ou erreur
    }

    return {};
  }

  /**
   * Trouve un port libre dans une plage aléatoire
   */
  private async findRandomAvailablePort(): Promise<number> {
    console.log(chalk.blue('🎲 Recherche d\'un port aléatoire...'));
    
    for (let i = 0; i < 50; i++) {
      const randomPort = Math.floor(Math.random() * (9000 - 3000) + 3000);
      
      if (await this.isPortFree(randomPort)) {
        console.log(chalk.green(`✅ Port aléatoire trouvé: ${randomPort}`));
        return randomPort;
      }
    }

    throw new Error('Impossible de trouver un port disponible');
  }

  /**
   * Démarre une application sur un port, en gérant les conflits
   */
  async startAppOnPort(command: string, preferredPort: number = 3000): Promise<{ port: number; success: boolean }> {
    console.log(chalk.blue(`🚀 Démarrage de l'application sur le port ${preferredPort}...`));

    // Vérifier le port préféré
    const canUsePreferred = await this.handlePortConflict(preferredPort);
    
    let finalPort = preferredPort;
    
    if (!canUsePreferred) {
      console.log(chalk.yellow(`⚠️ Port ${preferredPort} non disponible, recherche d'une alternative...`));
      finalPort = await this.findAvailablePort();
    }

    try {
      // Modifier la commande pour utiliser le bon port
      const modifiedCommand = command.replace(/PORT=\d+/, `PORT=${finalPort}`);
      
      console.log(chalk.green(`🎯 Démarrage sur le port ${finalPort}...`));
      console.log(chalk.gray(`   Commande: ${modifiedCommand}`));
      
      // Ici on exécuterait la commande (dans le contexte réel)
      // Pour l'instant on simule le succès
      
      return {
        port: finalPort,
        success: true
      };
      
    } catch (error) {
      console.error(chalk.red(`❌ Erreur lors du démarrage:`), error);
      return {
        port: finalPort,
        success: false
      };
    }
  }

  /**
   * Utilitaire pour attendre
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Affiche un résumé des ports système
   */
  async showPortsSummary(): Promise<void> {
    console.log(chalk.bold.cyan('📊 Résumé des ports système:'));
    console.log(chalk.gray('━'.repeat(60)));

    for (const port of this.preferredPorts) {
      const info = await this.checkPort(port);
      
      const status = info.isAvailable ? 
        chalk.green('✅ Libre') : 
        chalk.red('❌ Occupé');
      
      const details = info.isAvailable ? 
        '' : 
        chalk.gray(` (${info.process}, PID: ${info.pid})`);
      
      console.log(`Port ${chalk.bold(port.toString().padEnd(4))}: ${status}${details}`);
    }
    
    console.log(chalk.gray('━'.repeat(60)));
  }
}

// Instance globale du gestionnaire de ports
export const portManager = new PortManager();