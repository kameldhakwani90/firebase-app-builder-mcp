# 🎭 PRIXIGRAD.IO Agent

[![NPM Version](https://img.shields.io/npm/v/@prixigrad/agent)](https://www.npmjs.com/package/@prixigrad/agent)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg)](https://nodejs.org/)

**Transformateur d'applications Firebase Studio en applications complètes avec base de données PostgreSQL**

## 🚀 Installation

```bash
npm install -g @prixigrad/agent
```

## ⚡ Démarrage Rapide

```bash
# 1. Initialiser PRIXIGRAD.IO sur votre machine
prixigrad init

# 2. Lancer l'interface web
prixigrad start

# 3. Transformer une application Firebase
prixigrad transform https://github.com/kameldhakwani90/kalliky
```

## 🎯 Objectif

PRIXIGRAD.IO Agent transforme automatiquement vos applications Firebase Studio (avec données mockées) en applications complètes avec :

- **Base de données PostgreSQL** production-ready
- **APIs REST complètes** avec authentification
- **Interface frontend connectée** aux vraies données
- **Système d'administration** avec super admin
- **Déploiement automatisé** sur branche production

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/SSE    ┌──────────────────┐
│  Interface Web  │◄──────────────►│  BridgeServer    │
│  (Next.js)      │    Port 3001   │  (Express.js)    │
└─────────────────┘                └──────────────────┘
                                            │
                                            ▼ Integration  
                                   ┌──────────────────┐
                                   │  MCPOrchestrator │
                                   │  (Agent Manager) │
                                   └──────────────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                  │ Filesystem   │  │ Postgres     │  │ Prisma       │
                  │ MCP Agent    │  │ MCP Agent    │  │ MCP Agent    │
                  └──────────────┘  └──────────────┘  └──────────────┘
                          ▲                 ▲                 ▲
                  ┌──────────────┐  ┌──────────────┐
                  │ Sequential   │  │ Git          │  
                  │ Thinking MCP │  │ MCP Agent    │
                  └──────────────┘  └──────────────┘
```

## 🔄 Workflow de Transformation (8 Étapes)

### **Étape 1: Analyse Projet** 
- **Agent**: Filesystem MCP
- **Action**: Clone et analyse la structure du projet
- **Sortie**: Business model détecté, pages identifiées, données mockées cataloguées

### **Étape 2: Spécifications Techniques**
- **Agent**: Sequential Thinking MCP  
- **Action**: Génère les spécifications complètes
- **Sortie**: Modèles de données, APIs requises, architecture

### **Étape 3: Schéma Prisma**
- **Agent**: Prisma MCP
- **Action**: Génère schema.prisma avec toutes les relations
- **Sortie**: Fichier prisma/schema.prisma complet

### **Étape 4: Base de Données**
- **Agent**: PostgreSQL MCP
- **Action**: Crée la base PostgreSQL et exécute les migrations
- **Sortie**: Base de données opérationnelle

### **Étape 5: Super Admin & Seed**
- **Agent**: Prisma MCP
- **Action**: Crée le super administrateur et données de test
- **Sortie**: Compte admin + données démo

### **Étape 6: Backend APIs**
- **Agent**: Filesystem MCP
- **Action**: Génère toutes les APIs REST avec authentification
- **Sortie**: Backend complet fonctionnel

### **Étape 7: Frontend Connection**
- **Agent**: Filesystem MCP
- **Action**: Connecte les pages aux vraies APIs
- **Sortie**: Frontend connecté avec états de loading

### **Étape 8: Déploiement**
- **Agent**: Git MCP
- **Action**: Configure Docker et crée branche production
- **Sortie**: Branche `prod-auto` prête pour déploiement

## 🖥️ Interface Web

L'interface web permet de :

- **📊 Dashboard**: Suivi en temps réel des transformations
- **🔍 Analyse**: Visualisation des projets analysés  
- **⚙️ Configuration**: Gestion des paramètres système
- **📈 Historique**: Historique des transformations
- **🚀 Transformation**: Lance les pipelines de transformation

Accès : `http://localhost:3001` après `prixigrad start`

## 📋 Commandes disponibles

### `prixigrad init`
Initialise PRIXIGRAD.IO sur votre machine :
```bash
prixigrad init --force    # Réinstallation forcée
prixigrad init --verbose  # Affichage détaillé
```

### `prixigrad start`
Lance l'interface web et le serveur bridge :
```bash
prixigrad start                    # Port par défaut 3000
prixigrad start --port 8080        # Port personnalisé
prixigrad start --bridge-port 3001 # Port bridge personnalisé
prixigrad start --dev              # Mode développement
```

### `prixigrad transform`
Transforme une application Firebase :
```bash
prixigrad transform https://github.com/user/app
prixigrad transform https://github.com/user/app --token your-github-token
prixigrad transform https://github.com/user/app --branch production-ready
prixigrad transform https://github.com/user/app --skip-analysis
```

### `prixigrad status`
Vérifie le statut du système :
```bash
prixigrad status       # Vérification basique
prixigrad status --all # Vérification complète
```

### `prixigrad config`
Gestion de la configuration :
```bash
prixigrad config --show   # Affiche la configuration
prixigrad config --reset  # Remet à zéro
```

### `prixigrad logs`
Affiche les logs des transformations :
```bash
prixigrad logs           # 50 dernières lignes
prixigrad logs -n 100    # 100 dernières lignes  
prixigrad logs --follow  # Suivi temps réel
```

## 🔧 Prérequis Système

### Requis
- **Node.js** >= 18.0.0
- **NPM** >= 8.0.0
- **Git** >= 2.0.0
- **Claude Code** >= 1.0.0
- **PostgreSQL** >= 12.0

### Optionnel  
- **Docker** (pour déploiement)
- **GitHub Token** (pour repos privés)

## 🤖 Agents MCP Utilisés

PRIXIGRAD.IO Agent orchestre ces agents MCP externes :

- **[@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)** - Gestion fichiers
- **[@modelcontextprotocol/server-postgres](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)** - Base de données
- **[@modelcontextprotocol/server-sequential-thinking](https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking)** - Analyse intelligente  
- **[@modelcontextprotocol/server-git](https://github.com/modelcontextprotocol/servers/tree/main/src/git)** - Gestion Git
- **[prisma](https://prisma.io)** - ORM et migrations

## 🎯 Exemple Concret - Kalliky E-commerce

```bash
# Transformer l'application Kalliky
prixigrad transform https://github.com/kameldhakwani90/kalliky

# Résultat après transformation :
# ✅ Détection : E-commerce avec produits, panier, checkout
# ✅ Base données : User, Product, Category, Order, CartItem  
# ✅ APIs générées : 
#     - POST /api/auth/login
#     - GET /api/products
#     - POST /api/cart/add
#     - POST /api/orders
#     - GET /api/admin/dashboard
# ✅ Super admin créé : admin@kalliky.com / admin123
# ✅ Branche créée : prod-auto-kalliky
```

## 🧪 Tests et Validation

### Tests disponibles
```bash
# Test complet système (92% succès)
node test-suite-complete.js

# Test end-to-end avec projet réel
node test-kalliky-real.js

# Validation agents MCP
node test-real-mcp-agents.js

# Test intégration MCP
node test-integration-mcp.js
```

## 🐛 Troubleshooting

### Claude Code non trouvé
```bash
# Vérifier installation
claude --version

# Si non installé
curl -fsSL https://claude.ai/install.sh | sh
```

### PostgreSQL non disponible
```bash
# macOS avec Homebrew
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Agents MCP manquants
```bash
# Installer tous les agents MCP
prixigrad init --force

# Vérifier statut
prixigrad status --all
```

## 📚 API Documentation

### Endpoints principaux

#### `GET /api/projects`
Liste tous les projets analysés

#### `POST /api/analyze`
Analyse un nouveau projet GitHub
```json
{
  "github_url": "https://github.com/user/repo",
  "github_token": "optional"
}
```

#### `POST /api/transform`  
Lance la transformation d'un projet
```json
{
  "project_id": "project_123",
  "github_url": "https://github.com/user/repo"
}
```

#### `GET /api/events`
Server-Sent Events pour suivi temps réel

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

*🎭 PRIXIGRAD.IO Agent - Transformez vos maquettes Firebase en applications production-ready !*