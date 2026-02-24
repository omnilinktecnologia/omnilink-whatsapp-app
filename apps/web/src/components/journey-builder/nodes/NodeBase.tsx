import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface NodeBaseProps {
  icon: LucideIcon
  label: string
  sublabel?: string
  color?: string
  selected?: boolean
  children?: React.ReactNode
  hasSource?: boolean
  hasTarget?: boolean
  extraHandles?: Array<{ id: string; label: string; position?: 'left' | 'right' }>
}

export default function NodeBase({
  icon: Icon, label, sublabel, color = 'bg-white border-gray-200', selected,
  children, hasSource = true, hasTarget = true, extraHandles = [],
}: NodeBaseProps) {
  return (
    <div className={cn(
      'rounded-xl border-2 shadow-sm min-w-[200px] max-w-[240px] transition',
      color,
      selected && 'ring-2 ring-blue-400 ring-offset-1',
    )}>
      {hasTarget && <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />}

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={16} className="text-gray-600 flex-shrink-0" />
          <span className="font-semibold text-sm text-gray-800 leading-tight">{label}</span>
        </div>
        {sublabel && <p className="text-xs text-gray-500 ml-6 leading-snug truncate">{sublabel}</p>}
        {children}
      </div>

      {extraHandles.map(h => (
        <Handle
          key={h.id}
          type="source"
          id={h.id}
          position={Position.Bottom}
          style={{ left: `${20 + extraHandles.indexOf(h) * (60 / Math.max(extraHandles.length - 1, 1))}%` }}
          className="!bg-purple-400 !w-3 !h-3 !border-2 !border-white"
        />
      ))}

      {hasSource && extraHandles.length === 0 && (
        <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3 !border-2 !border-white" />
      )}
    </div>
  )
}
