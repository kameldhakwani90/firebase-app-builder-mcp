/**
 * Service d'authentification et inscription SaaS
 */

class AuthService {
  constructor(database, userService) {
    this.database = database;
    this.userService = userService;
  }

  /**
   * Inscription d'un nouveau client
   */
  async signUp(userData) {
    try {
      // Vérifier si l'email existe déjà
      const existingUser = await this.database.prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        throw new Error('Un compte existe déjà avec cet email');
      }

      // Créer le nouveau client avec 5 crédits de bienvenue
      const newUser = await this.database.prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          company: userData.company || null,
          phone: userData.phone || null,
          role: 'CLIENT',
          credits: 5, // Crédits de bienvenue
          totalCredits: 5,
          usedCredits: 0,
          isActive: true
        }
      });

      // Enregistrer l'historique des crédits de bienvenue
      await this.database.prisma.creditHistory.create({
        data: {
          userId: newUser.id,
          type: 'BONUS',
          amount: 5,
          reason: 'Crédits de bienvenue à l\'inscription',
          createdAt: new Date()
        }
      });

      console.log(`✅ Nouveau client créé: ${newUser.name} (${newUser.email}) - 5 crédits offerts`);

      // Retourner l'utilisateur (sans informations sensibles)
      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        company: newUser.company,
        phone: newUser.phone,
        role: newUser.role,
        credits: newUser.credits,
        totalCredits: newUser.totalCredits,
        usedCredits: newUser.usedCredits,
        createdAt: newUser.createdAt
      };

    } catch (error) {
      console.error('❌ Erreur inscription:', error);
      throw error;
    }
  }

  /**
   * Connexion simple par email (pour SaaS)
   */
  async signIn(email) {
    try {
      const user = await this.database.prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        throw new Error('Aucun compte trouvé avec cet email');
      }

      if (!user.isActive) {
        throw new Error('Compte désactivé. Contactez le support.');
      }

      // Mettre à jour la dernière connexion
      await this.database.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
        phone: user.phone,
        role: user.role,
        credits: user.credits,
        totalCredits: user.totalCredits,
        usedCredits: user.usedCredits,
        createdAt: user.createdAt
      };

    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      throw error;
    }
  }
}

module.exports = AuthService;