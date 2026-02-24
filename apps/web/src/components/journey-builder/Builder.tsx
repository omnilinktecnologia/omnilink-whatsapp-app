'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type OnConnect, type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NODE_TYPES } from './nodes'
import NodeConfigPanel from './NodeConfigPanel'
import { journeysApi } from '@/lib/api'
import type { JourneyNode } from '@omnilink/shared'
import {
  Send, MessageSquare, Clock, GitBranch, Globe,
  Variable, Timer, Flag, Save, Rocket,
  type LucideIcon,
} from 'lucide-react'

const BLOCK_PALETTE: { type: string; icon: LucideIcon; label: string; color: string }[] = [
  { type: 'send_template',  icon: Send,          label: 'Enviar Template',   color: 'border-blue-300 bg-blue-50' },
  { type: 'send_message',   icon: MessageSquare, label: 'Enviar Mensagem',   color: 'border-indigo-300 bg-indigo-50' },
  { type: 'wait_for_reply', icon: Clock,         label: 'Aguardar Resposta', color: 'border-amber-400 bg-amber-50' },
  { type: 'condition',      icon: GitBranch,     label: 'Condição',          color: 'border-purple-400 bg-purple-50' },
  { type: 'http_request',   icon: Globe,         label: 'HTTP Request',      color: 'border-orange-400 bg-orange-50' },
  { type: 'set_variables',  icon: Variable,      label: 'Variáveis',         color: 'border-teal-400 bg-teal-50' },
  { type: 'delay',          icon: Timer,         label: 'Delay',             color: 'border-gray-400 bg-gray-50' },
  { type: 'end',            icon: Flag,          label: 'Fim',               color: 'border-red-400 bg-red-50' },
]

interface BuilderProps {
  journeyId: string
  journeyName: string
  initialGraph?: { nodes: Node[]; edges: Edge[] }
  onStatusChange?: () => void
}

export default function Builder({ journeyId, journeyName, initialGraph, onStatusChange }: BuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph?.nodes ?? [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph?.edges ?? [])
  const [selectedNode, setSelectedNode] = useState<JourneyNode | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)

  // Initialize with a Start node if empty
  useEffect(() => {
    if (nodes.length === 0) {
      setNodes([{
        id: 'start-1',
        type: 'start',
        position: { x: 300, y: 80 },
        data: { label: 'Início' },
      }])
    }
  }, [])

  const onConnect: OnConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, animated: false }, eds))
  }, [setEdges])

  function onNodeClick(_: React.MouseEvent, node: Node) {
    setSelectedNode(node as unknown as JourneyNode)
  }

  function onPaneClick() {
    setSelectedNode(null)
  }

  function updateNodeData(nodeId: string, data: Record<string, unknown>) {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data } : n))
    scheduleAutosave()
  }

  function scheduleAutosave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(), 2000)
  }

  async function save() {
    setSaving(true)
    try {
      await journeysApi.saveGraph(journeyId, { nodes, edges })
      setLastSaved(new Date().toLocaleTimeString('pt-BR'))
    } catch (e) {
      console.error('Save failed', e)
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    await save()
    setPublishing(true)
    try {
      await journeysApi.publish(journeyId)
      onStatusChange?.()
      alert('Jornada publicada com sucesso!')
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  function addNode(type: string) {
    const id = `${type}-${Date.now()}`
    const center = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      : { x: 300, y: 300 }

    const newNode: Node = {
      id,
      type,
      position: { x: center.x - 100 + Math.random() * 40 - 20, y: center.y + Math.random() * 40 - 20 },
      data: getDefaultData(type),
    }
    setNodes(nds => [...nds, newNode])
    scheduleAutosave()
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/node-type')
    if (!type || !reactFlowInstance) return

    const bounds = reactFlowWrapper.current?.getBoundingClientRect()
    const pos = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    })

    const id = `${type}-${Date.now()}`
    setNodes(nds => [...nds, { id, type, position: pos, data: getDefaultData(type) }])
    scheduleAutosave()
  }

  function onDragOver(event: React.DragEvent) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="flex h-full">
      {/* Block Palette */}
      <div className="w-52 bg-white border-r flex flex-col">
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Blocos</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {BLOCK_PALETTE.map((block) => (
            <div
              key={block.type}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-grab text-sm font-medium transition hover:shadow-md ${block.color}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/node-type', block.type)}
              onClick={() => addNode(block.type)}
            >
              <block.icon size={14} className="text-gray-500 flex-shrink-0" />
              <span className="text-gray-700 text-xs">{block.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
        {/* Toolbar */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {lastSaved && <span className="text-xs text-gray-400">Salvo às {lastSaved}</span>}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50 shadow-sm">
            <Save size={12} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={publish} disabled={publishing}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            <Rocket size={12} /> {publishing ? 'Publicando...' : 'Publicar'}
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => { onNodesChange(changes); scheduleAutosave() }}
          onEdgesChange={(changes) => { onEdgesChange(changes); scheduleAutosave() }}
          onConnect={(params) => { onConnect(params); scheduleAutosave() }}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={setReactFlowInstance}
          nodeTypes={NODE_TYPES}
          fitView
          deleteKeyCode="Delete"
        >
          <Background gap={20} size={1} color="#e5e7eb" />
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable className="!bg-white !border-gray-200" />
        </ReactFlow>
      </div>

      {/* Config Panel */}
      {selectedNode && (
        <div className="w-80 bg-white border-l shadow-lg overflow-hidden flex flex-col">
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={(id, data) => {
              updateNodeData(id, data)
              setSelectedNode(prev => prev?.id === id ? { ...prev, data: data as any } : prev)
            }}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  )
}

function getDefaultData(type: string): Record<string, unknown> {
  switch (type) {
    case 'condition': return { branches: [], default_node_id: '' }
    case 'http_request': return { method: 'GET', url: '', headers: {}, response_mapping: [] }
    case 'set_variables': return { assignments: [] }
    case 'delay': return { amount: 1, unit: 'minutes' }
    case 'wait_for_reply': return { timeout_minutes: 0 }
    case 'send_template': return { content_sid: '', content_variables: {} }
    case 'send_message': return { body: '' }
    default: return {}
  }
}
