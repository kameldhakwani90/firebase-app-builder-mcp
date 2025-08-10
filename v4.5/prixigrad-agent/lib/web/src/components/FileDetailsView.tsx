'use client'

import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { 
  Code, 
  Database, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Zap,
  Users,
  ArrowRight
} from 'lucide-react'

interface FileDetailsViewProps {
  file: any
}

export default function FileDetailsView({ file }: FileDetailsViewProps) {
  if (!file) return null

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'tsx':
      case 'jsx':
        return <Code className="h-5 w-5 text-blue-400" />
      case 'ts':
      case 'js':
        return <FileText className="h-5 w-5 text-yellow-500" />
      case 'prisma':
        return <Database className="h-5 w-5 text-green-500" />
      case 'json':
        return <Settings className="h-5 w-5 text-orange-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tête du fichier */}
      <div className="border-b pb-4">
        <div className="flex items-center gap-3 mb-2">
          {getFileTypeIcon(file.fileType)}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{file.name}</h3>
            <p className="text-sm text-gray-500">{file.path}</p>
          </div>
          <Badge className={getStatusColor(file.status)}>
            {file.status === 'ok' ? '✅ OK' : 
             file.status === 'warning' ? '⚠️ Warning' : 
             file.status === 'error' ? '❌ Error' : 'Unknown'}
          </Badge>
        </div>
        
        {file.analysis?.functionality && (
          <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
            <h4 className="font-medium text-blue-800 text-sm mb-1">🎯 Fonctionnalité</h4>
            <p className="text-sm text-blue-700">{file.analysis.functionality}</p>
          </div>
        )}
      </div>

      {/* Issues */}
      {file.issues && file.issues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Problèmes Détectés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {file.issues.map((issue: string, index: number) => (
                <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded border-l-4 border-red-400">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <span className="text-sm text-red-700">{issue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyse pour les fichiers React/Next.js */}
      {file.analysis && file.fileType?.includes('tsx') && (
        <div className="space-y-4">
          {/* Composants */}
          {file.analysis.components && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Code className="h-4 w-4 text-blue-500" />
                  Composants React
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {file.analysis.components.map((component: string, index: number) => (
                    <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700">
                      {component}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hooks */}
          {file.analysis.hooks && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Hooks Utilisés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {file.analysis.hooks.map((hook: string, index: number) => (
                    <Badge key={index} variant="outline" className="bg-yellow-50 text-yellow-700">
                      {hook}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* APIs */}
          {file.analysis.apis && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRight className="h-4 w-4 text-green-500" />
                  APIs Utilisées
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {file.analysis.apis.map((api: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <ArrowRight className="h-3 w-3 text-green-500" />
                      <code className="text-sm font-mono text-green-700">{api}</code>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fonctionnalités spéciales */}
          {file.analysis.features && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4 text-purple-500" />
                  Fonctionnalités Spéciales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {file.analysis.features.map((feature: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                      <CheckCircle className="h-3 w-3 text-purple-500" />
                      <span className="text-sm text-purple-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complexité */}
          {file.analysis.complexity && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Niveau de Complexité
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`p-3 rounded-lg border-l-4 ${
                  file.analysis.complexity === 'Élevée' ? 'bg-red-50 border-red-400' :
                  file.analysis.complexity === 'Moyenne' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-green-50 border-green-400'
                }`}>
                  <span className={`font-medium ${
                    file.analysis.complexity === 'Élevée' ? 'text-red-800' :
                    file.analysis.complexity === 'Moyenne' ? 'text-yellow-800' :
                    'text-green-800'
                  }`}>
                    {file.analysis.complexity}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Analyse pour les APIs */}
      {file.analysis && file.path.includes('/api/') && (
        <div className="space-y-4">
          {/* Méthodes HTTP */}
          {file.analysis.methods && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                  Méthodes HTTP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {file.analysis.methods.map((method: string, index: number) => (
                    <Badge key={index} className={
                      method === 'GET' ? 'bg-green-100 text-green-800' :
                      method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                      method === 'DELETE' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {method}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Base de données */}
          {file.analysis.database && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-green-500" />
                  Base de Données
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                  <Database className="h-3 w-3 text-green-500" />
                  <span className="text-sm text-green-700">{file.analysis.database}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation */}
          {file.analysis.validation && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4 text-orange-500" />
                  Validation des Données
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`p-3 rounded-lg border-l-4 ${
                  file.analysis.validation === 'Manquante' ? 'bg-red-50 border-red-400' :
                  'bg-green-50 border-green-400'
                }`}>
                  <span className={`font-medium ${
                    file.analysis.validation === 'Manquante' ? 'text-red-800' : 'text-green-800'
                  }`}>
                    {file.analysis.validation}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Analyse pour Prisma */}
      {file.analysis && file.fileType === 'prisma' && (
        <div className="space-y-4">
          {/* Modèles */}
          {file.analysis.models && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-green-500" />
                  Modèles Définis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {file.analysis.models.map((model: string, index: number) => (
                    <Badge key={index} variant="outline" className="bg-green-50 text-green-700">
                      {model}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Relations */}
          {file.analysis.relationships && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                  Relations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {file.analysis.relationships.map((relation: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                      <ArrowRight className="h-3 w-3 text-blue-500" />
                      <code className="text-sm font-mono text-blue-700">{relation}</code>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Modèles manquants */}
          {file.analysis.missing && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Modèles Manquants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {file.analysis.missing.map((missing: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span className="text-sm text-red-700">{missing}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Informations générales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-gray-500" />
            Informations Générales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Type de fichier:</span>
              <span className="font-medium">{file.fileType || 'Inconnu'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Chemin complet:</span>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{file.path}</code>
            </div>
            {file.size && (
              <div className="flex justify-between">
                <span className="text-gray-600">Taille:</span>
                <span className="font-medium">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            )}
            {file.lastModified && (
              <div className="flex justify-between">
                <span className="text-gray-600">Dernière modification:</span>
                <span className="font-medium">{new Date(file.lastModified).toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}