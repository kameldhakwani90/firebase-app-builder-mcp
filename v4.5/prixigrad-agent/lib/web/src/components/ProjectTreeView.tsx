'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, File, FileText, Code, Database, Settings, Image, FileQuestion } from 'lucide-react'
import { Badge } from './ui/badge'

interface FileNode {
  name: string
  type: 'file' | 'directory'
  path: string
  status?: 'ok' | 'warning' | 'error'
  issues?: string[]
  children?: FileNode[]
  size?: number
  lastModified?: string
  fileType?: string
  analysis?: any
}

interface ProjectTreeViewProps {
  project: any
  searchQuery: string
  onFileSelect: (file: FileNode) => void
}

export default function ProjectTreeView({ project, searchQuery, onFileSelect }: ProjectTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['/', '/src', '/src/app']))

  // Construire la structure de fichiers depuis les données réelles du projet
  const buildFileStructure = (): FileNode | null => {
    if (!project?.analysis?.structure) {
      return {
        name: project?.name || 'Projet',
        type: 'directory',
        path: '/',
        children: [
          {
            name: 'En cours d\'analyse...',
            type: 'file',
            path: '/analyzing',
            status: 'warning',
            fileType: 'txt'
          }
        ]
      }
    }

    // Créer une structure basée sur les pages et composants détectés
    const structure = project.analysis.structure
    const children: FileNode[] = []

    // Ajouter les pages
    if (structure.pages) {
      const pagesDir: FileNode = {
        name: 'pages',
        type: 'directory',
        path: '/pages',
        children: structure.pages.map((page: any) => ({
          name: page.name + '.js',
          type: 'file' as const,
          path: page.path || `/pages/${page.name}.js`,
          status: 'ok' as const,
          fileType: 'js',
          analysis: page
        }))
      }
      children.push(pagesDir)
    }

    // Ajouter les composants
    if (structure.components) {
      const componentsDir: FileNode = {
        name: 'components',
        type: 'directory',
        path: '/components',
        children: structure.components.map((comp: any) => ({
          name: comp.name + '.js',
          type: 'file' as const,
          path: comp.path || `/components/${comp.name}.js`,
          status: 'ok' as const,
          fileType: 'js',
          analysis: comp
        }))
      }
      children.push(componentsDir)
    }

    return {
      name: project.name || 'Projet',
      type: 'directory',
      path: '/',
      children
    }
  }

  const fileStructure = buildFileStructure()

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedNodes(newExpanded)
  }

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return expandedNodes.has(node.path) ? 
        <FolderOpen className="h-4 w-4 text-blue-500" /> : 
        <Folder className="h-4 w-4 text-blue-500" />
    }

    // Icônes par type de fichier
    switch (node.fileType) {
      case 'tsx':
      case 'jsx':
        return <Code className="h-4 w-4 text-blue-400" />
      case 'ts':
      case 'js':
        return <FileText className="h-4 w-4 text-yellow-500" />
      case 'prisma':
        return <Database className="h-4 w-4 text-green-500" />
      case 'json':
        return <Settings className="h-4 w-4 text-orange-500" />
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <Image className="h-4 w-4 text-purple-500" />
      default:
        return <File className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ok':
        return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">✅ OK</Badge>
      case 'warning':
        return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">⚠️ Warning</Badge>
      case 'error':
        return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">❌ Error</Badge>
      default:
        return null
    }
  }

  const filterNodes = (node: FileNode): FileNode | null => {
    if (!searchQuery) return node

    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         node.path.toLowerCase().includes(searchQuery.toLowerCase())

    if (node.type === 'file') {
      return matchesSearch ? node : null
    }

    // Pour les dossiers, on filtre récursivement
    const filteredChildren = node.children?.map(child => filterNodes(child)).filter(Boolean) || []
    
    if (matchesSearch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren as FileNode[]
      }
    }

    return null
  }

  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.path)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.path}>
        <div 
          className={`flex items-center gap-2 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer ${
            level > 0 ? `ml-${level * 4}` : ''
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpanded(node.path)
            } else {
              onFileSelect(node)
            }
          }}
        >
          {hasChildren && (
            <button onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(node.path)
            }}>
              {isExpanded ? 
                <ChevronDown className="h-3 w-3 text-gray-500" /> : 
                <ChevronRight className="h-3 w-3 text-gray-500" />
              }
            </button>
          )}
          
          {!hasChildren && <div className="w-3" />}
          
          {getFileIcon(node)}
          
          <span className="text-sm font-medium flex-1">{node.name}</span>
          
          {getStatusBadge(node.status)}
          
          {node.issues && node.issues.length > 0 && (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
              {node.issues.length}
            </Badge>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children?.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const filteredTree = fileStructure ? filterNodes(fileStructure) : null

  return (
    <div className="space-y-1">
      {filteredTree ? renderNode(filteredTree) : (
        <div className="text-center text-gray-500 py-4">
          <FileQuestion className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Aucun fichier trouvé</p>
        </div>
      )}
    </div>
  )
}