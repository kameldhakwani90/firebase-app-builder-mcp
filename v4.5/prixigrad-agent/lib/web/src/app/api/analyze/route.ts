import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🚀 API /analyze appelée');
  
  try {
    const body = await request.json();
    console.log('📥 Body reçu:', body);
    
    const { github_url, user_id, business_description } = body;
    
    if (!github_url || !user_id) {
      console.log('❌ Paramètres manquants:', { github_url: !!github_url, user_id: !!user_id });
      return NextResponse.json(
        { error: 'github_url et user_id requis' },
        { status: 400 }
      );
    }

    console.log('🔄 Appel bridge-server sur http://localhost:3002/api/analyze');
    
    // Appel au bridge-server
    const response = await fetch('http://localhost:3002/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ github_url, user_id, business_description }),
    });

    console.log('📡 Réponse bridge-server status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Erreur bridge-server:', errorText);
      throw new Error(`Bridge server error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Résultat bridge-server:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('💥 ERREUR API /analyze:', error);
    
    return NextResponse.json(
      { 
        error: 'Erreur interne serveur',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}