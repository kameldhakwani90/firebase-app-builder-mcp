'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Vérifier si un utilisateur est connecté
    const userData = localStorage.getItem('user');
    
    if (userData) {
      const user = JSON.parse(userData);
      // Rediriger selon le rôle
      if (user.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } else {
      // Pas d'utilisateur connecté, aller à la page de connexion
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🎭</div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          PRIXIGRAD.IO
        </h1>
        <p className="text-muted-foreground">Redirection en cours...</p>
      </div>
    </div>
  );
}