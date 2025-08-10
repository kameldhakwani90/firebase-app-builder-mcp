'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess('Compte créé avec succès ! Vous recevez 5 crédits de bienvenue.');
        
        // Connexion automatique
        setTimeout(() => {
          localStorage.setItem('user', JSON.stringify(data.user));
          router.push('/dashboard');
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || 'Erreur lors de la création du compte');
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Formulaire d'inscription */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🚀 Rejoindre PRIXIGRAD.IO
            </CardTitle>
            <CardDescription className="text-lg">
              Solution SaaS d'analyse et transformation de projets
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Nom complet *
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email professionnel *
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="john@company.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium mb-2">
                  Entreprise
                </label>
                <Input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Mon Entreprise SAS"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-2">
                  Téléphone
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+33 6 12 34 56 78"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-green-600 text-sm bg-green-50 p-3 rounded">
                  {success}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? 'Création...' : 'Créer mon compte SaaS'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Déjà un compte ? {' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>

            {/* Offre de bienvenue */}
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-medium text-green-800 mb-2">🎁 Offre de lancement :</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>✅ <strong>5 crédits gratuits</strong> à l'inscription</li>
                <li>✅ <strong>1 analyse complète</strong> offerte</li>
                <li>✅ <strong>Accès à toutes les fonctionnalités</strong></li>
                <li>✅ <strong>Support par email</strong> inclus</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Tarification et avantages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              💎 Tarification & Crédits
            </CardTitle>
            <CardDescription>
              Payez seulement pour ce que vous utilisez
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Tarification par action */}
            <div>
              <h3 className="font-medium mb-3">🎯 Coût par action :</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm">📊 Analyse complète de projet</span>
                  <span className="font-medium text-blue-600">5 crédits</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">🔄 Transformation automatique</span>
                  <span className="font-medium text-gray-600">10 crédits</span>
                  <span className="text-xs text-gray-500">(Bientôt)</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">🤖 Génération de code IA</span>
                  <span className="font-medium text-gray-600">15 crédits</span>
                  <span className="text-xs text-gray-500">(Bientôt)</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm">📝 Audit de sécurité</span>
                  <span className="font-medium text-gray-600">8 crédits</span>
                  <span className="text-xs text-gray-500">(Bientôt)</span>
                </div>
              </div>
            </div>

            {/* Packs de crédits */}
            <div>
              <h3 className="font-medium mb-3">💰 Packs de crédits :</h3>
              <div className="space-y-2">
                <div className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Pack Starter</div>
                      <div className="text-sm text-muted-foreground">50 crédits</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">49€</div>
                      <div className="text-xs text-muted-foreground">0.98€/crédit</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-blue-800">Pack Pro ⭐</div>
                      <div className="text-sm text-blue-600">150 crédits + 20 bonus</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-800">129€</div>
                      <div className="text-xs text-blue-600">0.76€/crédit</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Pack Enterprise</div>
                      <div className="text-sm text-muted-foreground">500 crédits + 100 bonus</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">399€</div>
                      <div className="text-xs text-muted-foreground">0.67€/crédit</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Avantages */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-800 mb-2">🌟 Pourquoi PRIXIGRAD.IO ?</h3>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Analyse sur VOTRE machine (confidentialité totale)</li>
                <li>• Code source jamais transmis</li>
                <li>• Agent MCP intégré à Claude Code</li>
                <li>• Support Linux, macOS, Windows</li>
                <li>• Analyses spécialisées (IoT, SaaS, e-commerce)</li>
                <li>• Facturation à l'usage (pas d'abonnement)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}