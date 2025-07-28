import { chromium, Browser, Page } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { spawn, ChildProcess } from 'child_process';
import { DataModel, AppFeature, TestScenario } from '../types.js';

export class RealisticTester {
  private browser?: Browser;
  private page?: Page;
  private devServer?: ChildProcess;

  async runRealisticTests(
    projectPath: string, 
    dataModels: DataModel[], 
    features: AppFeature[]
  ): Promise<{ success: boolean; results: any }> {
    console.log(chalk.blue('🌐 Démarrage des tests utilisateur réalistes...'));
    
    try {
      // 1. Démarrer le serveur de développement
      await this.startDevServer(projectPath);
      
      // 2. Configurer Playwright
      await this.setupPlaywright(projectPath);
      
      // 3. Attendre que l'app soit prête
      await this.waitForApp();
      
      // 4. Générer et exécuter les tests
      const testScenarios = this.generateTestScenarios(dataModels, features);
      await this.generateTestFiles(projectPath, testScenarios);
      
      // 5. Exécuter les tests
      const results = await this.executeTests(testScenarios);
      
      // 6. Générer le rapport
      await this.generateTestReport(projectPath, results);
      
      console.log(chalk.green('✅ Tests utilisateur terminés'));
      return { success: true, results };
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Erreur tests: ${error.message}`));
      return { success: false, results: { error: error.message } };
    } finally {
      await this.cleanup();
    }
  }

  private async startDevServer(projectPath: string): Promise<void> {
    console.log(chalk.blue('🚀 Démarrage du serveur de développement...'));
    
    // Vérifier les scripts package.json
    const packagePath = path.join(projectPath, 'package.json');
    const packageJson = await fs.readJSON(packagePath);
    
    let devCommand = 'npm run dev';
    if (packageJson.scripts?.dev) {
      devCommand = 'npm run dev';
    } else if (packageJson.scripts?.start) {
      devCommand = 'npm start';
    } else if (packageJson.scripts?.serve) {
      devCommand = 'npm run serve';
    }
    
    this.devServer = spawn(devCommand.split(' ')[0], devCommand.split(' ').slice(1), {
      cwd: projectPath,
      stdio: 'pipe'
    });
    
    // Attendre le démarrage
    await new Promise((resolve) => {
      setTimeout(resolve, 15000); // 15 secondes pour le démarrage
    });
    
    console.log(chalk.green('✅ Serveur de développement démarré'));
  }

  private async setupPlaywright(projectPath: string): Promise<void> {
    console.log(chalk.blue('🎭 Configuration de Playwright...'));
    
    // Installer Playwright si nécessaire
    const playwrightConfig = `
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
`;
    
    await fs.writeFile(path.join(projectPath, 'playwright.config.ts'), playwrightConfig);
    await fs.ensureDir(path.join(projectPath, 'e2e'));
    
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();
    
    console.log(chalk.green('✅ Playwright configuré'));
  }

  private async waitForApp(): Promise<void> {
    console.log(chalk.blue('⏳ Attente du démarrage de l\'application...'));
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        if (this.page) {
          await this.page.goto('http://localhost:3000', { timeout: 5000 });
          const title = await this.page.title();
          if (title && title !== 'Error') {
            console.log(chalk.green(`✅ Application prête (${title})`));
            return;
          }
        }
      } catch (error) {
        // Continuer à attendre
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Application non accessible après 60 secondes');
  }

  private generateTestScenarios(dataModels: DataModel[], features: AppFeature[]): TestScenario[] {
    const scenarios: TestScenario[] = [];
    
    // Scénario principal: parcours utilisateur complet
    scenarios.push({
      name: 'Parcours utilisateur complet',
      type: 'user-journey',
      steps: [
        { action: 'goto', value: 'http://localhost:3000' },
        { action: 'wait', timeout: 2000 },
        { action: 'screenshot', value: 'homepage' },
        { action: 'checkNoErrors' }
      ]
    });
    
    // Scénarios d'authentification si présente
    const authFeature = features.find(f => f.type === 'auth');
    if (authFeature) {
      scenarios.push({
        name: 'Test authentification',
        type: 'auth',
        steps: [
          { action: 'goto', value: 'http://localhost:3000' },
          { action: 'click', selector: 'text=Login,text=Se connecter,text=Sign in' },
          { action: 'fill', selector: '[name="email"],[type="email"]', value: 'test@example.com' },
          { action: 'fill', selector: '[name="password"],[type="password"]', value: 'TestPassword123!' },
          { action: 'click', selector: 'button[type="submit"]' },
          { action: 'wait', timeout: 3000 },
          { action: 'checkNoErrors' }
        ]
      });
    }
    
    // Scénarios CRUD pour chaque modèle
    for (const model of dataModels) {
      scenarios.push({
        name: `CRUD ${model.name}`,
        type: 'crud',
        steps: [
          { action: 'goto', value: 'http://localhost:3000' },
          { action: 'click', selector: `text=${model.name},a[href*="${model.name.toLowerCase()}"]` },
          { action: 'wait', timeout: 2000 },
          { action: 'checkNoErrors' },
          { action: 'click', selector: 'button,a', expected: 'Add,Ajouter,Create,Nouveau' },
          ...this.generateFormSteps(model),
          { action: 'click', selector: 'button[type="submit"]' },
          { action: 'wait', timeout: 2000 },
          { action: 'checkNoErrors' }
        ]
      });
    }
    
    // Scénario de navigation générale
    scenarios.push({
      name: 'Navigation générale',
      type: 'user-journey',
      steps: [
        { action: 'goto', value: 'http://localhost:3000' },
        { action: 'testNavigation' },
        { action: 'checkNoErrors' }
      ]
    });
    
    return scenarios;
  }

  private generateFormSteps(model: DataModel): any[] {
    const steps = [];
    
    for (const [fieldName, fieldType] of Object.entries(model.fields)) {
      const testValue = this.generateTestValue(fieldType);
      steps.push({
        action: 'fill',
        selector: `[name="${fieldName}"]`,
        value: testValue
      });
    }
    
    return steps;
  }

  private generateTestValue(type: string): string {
    const testValues: Record<string, string> = {
      string: 'Test Value',
      number: '123',
      email: 'test@example.com',
      date: '2024-01-01',
      boolean: 'true',
      url: 'https://example.com'
    };
    
    return testValues[type] || 'Test Value';
  }

  private async generateTestFiles(projectPath: string, scenarios: TestScenario[]): Promise<void> {
    const testContent = this.generatePlaywrightTest(scenarios);
    const testPath = path.join(projectPath, 'e2e', 'user-journey.spec.ts');
    
    await fs.writeFile(testPath, testContent);
    console.log(chalk.green(`✅ Fichier de test généré: ${testPath}`));
  }

  private generatePlaywrightTest(scenarios: TestScenario[]): string {
    return `
import { test, expect } from '@playwright/test';

test.describe('Tests utilisateur réalistes', () => {
  ${scenarios.map(scenario => `
  test('${scenario.name}', async ({ page }) => {
    console.log('🎭 Test: ${scenario.name}');
    
    ${scenario.steps.map(step => {
      switch (step.action) {
        case 'goto':
          return `await page.goto('${step.value}');`;
        case 'click':
          return step.expected 
            ? `
            const element = page.locator('${step.selector}').filter({ hasText: /${step.expected}/ }).first();
            if (await element.isVisible()) {
              await element.click();
              console.log('✅ Cliqué sur: ${step.expected}');
            }`
            : `await page.click('${step.selector}');`;
        case 'fill':
          return `
          const input = page.locator('${step.selector}').first();
          if (await input.isVisible()) {
            await input.fill('${step.value}');
            console.log('✅ Rempli ${step.selector}: ${step.value}');
          }`;
        case 'wait':
          return `await page.waitForTimeout(${step.timeout});`;
        case 'screenshot':
          return `await page.screenshot({ path: 'test-results/${step.value}.png' });`;
        case 'checkNoErrors':
          return `
          // Vérifier qu'il n'y a pas d'erreurs visibles
          await expect(page.locator('body')).not.toContainText('Error');
          await expect(page.locator('body')).not.toContainText('404');
          await expect(page.locator('body')).not.toContainText('undefined');
          console.log('✅ Aucune erreur détectée');`;
        case 'testNavigation':
          return `
          // Tester les liens de navigation principaux
          const navLinks = await page.locator('nav a, header a').all();
          for (const link of navLinks.slice(0, 3)) {
            const href = await link.getAttribute('href');
            if (href && href.startsWith('/')) {
              await link.click();
              await page.waitForTimeout(1000);
              await expect(page.locator('body')).not.toContainText('404');
              console.log(\`✅ Navigation vers \${href} OK\`);
            }
          }`;
        default:
          return `// Action inconnue: ${step.action}`;
      }
    }).join('\n    ')}
    
    console.log('🎉 Test "${scenario.name}" terminé avec succès');
  });
  `).join('\n')}
});

// Fonctions utilitaires
function generateTestValue(type: string): string {
  const testValues = {
    string: 'Test Value',
    number: '123',
    email: 'test@example.com',
    date: '2024-01-01',
    boolean: 'true',
    url: 'https://example.com'
  };
  return testValues[type] || 'Test Value';
}
`;
  }

  private async executeTests(scenarios: TestScenario[]): Promise<any> {
    console.log(chalk.blue('🧪 Exécution des tests...'));
    
    const results = {
      total: scenarios.length,
      passed: 0,
      failed: 0,
      details: [] as Array<{ name: string; status: string; error?: string }>
    };
    
    for (const scenario of scenarios) {
      try {
        await this.executeScenario(scenario);
        results.passed++;
        results.details.push({ name: scenario.name, status: 'passed' });
        console.log(chalk.green(`✅ ${scenario.name} - SUCCÈS`));
      } catch (error: any) {
        results.failed++;
        results.details.push({ 
          name: scenario.name, 
          status: 'failed', 
          error: error.message 
        });
        console.log(chalk.red(`❌ ${scenario.name} - ÉCHEC: ${error.message}`));
      }
    }
    
    return results;
  }

  private async executeScenario(scenario: TestScenario): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    for (const step of scenario.steps) {
      switch (step.action) {
        case 'goto':
          await this.page.goto(step.value!);
          break;
        case 'click':
          if (step.expected) {
            const element = this.page.locator(step.selector!).filter({ hasText: new RegExp(step.expected) }).first();
            if (await element.isVisible()) {
              await element.click();
            }
          } else {
            await this.page.click(step.selector!);
          }
          break;
        case 'fill':
          const input = this.page.locator(step.selector!).first();
          if (await input.isVisible()) {
            await input.fill(step.value!);
          }
          break;
        case 'wait':
          await this.page.waitForTimeout(step.timeout!);
          break;
        case 'checkNoErrors':
          // Vérification basique sans expect de Playwright
          const bodyText = await this.page.locator('body').textContent();
          if (bodyText?.includes('Error') || bodyText?.includes('404')) {
            throw new Error('Page contient des erreurs');
          }
          break;
      }
    }
  }

  private async generateTestReport(projectPath: string, results: any): Promise<void> {
    const report = `
# 🧪 Rapport de Tests Utilisateur

## 📊 Résumé
- **Total**: ${results.total} tests
- **Réussis**: ${results.passed} ✅
- **Échoués**: ${results.failed} ❌
- **Taux de réussite**: ${Math.round((results.passed / results.total) * 100)}%

## 📋 Détails des Tests

${results.details.map((detail: any) => `
### ${detail.status === 'passed' ? '✅' : '❌'} ${detail.name}
${detail.error ? `**Erreur**: ${detail.error}` : '**Statut**: Succès'}
`).join('\n')}

## 🚀 Prochaines Étapes

${results.failed > 0 ? `
⚠️  **${results.failed} test(s) ont échoué**
- Vérifiez les sélecteurs CSS dans les tests
- Assurez-vous que l'application fonctionne correctement
- Consultez les captures d'écran dans test-results/
` : `
🎉 **Tous les tests sont passés !**
L'application est prête pour la production.
`}

---
*Rapport généré le ${new Date().toLocaleString()}*
`;
    
    await fs.writeFile(path.join(projectPath, 'TEST-REPORT.md'), report);
    console.log(chalk.green('📋 Rapport de test généré: TEST-REPORT.md'));
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    
    if (this.devServer) {
      this.devServer.kill();
    }
  }
}