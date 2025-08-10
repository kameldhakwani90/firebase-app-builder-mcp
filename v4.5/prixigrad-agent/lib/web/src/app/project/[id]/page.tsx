'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import { ScrollArea } from '../../../components/ui/scroll-area'
import { Input } from '../../../components/ui/input'
import ProjectTreeView from '../../../components/ProjectTreeView'
import FileDetailsView from '../../../components/FileDetailsView'
import { 
  FileText, 
  Database, 
  Shield, 
  Code, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Play,
  Eye,
  Edit3,
  TreePine,
  Settings,
  Bug
} from 'lucide-react'

interface ProjectDetails {
  id: string
  name: string
  path: string
  framework: string
  type: string
  pages: any[]
  apis: any[]
  issues: any[]
  mockData: any[]
  transformationPlan: any
  readyForTransformation: boolean
  analysis?: {
    type?: string
    pages?: any[]
    apis?: any[]
    mockData?: any[]
    database?: any
    transformationPlan?: any
  }
}

const API_BASE = 'http://localhost:3001'

interface FileNode {
  name: string
  type: 'file' | 'directory'
  status: 'ok' | 'warning' | 'error'
  issues?: string[]
  children?: FileNode[]
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = (params?.id as string) || ''
  
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [validations, setValidations] = useState<Record<string, any>>({})
  const [modifications, setModifications] = useState<Record<string, string>>({})
  const [realTimeErrors, setRealTimeErrors] = useState<any[]>([])
  const [treeSearchQuery, setTreeSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<any>(null)

  useEffect(() => {
    // Setup Server-Sent Events for real-time updates
    const eventSource = new EventSource(`${API_BASE}/api/events`)
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'transformation-error' || data.type === 'transformation-warning') {
        setRealTimeErrors(prev => [data, ...prev.slice(0, 49)])
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
    }

    // Load project details
    loadProjectDetails()

    return () => {
      eventSource.close()
    }
  }, [projectId])

  const loadProjectDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/api/projects/${projectId}`)
      
      if (!response.ok) {
        throw new Error('Projet non trouvé')
      }

      const data = await response.json()
      setProject(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const startTransformation = async () => {
    if (!project) return

    try {
      const response = await fetch(`${API_BASE}/api/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, validations, modifications })
      })

      if (!response.ok) {
        throw new Error('Erreur démarrage transformation')
      }

      // La transformation démarre, les updates viendront via Server-Sent Events
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur transformation')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const renderFileTree = (files: any, level = 0) => {
    return Object.entries(files).map(([name, info]: [string, any]) => (
      <div key={name} style={{ marginLeft: level * 20 }} className="py-1">
        <div className="flex items-center gap-2">
          {getStatusIcon(info.status || 'ok')}
          <span className="text-sm">{name}</span>
          {info.issues && info.issues.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {info.issues.length}
            </Badge>
          )}
        </div>
        {info.children && renderFileTree(info.children, level + 1)}
      </div>
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Erreur</h2>
          <p className="text-muted-foreground">{error || 'Projet non trouvé'}</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Retour
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.path}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge>{project.framework}</Badge>
              <Badge variant="outline">{project.analysis?.type || project.type}</Badge>
              <Badge variant={(project.issues?.length || 0) > 0 ? 'destructive' : 'default'}>
                {project.issues?.length || 0} problème(s)
              </Badge>
            </div>
          </div>
          <Button 
            onClick={startTransformation}
            disabled={!project.readyForTransformation}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Démarrer Transformation
          </Button>
        </div>

        {/* Erreurs temps réel */}
        {realTimeErrors.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Bug className="h-5 w-5" />
                Erreurs Temps Réel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {realTimeErrors.map((error, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <div className="text-xs text-gray-500 min-w-16">
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </div>
                      <div className={error.type === 'error' ? 'text-red-600' : 'text-yellow-600'}>
                        {error.message}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Onglets principaux */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="tree">Arborescence</TabsTrigger>
            <TabsTrigger value="pages">Fiches Pages</TabsTrigger>
            <TabsTrigger value="plan">Plan Transformation</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
          </TabsList>

          {/* Vue d'ensemble */}
          <TabsContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Pages & Composants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Pages détectées:</span>
                      <span className="font-semibold">{project.analysis?.pages?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>APIs mockées:</span>
                      <span className="font-semibold text-red-600">
                        {project.analysis?.apis?.filter(api => api.isMocked)?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Données hardcodées:</span>
                      <span className="font-semibold text-orange-600">
                        {project.analysis?.mockData?.length || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Base de Données
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Schéma Prisma:</span>
                      <span className={`font-semibold ${project.analysis?.database?.isEmpty ? 'text-red-600' : 'text-green-600'}`}>
                        {project.analysis?.database?.isEmpty ? 'Vide' : 'Présent'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Modèles à créer:</span>
                      <span className="font-semibold">
                        {project.analysis?.transformationPlan?.steps?.find((p: any) => p.title === 'Configuration Base de Données')?.estimatedTime || '30 minutes'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Sécurité
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Auth fonctionnelle:</span>
                      <span className="font-semibold text-red-600">Non</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Validation inputs:</span>
                      <span className="font-semibold text-red-600">Manquante</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Headers sécurisés:</span>
                      <span className="font-semibold text-red-600">Non</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Issues critiques */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Problèmes Détectés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(project.issues || []).map((issue, index) => (
                    <div key={index} className="border-l-4 border-red-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-red-700">{issue.message || issue}</h4>
                          <p className="text-sm text-gray-600">{issue.fix || 'Correction nécessaire'}</p>
                          {issue.file && (
                            <p className="text-xs text-gray-500">Fichier: {issue.file}</p>
                          )}
                        </div>
                        <Badge variant="destructive">{issue.severity || 'medium'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arborescence Interactive */}
          <TabsContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Arborescence */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TreePine className="h-5 w-5" />
                    Structure du Projet
                  </CardTitle>
                  <CardDescription>
                    Navigation interactive dans les fichiers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Barre de recherche */}
                  <div className="mb-4">
                    <Input
                      placeholder="🔍 Rechercher dans les fichiers..."
                      value={treeSearchQuery}
                      onChange={(e) => setTreeSearchQuery(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  
                  <ScrollArea className="h-96">
                    <ProjectTreeView 
                      project={project}
                      searchQuery={treeSearchQuery}
                      onFileSelect={(file) => setSelectedFile(file)}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Détails du fichier sélectionné */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Détails du Fichier
                  </CardTitle>
                  <CardDescription>
                    Analyse complète du fichier sélectionné
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {selectedFile ? (
                      <FileDetailsView file={selectedFile} />
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>Sélectionnez un fichier dans l'arborescence</p>
                        <p className="text-xs text-gray-400 mt-1">Cliquez sur un fichier pour voir ses détails</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fiches Pages */}
          <TabsContent className="space-y-4">
            {(project.analysis?.pages || []).map((page, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Page: {page.name}</span>
                    <div className="flex gap-2">
                      <Badge variant={page.hasAuth ? 'default' : 'destructive'}>
                        {page.hasAuth ? 'Protégée' : 'Non protégée'}
                      </Badge>
                      <Badge variant={page.usesStaticData ? 'destructive' : 'default'}>
                        {page.usesStaticData ? 'Données mockées' : 'Données dynamiques'}
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>{page.route}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">🧠 Analyse Automatique INTELLIGENTE:</h4>
                      <p className="text-sm text-gray-600 mb-3">{page.mainFunctionality || page.functionality}</p>
                      
                      {/* CONTEXTE MÉTIER */}
                      {page.businessContext && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                          <h5 className="font-medium text-sm text-purple-800 mb-1">🏢 Contexte Métier:</h5>
                          <p className="text-xs text-purple-700">{page.businessContext}</p>
                        </div>
                      )}

                      {/* COMPOSANTS DÉTECTÉS */}
                      {page.detectedComponents && page.detectedComponents.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">🧩 Composants Détectés:</h5>
                          <div className="space-y-2">
                            {page.detectedComponents.map((component: any, idx: number) => (
                              <div key={idx} className="bg-green-50 p-3 rounded-lg border-l-4 border-green-400">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-green-800">{component.name}</span>
                                  <Badge variant="outline" className="text-xs">{component.type}</Badge>
                                </div>
                                <p className="text-xs text-green-700 mb-1">{component.description}</p>
                                <p className="text-xs text-gray-600">{component.functionality}</p>
                                {component.userActions && (
                                  <div className="mt-1">
                                    <span className="text-xs font-medium">Actions: </span>
                                    <span className="text-xs text-gray-500">{component.userActions.join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* FONCTIONNALITÉS SPÉCIFIQUES */}
                      {page.specificFeatures && page.specificFeatures.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">⭐ Fonctionnalités Spécifiques:</h5>
                          <div className="space-y-2">
                            {page.specificFeatures.map((feature: any, idx: number) => (
                              <div key={idx} className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                                <h6 className="font-medium text-yellow-800 text-sm">{feature.feature}</h6>
                                <p className="text-xs text-yellow-700 mb-1">{feature.description}</p>
                                <div className="text-xs text-gray-600">
                                  <strong>Logique métier:</strong> {feature.businessLogic}
                                </div>
                                {feature.technicalRequirements && (
                                  <div className="mt-1">
                                    <span className="text-xs font-medium">Requis technique: </span>
                                    <span className="text-xs text-gray-500">{feature.technicalRequirements.join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* MODÈLES DE DONNÉES */}
                      {page.dataModels && page.dataModels.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">🗄️ Modèles de Données Détaillés:</h5>
                          <div className="space-y-2">
                            {page.dataModels.map((model: any, idx: number) => (
                              <div key={idx} className="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-400">
                                <h6 className="font-medium text-indigo-800 text-sm">{model.modelName}</h6>
                                {model.fields && (
                                  <div className="mt-2 space-y-1">
                                    {model.fields.map((field: any, fieldIdx: number) => (
                                      <div key={fieldIdx} className="text-xs">
                                        <span className="font-mono bg-indigo-100 px-1 rounded">{field.name}: {field.type}</span>
                                        <span className="text-gray-600 ml-2">{field.description}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {model.businessRules && (
                                  <div className="mt-2">
                                    <span className="text-xs font-medium">Règles métier: </span>
                                    <ul className="text-xs text-gray-600 list-disc list-inside">
                                      {model.businessRules.map((rule: string, ruleIdx: number) => (
                                        <li key={ruleIdx}>{rule}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ACTIONS BACKEND */}
                      {page.detectedActions && page.detectedActions.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">🎯 Actions Backend Détectées:</h5>
                          <div className="space-y-2">
                            {page.detectedActions?.map((action: any, idx: number) => (
                              <div key={idx} className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-blue-800">{action.action}</span>
                                  <Badge variant={action.status === 'exists' ? 'default' : action.status === 'missing' ? 'destructive' : 'secondary'}>
                                    {action.status === 'exists' ? '✅ Existe' : action.status === 'missing' ? '❌ Manquant' : '⚠️ Cassé'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-blue-700 mb-1">{action.description}</p>
                                <div className="text-xs">
                                  <span className="font-mono bg-blue-100 px-2 py-1 rounded">{action.apiNeeded}</span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">Modèle: {action.dataModel}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* COMPLEXITÉ CACHÉE */}
                      {page.hiddenComplexity && page.hiddenComplexity.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">⚠️ Complexité Cachée:</h5>
                          <div className="space-y-2">
                            {page.hiddenComplexity.map((complexity: any, idx: number) => (
                              <div key={idx} className="bg-red-50 p-3 rounded-lg border-l-4 border-red-400">
                                <h6 className="font-medium text-red-800 text-sm">{complexity.complexity}</h6>
                                <p className="text-xs text-red-700 mb-1">{complexity.description}</p>
                                <div className="text-xs text-gray-600 mb-1">
                                  <strong>Impact:</strong> {complexity.impact}
                                </div>
                                <div className="text-xs text-green-700">
                                  <strong>Solution:</strong> {complexity.solution}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {page.crudOperations && page.crudOperations.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">📋 Opérations CRUD:</h5>
                          <div className="flex gap-1">
                            {page.crudOperations.map((op: string) => (
                              <Badge key={op} variant="outline" className="text-xs">{op}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {page.dataEntities && page.dataEntities.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">🗄️ Entités de Données:</h5>
                          <div className="flex gap-1 flex-wrap">
                            {page.dataEntities.map((entity: string) => (
                              <Badge key={entity} variant="secondary" className="text-xs">{entity}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">🎯 Transformation Prévue:</h4>
                      <ul className="text-sm space-y-1">
                        {page.corrections && page.corrections.length > 0 ? (
                          page.corrections.map((correction: string, idx: number) => (
                            <li key={idx}>• {correction}</li>
                          ))
                        ) : page.transformationNeeded ? (
                          <>
                            <li>• Connecter aux APIs réelles</li>
                            <li>• Ajouter gestion d'erreurs</li>
                            <li>• Implémenter états de loading</li>
                          </>
                        ) : (
                          <li>• Page déjà fonctionnelle</li>
                        )}
                      </ul>
                      
                      {page.backendFunctions && page.backendFunctions.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-sm mb-2">⚙️ Fonctions Backend à Créer:</h5>
                          <div className="space-y-1">
                            {page.backendFunctions.map((func: any, idx: number) => (
                              <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                <span className="font-mono text-blue-600">{func.api}</span>
                                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                  func.status === 'exists' ? 'bg-green-100 text-green-700' : 
                                  func.status === 'missing' ? 'bg-red-100 text-red-700' : 
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {func.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">✏️ Modifications Utilisateur:</h4>
                      <textarea
                        className="w-full p-2 border rounded text-sm"
                        rows={3}
                        placeholder="Commentaires ou modifications pour cette page..."
                        value={modifications[page.name] || ''}
                        onChange={(e) => setModifications(prev => ({
                          ...prev,
                          [page.name]: e.target.value
                        }))}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant={validations[page.name] ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setValidations(prev => ({
                          ...prev,
                          [page.name]: !prev[page.name]
                        }))}
                      >
                        {validations[page.name] ? '✅ Validé' : '❌ À corriger'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Plan de transformation */}
          <TabsContent>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Plan de Transformation
                </CardTitle>
                <CardDescription>
                  Étapes détaillées de la transformation automatique
                </CardDescription>
              </CardHeader>
              <CardContent>
                {project.analysis?.transformationPlan?.steps && (
                  <div className="space-y-4">
                    {project.analysis.transformationPlan.steps.map((step: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{step.title}</h3>
                          <div className="flex gap-2">
                            <Badge variant="outline">{step.estimatedTime}</Badge>
                            <Badge variant={step.priority === 'high' ? 'destructive' : step.priority === 'medium' ? 'secondary' : 'outline'}>
                              {step.priority}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                        <div>
                          <h4 className="font-medium mb-2">Tâches:</h4>
                          <ul className="text-sm space-y-1">
                            {step.tasks.map((task: string, taskIndex: number) => (
                              <li key={taskIndex} className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {task}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Validation finale */}
          <TabsContent>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Validation & Modifications
                </CardTitle>
                <CardDescription>
                  Récapitulatif des validations avant transformation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4">📝 Récapitulatif Validations</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {Object.values(validations).filter(Boolean).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Pages validées</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {Object.values(modifications).filter(Boolean).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Modifications</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">J'ai vérifié toutes les fiches pages</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Le plan de transformation me convient</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Mes modifications sont intégrées</span>
                      </label>
                    </div>
                  </div>

                  <Button 
                    onClick={startTransformation}
                    className="w-full"
                    size="lg"
                  >
                    🚀 DÉMARRER TRANSFORMATION
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}