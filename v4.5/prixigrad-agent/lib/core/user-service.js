/**
 * 🎭 PRIXIGRAD.IO - User Service
 * 
 * Service pour gérer les utilisateurs, crédits et système SaaS multi-tenant
 */

const { PrismaClient } = require('@prisma/client');
const Logger = require('./logger');

class UserService {
  constructor() {
    this.logger = new Logger('UserService');
    this.prisma = new PrismaClient();
  }

  /**
   * CRÉATION UTILISATEURS
   */
  async createSuperAdmin(email = 'admin@prixigrad.io', name = 'Super Admin') {
    try {
      const existingAdmin = await this.prisma.user.findFirst({
        where: { role: 'SUPER_ADMIN' }
      });

      if (existingAdmin) {
        this.logger.info('👑 Super Admin existe déjà');
        return existingAdmin;
      }

      const superAdmin = await this.prisma.user.create({
        data: {
          email,
          name,
          role: 'SUPER_ADMIN',
          credits: 999999, // Crédits illimités pour le super admin
          totalCredits: 999999,
          isActive: true
        }
      });

      this.logger.success(`👑 Super Admin créé: ${superAdmin.email}`);
      return superAdmin;
    } catch (error) {
      this.logger.error('Erreur création super admin', error);
      throw error;
    }
  }

  async createClient(email, name, initialCredits = 5) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw new Error(`Utilisateur ${email} existe déjà`);
      }

      // Transaction pour créer utilisateur + historique crédits
      const user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name,
            role: 'CLIENT',
            credits: initialCredits,
            totalCredits: initialCredits,
            isActive: true
          }
        });

        // Ajouter l'historique des crédits initiaux
        await tx.creditHistory.create({
          data: {
            userId: newUser.id,
            type: 'BONUS',
            amount: initialCredits,
            reason: 'Crédits de bienvenue'
          }
        });

        return newUser;
      });

      this.logger.success(`👤 Client créé: ${user.email} (${initialCredits} crédits)`);
      return user;
    } catch (error) {
      this.logger.error('Erreur création client', error);
      throw error;
    }
  }

  /**
   * GESTION DES CRÉDITS
   */
  async useCredits(userId, amount, reason = 'Project analysis', projectId = null) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          throw new Error('Utilisateur introuvable');
        }

        if (user.credits < amount) {
          throw new Error(`Crédits insuffisants (${user.credits}/${amount})`);
        }

        // Débiter les crédits
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            credits: { decrement: amount },
            usedCredits: { increment: amount }
          }
        });

        // Historique
        await tx.creditHistory.create({
          data: {
            userId,
            type: 'USED',
            amount: -amount,
            reason,
            projectId
          }
        });

        this.logger.info(`💳 ${amount} crédit(s) utilisé(s) pour ${user.email}`);
        return updatedUser;
      });
    } catch (error) {
      this.logger.error('Erreur utilisation crédits', error);
      throw error;
    }
  }

  async addCredits(userId, amount, reason = 'Purchase') {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            credits: { increment: amount },
            totalCredits: { increment: amount }
          }
        });

        // Historique
        await tx.creditHistory.create({
          data: {
            userId,
            type: 'PURCHASED',
            amount,
            reason
          }
        });

        this.logger.success(`💰 ${amount} crédit(s) ajouté(s) pour ${updatedUser.email}`);
        return updatedUser;
      });
    } catch (error) {
      this.logger.error('Erreur ajout crédits', error);
      throw error;
    }
  }

  /**
   * VÉRIFICATIONS
   */
  async canCreateProject(userId) {
    const user = await this.getUserById(userId);
    
    if (!user) return false;
    if (!user.isActive) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    
    return user.credits >= 5; // 5 crédits = 1 analyse complète
  }

  async checkAndConsumeCreditsForProject(userId, projectCost = 5) {
    const canCreate = await this.canCreateProject(userId);
    
    if (!canCreate) {
      const user = await this.getUserById(userId);
      throw new Error(`Impossible de créer le projet. Crédits: ${user?.credits || 0}, Requis: ${projectCost}`);
    }

    // Si c'est un super admin, pas de débit
    const user = await this.getUserById(userId);
    if (user.role === 'SUPER_ADMIN') {
      return user;
    }

    // Débiter les crédits
    return await this.useCredits(userId, projectCost, 'Analyse de projet');
  }

  /**
   * RÉCUPÉRATION DONNÉES
   */
  async getUserById(id) {
    return await this.prisma.user.findUnique({
      where: { id },
      include: {
        creditHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        projects: true
      }
    });
  }

  async getUserByEmail(email) {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        creditHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        projects: true
      }
    });
  }

  async getAllClients() {
    return await this.prisma.user.findMany({
      where: { role: 'CLIENT' },
      include: {
        projects: true,
        creditHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getUserStats() {
    const totalUsers = await this.prisma.user.count();
    const activeUsers = await this.prisma.user.count({ where: { isActive: true } });
    const totalProjects = await this.prisma.project.count();
    const totalCreditsUsed = await this.prisma.creditHistory.aggregate({
      where: { type: 'USED' },
      _sum: { amount: true }
    });

    return {
      totalUsers,
      activeUsers,
      totalProjects,
      totalCreditsUsed: Math.abs(totalCreditsUsed._sum.amount || 0)
    };
  }

  /**
   * ADMINISTRATION
   */
  async toggleUserStatus(userId) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    return await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive }
    });
  }

  async deleteUser(userId) {
    // Les projets seront supprimés automatiquement (onDelete: Cascade)
    return await this.prisma.user.delete({
      where: { id: userId }
    });
  }

  /**
   * CLEAN UP
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = UserService;