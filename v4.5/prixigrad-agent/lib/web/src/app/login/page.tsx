'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Stocker les infos utilisateur
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Rediriger selon le rôle
        if (data.user.role === 'SUPER_ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Erreur de connexion');
      }
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  };

  // Comptes de test rapide
  const quickLogin = (testEmail: string) => {
    setEmail(testEmail);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🎭 PRIXIGRAD.IO
          </CardTitle>
          <CardDescription className="text-lg">
            Connexion au système SaaS multi-tenant
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Comptes de test disponibles :
            </p>
            
            <div className="space-y-2">
              <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 font-medium mb-2">🆕 Nouveau client ?</p>
                <Link href="/signup">
                  <Button className="w-full" size="sm">
                    Créer un compte gratuit (5 crédits offerts)
                  </Button>
                </Link>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full text-left justify-start"
                onClick={() => quickLogin('kamel@prixigrad.io')}
              >
                👑 <strong className="ml-2">Super Admin</strong>
                <span className="ml-auto text-muted-foreground">kamel@prixigrad.io</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-left justify-start"
                onClick={() => quickLogin('kamel.dhakwani@gmail.com')}
              >
                👤 <strong className="ml-2">Kamel</strong>
                <span className="ml-auto text-muted-foreground">10 crédits</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-left justify-start"
                onClick={() => quickLogin('femme.kamel@gmail.com')}
              >
                👤 <strong className="ml-2">Épouse Kamel</strong>
                <span className="ml-auto text-muted-foreground">5 crédits</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-left justify-start"
                onClick={() => quickLogin('test@example.com')}
              >
                👤 <strong className="ml-2">Utilisateur Test</strong>
                <span className="ml-auto text-muted-foreground">3 crédits</span>
              </Button>
            </div>
          </div>

          {/* Instructions d'installation agent MCP */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm font-medium mb-3 text-center">
              🚀 Solution SaaS - Agent MCP requis
            </p>
            
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <p className="text-sm text-blue-800 font-medium">
                📋 Installation sur votre machine :
              </p>
              
              <div className="space-y-2">
                <div className="bg-white p-2 rounded text-xs">
                  <p className="font-medium mb-1">🐧 Linux / 🍎 macOS :</p>
                  <code className="bg-gray-100 px-2 py-1 rounded block">
                    curl -sSL https://install.prixigrad.io/install.sh | bash
                  </code>
                </div>
                
                <div className="bg-white p-2 rounded text-xs">
                  <p className="font-medium mb-1">🪟 Windows :</p>
                  <code className="bg-gray-100 px-2 py-1 rounded block">
                    powershell -c "irm https://install.prixigrad.io/install.ps1 | iex"
                  </code>
                </div>
              </div>
              
              <div className="text-xs text-blue-700 space-y-1">
                <p>✅ <strong>Installation automatique :</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-0">
                  <li>Agent MCP PRIXIGRAD dans Claude Code</li>
                  <li>Token client unique (auto-généré)</li>
                  <li>Configuration SSL sécurisée</li>
                  <li>Synchronisation temps réel avec SaaS</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                <p className="text-xs text-yellow-800">
                  ⚡ <strong>Après installation :</strong> L'agent communique automatiquement avec notre SaaS. 
                  Vos analyses sont sécurisées et chiffrées.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panneau d'information système */}
      <div className="absolute top-4 right-4">
        <Card className="w-80">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              🏢 Architecture SaaS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="text-sm">
                  <p className="font-medium">Serveur SaaS Central</p>
                  <p className="text-muted-foreground text-xs">Multi-tenant • HA • Sécurisé</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="text-sm">
                  <p className="font-medium">Agents MCP Clients</p>
                  <p className="text-muted-foreground text-xs">Claude Code • Local • Chiffré</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <div className="text-sm">
                  <p className="font-medium">API Gateway</p>
                  <p className="text-muted-foreground text-xs">Token-based • Rate limiting</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-2 bg-gray-50 rounded text-xs">
              <p className="font-medium mb-1">💡 Avantages :</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• Analyses sur votre machine (confidentialité)</li>
                <li>• Pas de code source transmis</li>
                <li>• Facturation à l'usage</li>
                <li>• Support multi-OS</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}