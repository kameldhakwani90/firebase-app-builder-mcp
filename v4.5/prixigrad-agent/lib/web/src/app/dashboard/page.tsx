'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  credits: number;
  totalCredits: number;
  usedCredits: number;
}

interface Project {
  id: string;
  name: string;
  githubUrl: string;
  status: string;
  type?: string;
  framework?: string;
  createdAt: string;
  creditsCost: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // Récupérer les infos utilisateur du localStorage
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    
    // Charger les projets de l'utilisateur
    fetchUserProjects(parsedUser.id);
  }, [router]);

  const fetchUserProjects = async (userId: string) => {
    try {
      const response = await fetch(`/api/projects?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Erreur chargement projets:', error);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !githubUrl.trim()) return;

    if (user.credits < 5) {
      alert('Crédits insuffisants ! Il vous faut 5 crédits pour une analyse complète.');
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysisModal(true);
    setAnalysisStatus('Démarrage de l\'analyse...');
    setRealTimeStatus('🚀 Initialisation...');
    setAnalysisProgress(0);

    // Simulation de progression simple
    const progressSteps = [
      { progress: 20, message: '🔍 Clonage du repository...' },
      { progress: 40, message: '🧠 Analyse du code avec Claude MCP...' },
      { progress: 60, message: '📊 Génération des fiches pages...' },
      { progress: 80, message: '🎯 Finalisation de l\'analyse...' },
      { progress: 100, message: '✅ Analyse terminée !' }
    ];
    
    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < progressSteps.length) {
        const step = progressSteps[currentStep];
        setRealTimeStatus(step.message);
        setAnalysisProgress(step.progress);
        currentStep++;
      }
    }, 3000); // Changement toutes les 3 secondes

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          github_url: githubUrl,
          user_id: user.id,
          business_description: projectDescription,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Attendre que la progression se termine
        setTimeout(() => {
          clearInterval(progressInterval);
          setRealTimeStatus('✅ Analyse terminée !');
          setAnalysisProgress(100);
          
          // Fermer le modal et recharger les projets
          setTimeout(() => {
            setShowAnalysisModal(false);
            setIsAnalyzing(false);
            
            // Recharger les projets et les crédits utilisateur
            fetchUserProjects(user.id);
            
            // Mettre à jour les crédits utilisateur
            const updatedUser = { ...user, credits: user.credits - 5, usedCredits: user.usedCredits + 5 };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            setGithubUrl('');
            setProjectDescription('');
            setAnalysisStatus('Projet ajouté avec succès !');
            
            setTimeout(() => setAnalysisStatus(''), 3000);
          }, 2000);
        }, 15000); // Total: 15 secondes pour l'animation
      } else {
        const data = await response.json();
        clearInterval(progressInterval);
        setRealTimeStatus(`❌ Erreur: ${data.error}`);
        setTimeout(() => setShowAnalysisModal(false), 3000);
      }
    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      clearInterval(progressInterval);
      setRealTimeStatus('❌ Erreur réseau lors de l\'analyse');
      setTimeout(() => setShowAnalysisModal(false), 3000);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user || !confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}?userId=${user.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Recharger les projets
        fetchUserProjects(user.id);
        
        // Mettre à jour les crédits (remboursement)
        const updatedUser = { ...user, credits: user.credits + 5, usedCredits: user.usedCredits - 5 };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        alert('Projet supprimé et crédit remboursé !');
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

  if (!user) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🎭 Dashboard Client
            </h1>
            <p className="text-xl text-muted-foreground">
              Bienvenue {user.name}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Crédits disponibles</div>
              <div className="text-2xl font-bold text-green-600">{user.credits}</div>
            </div>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => router.push('/credits')}
              className="flex items-center gap-1"
            >
              💎 Acheter
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Déconnexion
            </Button>
          </div>
        </div>

        {/* Nouveau Projet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ➕ Analyser un nouveau projet
            </CardTitle>
            <CardDescription>
              Coût: 1 crédit par analyse • Crédits restants: {user.credits}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="space-y-3">
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  disabled={isAnalyzing || user.credits < 5}
                  className="w-full"
                />
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Description détaillée du projet (optionnel mais recommandé pour une meilleure analyse)..."
                  disabled={isAnalyzing || user.credits < 5}
                  className="w-full min-h-[100px] p-3 border border-input rounded-md resize-none bg-background text-sm"
                />
              </div>
              <Button 
                type="submit" 
                disabled={isAnalyzing || user.credits < 5 || !githubUrl.trim()}
                className="w-full"
              >
                {isAnalyzing ? 'Analyse...' : 'Analyser'}
              </Button>
              
              {analysisStatus && (
                <div className={`text-sm p-3 rounded ${
                  analysisStatus.includes('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}>
                  {analysisStatus}
                </div>
              )}
              
              {user.credits < 5 && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded flex justify-between items-center">
                  <span>⚠️ Crédits insuffisants (5 crédits requis pour l'analyse)</span>
                  <Button 
                    size="sm" 
                    onClick={() => router.push('/credits')}
                    className="ml-2"
                  >
                    Acheter des crédits
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Liste des Projets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📁 Mes Projets ({projects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Aucun projet analysé. Commencez par analyser votre premier projet !
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{project.name}</h3>
                        <Badge variant={
                          project.status === 'analyzed' ? 'default' : 
                          project.status === 'analyzing' ? 'secondary' : 'destructive'
                        }>
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{project.githubUrl}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        {project.type && <span>Type: {project.type}</span>}
                        {project.framework && <span>Framework: {project.framework}</span>}
                        <span>Coût: {project.creditsCost} crédits</span>
                        <span>Créé: {new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {project.status === 'analyzed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/project/${project.id}`)}
                        >
                          Voir
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-blue-600">{projects.length}</div>
              <div className="text-xs text-muted-foreground">Projets Total</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-green-600">{user.credits}</div>
              <div className="text-xs text-muted-foreground">Crédits Restants</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-orange-600">{user.usedCredits}</div>
              <div className="text-xs text-muted-foreground">Crédits Utilisés</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-purple-600">{user.totalCredits}</div>
              <div className="text-xs text-muted-foreground">Total Reçu</div>
            </CardContent>
          </Card>
        </div>

        {/* Modal de chargement avec feedback temps réel */}
        {showAnalysisModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
              <div className="text-center">
                <div className="mb-6">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
                </div>
                
                <h3 className="text-xl font-semibold mb-4">Analyse en cours</h3>
                
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${analysisProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">{analysisProgress}%</div>
                </div>
                
                <div className="text-lg mb-4">{realTimeStatus}</div>
                
                <div className="text-sm text-gray-500">
                  🔬 Claude Code MCP analyse votre projet...<br/>
                  ⏱️ Temps estimé: 30-60 secondes
                </div>
                
                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAnalysisModal(false);
                      setIsAnalyzing(false);
                    }}
                  >
                    Continuer en arrière-plan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}