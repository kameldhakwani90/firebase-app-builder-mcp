'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  credits: number;
  totalCredits: number;
  usedCredits: number;
  isActive: boolean;
  createdAt: string;
  projects: any[];
  creditHistory: any[];
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalCreditsUsed: number;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserCredits, setNewUserCredits] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('clients');
  const router = useRouter();

  useEffect(() => {
    // Vérifier l'authentification Super Admin
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }

    setCurrentUser(parsedUser);
    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          name: newUserName.trim(),
          credits: parseInt(newUserCredits) || 5,
        }),
      });

      if (response.ok) {
        setNewUserEmail('');
        setNewUserName('');
        setNewUserCredits('5');
        fetchUsers(); // Recharger la liste
        alert('Client créé avec succès !');
      } else {
        const data = await response.json();
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      alert('Erreur réseau lors de la création');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCredits = async (userId: string, amount: number) => {
    if (amount <= 0) return;

    try {
      const response = await fetch(`/api/users/${userId}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          reason: `Ajout admin: ${amount} crédits`,
        }),
      });

      if (response.ok) {
        fetchUsers(); // Recharger
        alert(`${amount} crédits ajoutés avec succès !`);
      } else {
        const data = await response.json();
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      alert('Erreur lors de l\'ajout de crédits');
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/status`, {
        method: 'PUT',
      });

      if (response.ok) {
        fetchUsers();
        alert('Statut utilisateur modifié !');
      } else {
        const data = await response.json();
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      alert('Erreur lors du changement de statut');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('ATTENTION: Supprimer cet utilisateur supprimera aussi tous ses projets. Êtes-vous sûr ?')) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUsers();
        alert('Utilisateur supprimé !');
      } else {
        const data = await response.json();
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!currentUser) {
    return <div>Vérification des droits d'accès...</div>;
  }

  const clientUsers = users.filter(u => u.role === 'CLIENT');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-purple-600 bg-clip-text text-transparent">
              👑 Panneau Super Admin
            </h1>
            <p className="text-xl text-muted-foreground">
              Gestion des comptes clients PRIXIGRAD.IO
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="destructive" className="px-3 py-1">
              SUPER ADMIN
            </Badge>
            <Button variant="outline" onClick={handleLogout}>
              Déconnexion
            </Button>
          </div>
        </div>

        {/* Statistiques */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.totalUsers}</div>
                <div className="text-sm text-muted-foreground">Utilisateurs Total</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.activeUsers}</div>
                <div className="text-sm text-muted-foreground">Comptes Actifs</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.totalProjects}</div>
                <div className="text-sm text-muted-foreground">Projets Analysés</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.totalCreditsUsed}</div>
                <div className="text-sm text-muted-foreground">Crédits Consommés</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex border-b">
            <button
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'clients' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('clients')}
            >
              Gestion Clients ({clientUsers.length})
            </button>
            <button
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'new-client' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('new-client')}
            >
              Nouveau Client
            </button>
          </div>

          {/* Gestion des Clients */}
          {activeTab === 'clients' && (
            <Card>
              <CardHeader>
                <CardTitle>Liste des Clients</CardTitle>
                <CardDescription>
                  Gestion des comptes clients et de leurs crédits
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientUsers.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Aucun client créé. Créez votre premier client !
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientUsers.map((user) => (
                      <div key={user.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{user.name}</h3>
                              <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                {user.isActive ? 'Actif' : 'Inactif'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                              <div>
                                <div className="font-medium text-green-600">{user.credits}</div>
                                <div className="text-muted-foreground">Crédits restants</div>
                              </div>
                              <div>
                                <div className="font-medium text-orange-600">{user.usedCredits}</div>
                                <div className="text-muted-foreground">Crédits utilisés</div>
                              </div>
                              <div>
                                <div className="font-medium text-blue-600">{user.projects?.length || 0}</div>
                                <div className="text-muted-foreground">Projets</div>
                              </div>
                              <div>
                                <div className="font-medium text-purple-600">{user.totalCredits}</div>
                                <div className="text-muted-foreground">Total reçu</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 ml-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  const amount = prompt('Combien de crédits ajouter ?');
                                  if (amount && parseInt(amount) > 0) {
                                    handleAddCredits(user.id, parseInt(amount));
                                  }
                                }}
                              >
                                + Crédits
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleUserStatus(user.id)}
                              >
                                {user.isActive ? 'Désactiver' : 'Activer'}
                              </Button>
                            </div>
                            
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Création Nouveau Client */}
          {activeTab === 'new-client' && (
            <Card>
              <CardHeader>
                <CardTitle>Créer un Nouveau Client</CardTitle>
                <CardDescription>
                  Ajoutez un nouveau compte client au système SaaS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email *
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="client@example.com"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Nom complet *
                      </label>
                      <Input
                        id="name"
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Nom du client"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="credits" className="block text-sm font-medium mb-2">
                      Crédits initiaux
                    </label>
                    <Input
                      id="credits"
                      type="number"
                      min="0"
                      max="100"
                      value={newUserCredits}
                      onChange={(e) => setNewUserCredits(e.target.value)}
                      placeholder="5"
                      disabled={isLoading}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !newUserEmail.trim() || !newUserName.trim()}
                  >
                    {isLoading ? 'Création...' : 'Créer le Client'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}