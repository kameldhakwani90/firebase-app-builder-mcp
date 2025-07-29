import chalk from 'chalk';

/**
 * Version simplifiée de l'interface de progression pour la beta
 * La version complète avec ASCII art sera disponible dans la version stable
 */
export class ProgressUI {
  private startTime: number = Date.now();
  
  async showWelcome(): Promise<void> {
    console.log(chalk.cyan('🚀 Firebase App Builder Agent V2.0 - Beta'));
    console.log(chalk.gray('Agent générique pour migrer n\'importe quel projet Firebase Studio'));
    console.log();
  }

  async showStep(stepNumber: number, title: string, description: string): Promise<void> {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    console.log(chalk.blue(`[${elapsed}s] Étape ${stepNumber}/8: ${title}`));
    console.log(chalk.gray(`  ${description}`));
  }

  async showProgress(message: string, percentage: number): Promise<void> {
    const bar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
    console.log(chalk.cyan(`  ${message}`));
    console.log(chalk.gray(`  ${bar} ${percentage}%`));
  }

  async showStats(stats: any): Promise<void> {
    console.log(chalk.yellow('📊 Statistiques:'));
    if (stats.modelsDetected) console.log(chalk.gray(`  • ${stats.modelsDetected} modèles détectés`));
    if (stats.apisGenerated) console.log(chalk.gray(`  • ${stats.apisGenerated} APIs générées`));
    if (stats.testsCreated) console.log(chalk.gray(`  • ${stats.testsCreated} tests créés`));
    if (stats.tokensUsed) console.log(chalk.gray(`  • ${stats.tokensUsed} tokens Claude utilisés`));
  }

  async showFinalCelebration(projectName: string, port: number): Promise<void> {
    console.log();
    console.log(chalk.green('🎉 MIGRATION TERMINÉE AVEC SUCCÈS !'));
    console.log(chalk.green('════════════════════════════════════'));
    console.log(chalk.white(`📂 Projet: ${projectName}`));
    console.log(chalk.white(`🌐 URL: http://localhost:${port}`));
    console.log(chalk.white(`⏱️ Durée: ${Math.round((Date.now() - this.startTime) / 1000)}s`));
    console.log(chalk.green('════════════════════════════════════'));
    console.log();
  }

  async showError(error: string, context?: string): Promise<void> {
    console.log();
    console.log(chalk.red('❌ ERREUR'));
    console.log(chalk.red('─'.repeat(30)));
    console.log(chalk.white(error));
    if (context) {
      console.log(chalk.gray(`Contexte: ${context}`));
    }
    console.log(chalk.red('─'.repeat(30)));
    console.log();
  }
}

export const progressUI = new ProgressUI();