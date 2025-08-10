'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  email: string;
  name: string;
  company?: string;
  credits: number;
  totalCredits: number;
  usedCredits: number;
}

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  price: number;
  pricePerCredit: number;
  popular?: boolean;
  description: string;
}

const creditPacks: CreditPack[] = [
  {
    id: 'starter',
    name: 'Pack Starter',
    credits: 50,
    bonusCredits: 0,
    price: 49,
    pricePerCredit: 0.98,
    description: 'Idéal pour découvrir la plateforme'
  },
  {
    id: 'pro',
    name: 'Pack Pro',
    credits: 150,
    bonusCredits: 20,
    price: 129,
    pricePerCredit: 0.76,
    popular: true,
    description: 'Parfait pour les équipes et projets réguliers'
  },
  {
    id: 'enterprise',
    name: 'Pack Enterprise',
    credits: 500,
    bonusCredits: 100,
    price: 399,
    pricePerCredit: 0.67,
    description: 'Pour les grandes équipes et usage intensif'
  }
];

const actionPrices = [
  { action: '📊 Analyse complète de projet', credits: 5, description: 'Analyse détaillée avec pages et rôles' },
  { action: '🔄 Transformation automatique', credits: 10, description: 'Génération de code et structure', coming: true },
  { action: '🤖 Génération de code IA', credits: 15, description: 'Code personnalisé avec IA avancée', coming: true },
  { action: '📝 Audit de sécurité', credits: 8, description: 'Scan complet de vulnérabilités', coming: true },
  { action: '🚀 Déploiement automatique', credits: 12, description: 'Deploy sur cloud avec config', coming: true }
];

export default function CreditsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));
  }, [router]);

  const handleBuyCredits = async (pack: CreditPack) => {
    setIsLoading(true);
    setSelectedPack(pack.id);

    try {
      // Pour l'instant, simulation d'achat (sans Stripe)
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          packId: pack.id,
          credits: pack.credits,
          bonusCredits: pack.bonusCredits,
          price: pack.price,
          simulate: true // Mode simulation pour le développement
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Mettre à jour l'utilisateur local
        const updatedUser = {
          ...user!,
          credits: data.newCredits,
          totalCredits: data.newTotalCredits
        };
        
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        alert(`✅ Achat simulé réussi ! Vous avez maintenant ${data.newCredits} crédits.`);
      } else {
        const error = await response.json();
        alert(`❌ Erreur: ${error.error}`);
      }
    } catch (error) {
      alert('❌ Erreur réseau lors de l\'achat');
    } finally {
      setIsLoading(false);
      setSelectedPack(null);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header avec infos utilisateur */}
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            💎 Achat de Crédits
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Rechargez votre compte pour continuer à utiliser PRIXIGRAD.IO
          </p>
          
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h2 className="font-semibold text-lg">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.company && (
                  <p className="text-sm text-muted-foreground">{user.company}</p>
                )}
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{user.credits}</div>
                    <div className="text-xs text-muted-foreground">Disponibles</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{user.totalCredits}</div>
                    <div className="text-xs text-muted-foreground">Total reçu</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{user.usedCredits}</div>
                    <div className="text-xs text-muted-foreground">Utilisés</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Packs de crédits */}
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-center">💰 Packs de Crédits</h2>
            
            <div className="space-y-4">
              {creditPacks.map((pack) => (
                <Card key={pack.id} className={`${pack.popular ? 'ring-2 ring-blue-500 bg-blue-50' : ''} relative`}>
                  {pack.popular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white">⭐ Le plus populaire</Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className={pack.popular ? 'text-blue-800' : ''}>{pack.name}</CardTitle>
                        <CardDescription>{pack.description}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${pack.popular ? 'text-blue-800' : ''}`}>
                          {pack.price}€
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {pack.pricePerCredit.toFixed(2)}€/crédit
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Crédits de base:</span>
                        <span className="font-semibold">{pack.credits} crédits</span>
                      </div>
                      
                      {pack.bonusCredits > 0 && (
                        <div className="flex items-center justify-between text-green-600">
                          <span>Crédits bonus:</span>
                          <span className="font-semibold">+{pack.bonusCredits} crédits</span>
                        </div>
                      )}
                      
                      <hr />
                      
                      <div className="flex items-center justify-between font-bold">
                        <span>Total:</span>
                        <span className="text-lg">{pack.credits + pack.bonusCredits} crédits</span>
                      </div>
                      
                      <Button 
                        className="w-full mt-4" 
                        variant={pack.popular ? 'default' : 'outline'}
                        disabled={isLoading}
                        onClick={() => handleBuyCredits(pack)}
                      >
                        {isLoading && selectedPack === pack.id ? (
                          'Achat en cours...'
                        ) : (
                          `Acheter ${pack.name}`
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Note développement */}
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Mode développement:</strong> Les achats sont simulés. 
                L'intégration Stripe sera ajoutée en production.
              </p>
            </div>
          </div>

          {/* Tarification par action */}
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-center">🎯 Coût par Action</h2>
            
            <div className="space-y-3">
              {actionPrices.map((item, index) => (
                <Card key={index} className={item.coming ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.action}</span>
                          {item.coming && (
                            <Badge variant="secondary" className="text-xs">Bientôt</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">
                          {item.credits} crédits
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ≈ {(item.credits * 0.76).toFixed(1)}€
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Calculateur */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">🧮 Calculateur d'usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Avec vos <strong>{user.credits} crédits</strong> actuels, vous pouvez faire :
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>• {Math.floor(user.credits / 5)} analyses complètes</div>
                    <div>• {Math.floor(user.credits / 10)} transformations</div>
                    <div>• {Math.floor(user.credits / 8)} audits sécurité</div>
                    <div>• {Math.floor(user.credits / 15)} générations IA</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Retour dashboard */}
            <div className="mt-6 text-center">
              <Button 
                variant="outline" 
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                ← Retour au Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}