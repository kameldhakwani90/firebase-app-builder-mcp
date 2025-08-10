import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🚀 API /projects appelée');
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      console.log('❌ userId manquant');
      return NextResponse.json(
        { error: 'userId requis' },
        { status: 400 }
      );
    }

    console.log('🔄 Appel bridge-server sur http://localhost:3002/api/projects');
    
    // Appel au bridge-server
    const response = await fetch(`http://localhost:3002/api/projects?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
    console.error('💥 ERREUR API /projects:', error);
    
    return NextResponse.json(
      { 
        error: 'Erreur interne serveur',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}