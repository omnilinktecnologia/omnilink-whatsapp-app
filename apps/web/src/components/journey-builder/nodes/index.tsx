import { NodeProps } from '@xyflow/react'
import NodeBase from './NodeBase'
import {
  Play, Send, MessageSquare, Clock, GitBranch,
  Globe, Variable, Timer, Flag,
} from 'lucide-react'

export function StartNode({ data, selected }: NodeProps) {
  const d = data as any
  return (
    <NodeBase icon={Play} label={d?.label || 'Início'} color="bg-green-50 border-green-400" selected={selected} hasTarget={false}>
      <p className="text-xs text-green-600 ml-6">Ponto de entrada</p>
    </NodeBase>
  )
}

export function SendTemplateNode({ data, selected }: NodeProps) {
  const d = data as any
  const sublabel = d?.template_name ?? (d?.content_sid ? d.content_sid : 'Selecionar template...')
  return (
    <NodeBase icon={Send} label={d?.label || 'Enviar Template'} sublabel={sublabel} color="bg-blue-50 border-blue-300" selected={selected} />
  )
}

export function SendMessageNode({ data, selected }: NodeProps) {
  const d = data as any
  return (
    <NodeBase icon={MessageSquare} label={d?.label || 'Enviar Mensagem'} sublabel={d?.body ? `"${String(d.body).slice(0, 30)}..."` : 'Configurar texto...'} color="bg-indigo-50 border-indigo-300" selected={selected} />
  )
}

export function WaitForReplyNode({ data, selected }: NodeProps) {
  const d = data as any
  const timeout = d?.timeout_minutes ? `Timeout: ${d.timeout_minutes}min` : 'Sem timeout'
  return (
    <NodeBase icon={Clock} label={d?.label || 'Aguardar Resposta'} sublabel={timeout} color="bg-amber-50 border-amber-400" selected={selected} />
  )
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as any
  const branches = d?.branches ?? []
  return (
    <NodeBase
      icon={GitBranch} label={d?.label || 'Condição'}
      sublabel={`${branches.length} branch(es)`}
      color="bg-purple-50 border-purple-400"
      selected={selected}
      hasSource={false}
      extraHandles={[
        ...branches.map((b: any) => ({ id: b.id, label: b.label })),
        { id: 'default', label: 'Default' },
      ]}
    >
      {branches.slice(0, 2).map((b: any, i: number) => (
        <p key={i} className="text-xs text-purple-500 ml-6 truncate">{b.label || b.expression}</p>
      ))}
    </NodeBase>
  )
}

export function HttpRequestNode({ data, selected }: NodeProps) {
  const d = data as any
  return (
    <NodeBase icon={Globe} label={d?.label || 'HTTP Request'} sublabel={d?.url ? `${d.method ?? 'GET'} ${d.url}` : 'Configurar...'} color="bg-orange-50 border-orange-400" selected={selected} />
  )
}

export function SetVariablesNode({ data, selected }: NodeProps) {
  const d = data as any
  const count = d?.assignments?.length ?? 0
  return (
    <NodeBase icon={Variable} label={d?.label || 'Variáveis'} sublabel={`${count} atribuição(ões)`} color="bg-teal-50 border-teal-400" selected={selected} />
  )
}

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as any
  const sublabel = d?.amount ? `${d.amount} ${d.unit ?? 'minutes'}` : 'Configurar...'
  return (
    <NodeBase icon={Timer} label={d?.label || 'Delay'} sublabel={sublabel} color="bg-gray-50 border-gray-400" selected={selected} />
  )
}

export function EndNode({ data, selected }: NodeProps) {
  const d = data as any
  return (
    <NodeBase icon={Flag} label={d?.label || 'Fim'} color="bg-red-50 border-red-400" selected={selected} hasSource={false}>
      <p className="text-xs text-red-400 ml-6">Jornada concluída</p>
    </NodeBase>
  )
}

export const NODE_TYPES = {
  start:          StartNode,
  send_template:  SendTemplateNode,
  send_message:   SendMessageNode,
  wait_for_reply: WaitForReplyNode,
  condition:      ConditionNode,
  http_request:   HttpRequestNode,
  set_variables:  SetVariablesNode,
  delay:          DelayNode,
  end:            EndNode,
}
