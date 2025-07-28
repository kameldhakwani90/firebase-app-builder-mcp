# 🚀 FirebaseAppBuilder Agent MCP

> Agent MCP intelligent avec mémoire persistante et tests utilisateur réalistes

## 🎯 Objectif

Migrer automatiquement un prototype Next.js avec mocks vers une architecture robuste PostgreSQL + Prisma, en testant l'application comme un utilisateur réel.

## ✨ Fonctionnalités

### 🧠 Mémoire de Développeur
- **Espace de travail organisé** dans `~/firebase-migrations/`
- **Base de données locale** des projets avec historique complet
- **Reprise intelligente** : continue où il s'est arrêté
- **Sauvegarde continue** de la progression

### 🤖 Automatisation Complète
- **Clone et analyse** automatique des mocks
- **Migration base de données** vers PostgreSQL + Prisma
- **Génération d'APIs** CRUD complètes
- **Tests utilisateur réalistes** avec Playwright
- **Gestion Git** avec branches automatiques

### 🎭 Tests Utilisateur Réalistes
L'agent teste votre application comme un vrai utilisateur :
- Navigation complète de l'interface
- Formulaires et interactions
- Tests CRUD sur tous les modèles
- Gestion des erreurs et edge cases
- Authentification si présente

## 🚀 Installation

```bash
# Cloner le projet
git clone <this-repo>
cd firebase-app-builder-mcp

# Installer les dépendances
npm install

# Compiler TypeScript
npm run build

# Installer globalement (optionnel)
npm install -g .
```

## 📖 Usage

### Nouveau Projet
```bash
firebase-app-builder https://github.com/user/my-nextjs-prototype
```

### Voir les Projets en Cours
```bash
firebase-app-builder
```

### Continuer un Projet Existant
```bash
firebase-app-builder continue my-project
```

## 🔧 Architecture

```
firebase-app-builder-mcp/
├── src/
│   ├── index.ts              # Point d'entrée avec CLI
│   ├── agent.ts              # Agent principal
│   ├── memory/
│   │   ├── workspace.ts      # Gestionnaire espace de travail
│   │   └── projects.ts       # Base de données projets locaux
│   ├── tools/
│   │   ├── cloner.ts         # Git operations
│   │   ├── analyzer.ts       # Analyse mocks et structure
│   │   ├── database.ts       # Setup Prisma + génération APIs
│   │   └── tester.ts         # Tests utilisateur Playwright
│   └── types.ts              # Types TypeScript
├── package.json
├── tsconfig.json
└── README.md
```

## 🎬 Workflow Complet

### Phase 0 : Check Mémoire
- Vérifie l'espace de travail `~/firebase-migrations/`
- Charge la base de données locale des projets
- Propose de continuer un projet existant
- Crée un nouveau projet si URL fournie

### Étape 1 : Clone et Analyse (2 min)
- Clone le repository dans l'espace organisé
- Détecte automatiquement les fichiers mock
- Extrait les modèles de données et types
- Analyse la structure de l'application
- Détecte les fonctionnalités (auth, CRUD, APIs)

### Étape 2 : Migration Base de Données (3 min)
- Installe et configure Prisma
- Génère le schéma depuis les modèles détectés
- Crée les migrations initiales
- Génère les routes API CRUD complètes
- Configure les variables d'environnement

### Étape 3 : Tests Utilisateur Réalistes (8 min)
- Démarre l'application en mode développement
- Configure Playwright pour les tests E2E
- Génère des scénarios de test personnalisés
- Teste comme un utilisateur réel :
  - Navigation complète
  - Formulaires et CRUD
  - Authentification
  - Gestion d'erreurs
- Génère un rapport de test détaillé

### Étape 4 : Finalisation (1 min)
- Crée des commits Git organisés
- Génère le rapport final de migration
- Met à jour la mémoire du projet
- Fournit les commandes pour la suite

## 🧪 Tests Utilisateur Générés

L'agent génère automatiquement des tests Playwright qui :

```typescript
// Exemple de test généré pour un modèle "Product"
test('CRUD Product', async ({ page }) => {
  // Navigation vers la section products
  await page.goto('http://localhost:3000');
  await page.click('text=Products');
  
  // Ajouter un nouveau produit
  await page.click('button:has-text("Add Product")');
  await page.fill('[name="name"]', 'Test Product');
  await page.fill('[name="price"]', '99.99');
  await page.click('button[type="submit"]');
  
  // Vérifier que le produit apparaît
  await expect(page.locator('text=Test Product')).toBeVisible();
});
```

## 💾 Mémoire Persistante

### Structure de la Mémoire
```json
{
  "name": "my-project",
  "url": "https://github.com/user/my-project",
  "path": "/home/user/firebase-migrations/my-project",
  "status": "completed",
  "currentStep": "finalization-complete",
  "lastActivity": "2024-01-15T10:30:00Z",
  "steps": [
    {
      "step": "analysis-complete",
      "details": { "mockFiles": 5, "dataModels": 3 },
      "timestamp": "2024-01-15T10:15:00Z",
      "duration": 120000
    }
  ]
}
```

### Commandes de Mémoire
```bash
# Voir tous les projets
firebase-app-builder

# Continuer un projet
firebase-app-builder continue my-project

# Nettoyage automatique des anciens projets (30+ jours)
```

## 🎯 Résultat Final

Après migration, vous obtenez :

- ✅ **Application Next.js** avec base de données réelle
- ✅ **PostgreSQL + Prisma** configurés et prêts
- ✅ **APIs CRUD complètes** pour tous vos modèles
- ✅ **Tests E2E Playwright** avec scénarios réalistes
- ✅ **Configuration production-ready**
- ✅ **Documentation complète** de la migration
- ✅ **Gestion Git** avec historique propre

## 🚀 Commandes Post-Migration

```bash
cd ~/firebase-migrations/my-project

# Démarrer l'application
npm run dev

# Interface base de données
npx prisma studio

# Lancer les tests
npm run test:e2e

# Nouvelle migration
npx prisma migrate dev
```

## 🔧 Configuration Requise

- **Node.js** 18+
- **PostgreSQL** (local ou distant)
- **Git** configuré
- **Playwright** (installé automatiquement)

## 🎉 Avantages

### Pour le Développeur
- **Gain de temps** : Migration automatique en 15 minutes
- **Mémoire** : Se souvient de tout, peut reprendre n'importe quand
- **Tests fiables** : Teste comme un utilisateur réel
- **Code propre** : APIs et base de données bien structurées

### Pour l'Équipe
- **Documentation** : Rapport complet de migration
- **Tests** : Suite de tests prête pour CI/CD
- **Production** : Configuration prête pour déploiement
- **Maintenabilité** : Code organisé et typé

## 🤖 Agent Intelligent

Cet agent agit comme un **vrai développeur senior** qui :
- 🧠 **Se souvient** de tous ses projets
- 📂 **Organise** son espace de travail
- 🔄 **Reprend** le travail où il s'est arrêté
- 🧪 **Teste** rigoureusement son code
- 📋 **Documente** tout ce qu'il fait
- 🎯 **Livre** un travail de qualité production

---

*Développé avec ❤️ par Claude Code - Agent MCP avec mémoire et tests réalistes*