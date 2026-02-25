'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { flowResponsesApi, journeysApi, campaignsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import {
  ClipboardList, RefreshCw, ChevronDown, ChevronRight, Inbox, Trash2,
  BarChart2, List, PieChart, Copy, Check, Hash, Type, ToggleLeft,
  Calendar, Download, Layers, TrendingUp, Filter,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FlowResponse = {
  id: string
  contact_id: string | null
  execution_id: string | null
  journey_id: string | null
  campaign_id: string | null
  flow_id: string | null
  flow_token: string | null
  screen_id: string | null
  response_data: Record<string, unknown>
  received_at: string
  contacts?: { id: string; name: string | null; phone: string } | null
  journeys?: { id: string; name: string } | null
}

type CampaignStat = {
  campaign_id: string
  campaign_name: string
  total: number
  fields: Record<string, Record<string, number>>
}

type View = 'analytics' | 'list' | 'campaigns'

// ─────────────────────────────────────────────────────────────────────────────
// Interactive JSON Viewer
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  string:  { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'abc' },
  number:  { bg: 'bg-blue-50',    text: 'text-blue-700',    label: '123' },
  boolean: { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'T/F' },
  null:    { bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'null' },
  array:   { bg: 'bg-purple-50',  text: 'text-purple-700',  label: '[ ]' },
  object:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  label: '{ }' },
}

function getType(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
      title="Copiar valor"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const type = getType(value)
  const style = TYPE_STYLES[type] ?? TYPE_STYLES.null

  if (type === 'null') {
    return <span className="text-gray-400 italic text-xs">null</span>
  }

  if (type === 'string') {
    const str = value as string
    const isLong = str.length > 80
    return (
      <span className="text-emerald-700 text-xs break-all">
        {isLong ? `"${str.slice(0, 80)}..."` : `"${str}"`}
      </span>
    )
  }

  if (type === 'number') {
    return <span className="text-blue-700 font-mono text-xs font-medium">{String(value)}</span>
  }

  if (type === 'boolean') {
    return (
      <span className={`text-xs font-medium ${value ? 'text-green-600' : 'text-red-500'}`}>
        {String(value)}
      </span>
    )
  }

  if (type === 'array') {
    const arr = value as unknown[]
    if (arr.length === 0) return <span className="text-gray-400 text-xs">[ ] vazio</span>
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="font-mono">[{arr.length}]</span>
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-purple-100 pl-3">
            {arr.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] text-purple-400 font-mono mt-0.5 select-none">{i}</span>
                <JsonValue value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return <span className="text-gray-400 text-xs">{'{ }'} vazio</span>
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="font-mono">{'{'}...{'}'}</span>
          <span className="text-gray-400">{keys.length} campos</span>
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-indigo-100 pl-3">
            {keys.map(k => (
              <div key={k} className="flex items-start gap-2 group/row">
                <span className="text-[11px] text-indigo-500 font-mono font-medium mt-0.5 shrink-0">{k}:</span>
                <JsonValue value={obj[k]} depth={depth + 1} />
                <CopyButton text={typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : String(obj[k] ?? '')} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <span className="text-gray-600 text-xs">{String(value)}</span>
}

function InteractiveResponseViewer({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return <p className="text-xs text-gray-400 italic py-2">Sem campos na resposta</p>
  }

  return (
    <div className="space-y-2.5 py-2">
      {entries.map(([key, value]) => {
        const type = getType(value)
        const style = TYPE_STYLES[type] ?? TYPE_STYLES.null
        const copyStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')

        return (
          <div key={key} className="flex items-start gap-3 group/row">
            <div className="flex items-center gap-2 shrink-0 min-w-[140px]">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              <span className="text-sm font-mono font-semibold text-gray-800">{key}</span>
            </div>
            <div className="flex-1 min-w-0">
              <JsonValue value={value} />
            </div>
            <CopyButton text={copyStr} />
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// List View Row
// ─────────────────────────────────────────────────────────────────────────────

function ResponseRow({ r, onDelete }: { r: FlowResponse; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const fieldCount = Object.keys(r.response_data ?? {}).length

  return (
    <div className="border-b last:border-b-0">
      <div
        className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-gray-50/60 cursor-pointer transition"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">
              {r.contacts?.name ?? r.contacts?.phone ?? 'Contato desconhecido'}
            </span>
            {r.contacts?.phone && r.contacts.name && (
              <span className="text-xs text-gray-400 font-mono">{r.contacts.phone}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {r.journeys?.name && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {r.journeys.name}
              </span>
            )}
            {r.flow_id && (
              <span className="text-xs text-gray-400 font-mono">flow: {r.flow_id}</span>
            )}
            {r.screen_id && (
              <span className="text-xs text-gray-400">tela: {r.screen_id}</span>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 whitespace-nowrap">
          {fieldCount} {fieldCount === 1 ? 'campo' : 'campos'}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {formatDate(r.received_at)}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
          title="Remover"
        >
          <Trash2 size={13} />
        </button>
        <div className="text-gray-400">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-1 bg-gradient-to-b from-slate-50 to-white border-t border-gray-100">
          <InteractiveResponseViewer data={r.response_data ?? {}} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign Stats (existing, enhanced)
// ─────────────────────────────────────────────────────────────────────────────

function FieldBar({ label, count, max, total }: { label: string; count: number; max: number; total: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  const share = total > 0 ? ((count / total) * 100).toFixed(1) : '0'

  return (
    <div className="flex items-center gap-3 py-0.5">
      <div className="w-36 shrink-0 text-xs text-gray-700 font-medium truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 whitespace-nowrap w-20 text-right">
        {count} <span className="text-gray-400">({share}%)</span>
      </div>
    </div>
  )
}

function CampaignStatsCard({ stat }: { stat: CampaignStat }) {
  const [open, setOpen] = useState(true)
  const fields = Object.entries(stat.fields)

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/70 transition text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <span className="font-semibold text-gray-900">{stat.campaign_name}</span>
          <span className="ml-3 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {stat.total} resposta{stat.total !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>{fields.length} campo{fields.length !== 1 ? 's' : ''}</span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nenhum campo de resposta registrado.</p>
          ) : (
            fields.map(([fieldName, valueCounts]) => {
              const sorted = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])
              const total = sorted.reduce((s, [, c]) => s + c, 0)
              const maxCount = sorted[0]?.[1] ?? 1
              return (
                <div key={fieldName} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700 font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {fieldName}
                    </span>
                    <span className="text-xs text-gray-400">{total} resposta{total !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-gray-400">· {sorted.length} valor{sorted.length !== 1 ? 'es' : ''} único{sorted.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-0.5">
                    {sorted.map(([val, cnt]) => (
                      <FieldBar key={val} label={val} count={cnt} max={maxCount} total={total} />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics View — Analytical breakdown of responses
// ─────────────────────────────────────────────────────────────────────────────

interface FieldAnalysis {
  name: string
  fillRate: number
  totalFilled: number
  totalResponses: number
  uniqueValues: number
  isNumeric: boolean
  numericStats?: { min: number; max: number; avg: number; median: number; sum: number }
  topValues: Array<{ value: string; count: number; pct: number }>
  allValues: Record<string, number>
}

function analyzeFields(responses: FlowResponse[]): FieldAnalysis[] {
  if (responses.length === 0) return []
  const total = responses.length

  const fieldMap = new Map<string, unknown[]>()
  for (const r of responses) {
    for (const [k, v] of Object.entries(r.response_data ?? {})) {
      if (!fieldMap.has(k)) fieldMap.set(k, [])
      fieldMap.get(k)!.push(v)
    }
  }

  return Array.from(fieldMap.entries()).map(([name, values]) => {
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '')
    const uniqueMap: Record<string, number> = {}
    const nums: number[] = []

    for (const v of nonNull) {
      const str = typeof v === 'object' ? JSON.stringify(v) : String(v)
      uniqueMap[str] = (uniqueMap[str] ?? 0) + 1
      const n = Number(v)
      if (!isNaN(n) && typeof v !== 'boolean') nums.push(n)
    }

    const isNumeric = nums.length > nonNull.length * 0.7 && nums.length >= 2
    let numericStats: FieldAnalysis['numericStats']
    if (isNumeric && nums.length > 0) {
      const sorted = [...nums].sort((a, b) => a - b)
      numericStats = {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: +(nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2),
        median: sorted.length % 2 === 0
          ? +((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(2)
          : sorted[Math.floor(sorted.length / 2)],
        sum: +nums.reduce((s, n) => s + n, 0).toFixed(2),
      }
    }

    const topValues = Object.entries(uniqueMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count, pct: +(count / nonNull.length * 100).toFixed(1) }))

    return {
      name,
      fillRate: +(nonNull.length / total * 100).toFixed(1),
      totalFilled: nonNull.length,
      totalResponses: total,
      uniqueValues: Object.keys(uniqueMap).length,
      isNumeric,
      numericStats,
      topValues,
      allValues: uniqueMap,
    }
  }).sort((a, b) => b.totalFilled - a.totalFilled)
}

function NumericStatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="bg-white rounded-lg border px-3 py-2.5 text-center">
      <Icon size={13} className="mx-auto text-blue-400 mb-1" />
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

function FieldAnalysisCard({ field, index }: { field: FieldAnalysis; index: number }) {
  const [expanded, setExpanded] = useState(index < 4)
  const BAR_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500', 'bg-emerald-500']

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/70 transition text-left"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
            field.isNumeric ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {field.isNumeric ? <Hash size={14} /> : <Type size={14} />}
          </span>
          <div>
            <span className="font-semibold text-gray-900 font-mono text-sm">{field.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-gray-400">{field.uniqueValues} valor{field.uniqueValues !== 1 ? 'es' : ''} único{field.uniqueValues !== 1 ? 's' : ''}</span>
              <span className="text-[11px] text-gray-300">·</span>
              <span className="text-[11px] text-gray-400">{field.isNumeric ? 'numérico' : 'texto'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-gray-900">{field.fillRate}%</div>
            <div className="text-[10px] text-gray-400">preenchido</div>
          </div>
          <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${field.fillRate}%` }} />
          </div>
          {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-4">
          {/* Numeric stats */}
          {field.isNumeric && field.numericStats && (
            <div className="grid grid-cols-5 gap-2">
              <NumericStatCard label="Mínimo" value={field.numericStats.min} icon={TrendingUp} />
              <NumericStatCard label="Máximo" value={field.numericStats.max} icon={TrendingUp} />
              <NumericStatCard label="Média" value={field.numericStats.avg} icon={TrendingUp} />
              <NumericStatCard label="Mediana" value={field.numericStats.median} icon={TrendingUp} />
              <NumericStatCard label="Soma" value={field.numericStats.sum} icon={TrendingUp} />
            </div>
          )}

          {/* Value distribution */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Distribuição de valores</p>
            <div className="space-y-1.5">
              {field.topValues.map((tv, i) => {
                const maxPct = field.topValues[0]?.pct ?? 1
                const barW = maxPct > 0 ? (tv.pct / maxPct) * 100 : 0
                return (
                  <div key={tv.value} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 text-xs text-gray-700 font-medium truncate" title={tv.value}>
                      {tv.value || <span className="italic text-gray-400">(vazio)</span>}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-full h-5 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        style={{ width: `${barW}%`, minWidth: tv.count > 0 ? '8px' : '0' }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-gray-700">
                        {tv.count} ({tv.pct}%)
                      </span>
                    </div>
                  </div>
                )
              })}
              {field.uniqueValues > 10 && (
                <p className="text-[11px] text-gray-400 mt-1 italic">+ {field.uniqueValues - 10} outros valores</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CrossTabView({ responses, fields }: { responses: FlowResponse[]; fields: FieldAnalysis[] }) {
  const categoricalFields = fields.filter(f => !f.isNumeric && f.uniqueValues <= 20 && f.uniqueValues >= 2)
  const [fieldA, setFieldA] = useState(categoricalFields[0]?.name ?? '')
  const [fieldB, setFieldB] = useState(categoricalFields[1]?.name ?? '')

  if (categoricalFields.length < 2) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
        <Layers size={28} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm">Necessário pelo menos 2 campos categóricos (2-20 valores) para tabulação cruzada</p>
      </div>
    )
  }

  const rowVals = new Set<string>()
  const colVals = new Set<string>()
  const matrix: Record<string, Record<string, number>> = {}

  for (const r of responses) {
    const a = String(r.response_data?.[fieldA] ?? '')
    const b = String(r.response_data?.[fieldB] ?? '')
    if (!a || !b) continue
    rowVals.add(a)
    colVals.add(b)
    if (!matrix[a]) matrix[a] = {}
    matrix[a][b] = (matrix[a][b] ?? 0) + 1
  }

  const rows = Array.from(rowVals).sort()
  const cols = Array.from(colVals).sort()
  const maxCell = Math.max(1, ...rows.flatMap(r => cols.map(c => matrix[r]?.[c] ?? 0)))

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-gray-400" />
          <h4 className="font-semibold text-gray-900 text-sm">Tabulação Cruzada</h4>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <select value={fieldA} onChange={e => setFieldA(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
            {categoricalFields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
          <span className="text-gray-400 text-xs">vs</span>
          <select value={fieldB} onChange={e => setFieldB(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
            {categoricalFields.filter(f => f.name !== fieldA).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left font-mono text-gray-600 border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                {fieldA} \ {fieldB}
              </th>
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-center font-medium text-gray-600 min-w-[80px]">{c}</th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-gray-700 bg-gray-100">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => {
              const rowTotal = cols.reduce((s, c) => s + (matrix[r]?.[c] ?? 0), 0)
              return (
                <tr key={r} className="hover:bg-gray-50/60">
                  <td className="px-3 py-2 font-medium text-gray-800 border-r border-gray-200 sticky left-0 bg-white z-10">{r}</td>
                  {cols.map(c => {
                    const val = matrix[r]?.[c] ?? 0
                    const intensity = val > 0 ? Math.max(0.08, val / maxCell * 0.6) : 0
                    return (
                      <td key={c} className="px-3 py-2 text-center" style={{ backgroundColor: val > 0 ? `rgba(59, 130, 246, ${intensity})` : undefined }}>
                        {val > 0 ? <span className="font-semibold">{val}</span> : <span className="text-gray-300">-</span>}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center font-bold text-gray-700 bg-gray-50">{rowTotal}</td>
                </tr>
              )
            })}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 sticky left-0 bg-gray-100 z-10">Total</td>
              {cols.map(c => {
                const colTotal = rows.reduce((s, r) => s + (matrix[r]?.[c] ?? 0), 0)
                return <td key={c} className="px-3 py-2 text-center text-gray-700">{colTotal}</td>
              })}
              <td className="px-3 py-2 text-center text-gray-900 bg-gray-200">
                {rows.reduce((s, r) => s + cols.reduce((s2, c) => s2 + (matrix[r]?.[c] ?? 0), 0), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnalyticsView({ responses, loading }: { responses: FlowResponse[]; loading: boolean }) {
  const fields = useMemo(() => analyzeFields(responses), [responses])
  const uniqueContacts = useMemo(() => new Set(responses.map(r => r.contact_id).filter(Boolean)).size, [responses])
  const avgFields = useMemo(() => {
    if (responses.length === 0) return 0
    return +(responses.reduce((s, r) => s + Object.keys(r.response_data ?? {}).length, 0) / responses.length).toFixed(1)
  }, [responses])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (responses.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-14 text-center text-gray-400">
        <PieChart size={38} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-500">Sem respostas para analisar</p>
        <p className="text-sm mt-1">Selecione uma campanha ou jornada com respostas de flows.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Respostas', value: responses.length, icon: ClipboardList, color: 'bg-blue-50 text-blue-600' },
          { label: 'Contatos Únicos', value: uniqueContacts, icon: Filter, color: 'bg-purple-50 text-purple-600' },
          { label: 'Campos Detectados', value: fields.length, icon: Layers, color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Média Campos/Resp.', value: avgFields, icon: BarChart2, color: 'bg-emerald-50 text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon size={15} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{typeof s.value === 'number' ? s.value.toLocaleString('pt-BR') : s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Field-by-field analysis */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <PieChart size={14} className="text-gray-400" />
          Análise por Campo
        </h4>
        <div className="space-y-3">
          {fields.map((f, i) => <FieldAnalysisCard key={f.name} field={f} index={i} />)}
        </div>
      </div>

      {/* Cross-tab */}
      <CrossTabView responses={responses} fields={fields} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────────────────────────────

function exportCSV(responses: FlowResponse[]) {
  if (responses.length === 0) return
  const allKeys = new Set<string>()
  for (const r of responses) {
    for (const k of Object.keys(r.response_data ?? {})) allKeys.add(k)
  }
  const fields = Array.from(allKeys).sort()
  const header = ['contato', 'telefone', 'jornada', 'recebido_em', ...fields]
  const rows = responses.map(r => {
    const base = [
      r.contacts?.name ?? '',
      r.contacts?.phone ?? '',
      r.journeys?.name ?? '',
      r.received_at ?? '',
    ]
    const vals = fields.map(f => {
      const v = (r.response_data ?? {})[f]
      return typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
    })
    return [...base, ...vals]
  })

  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `respostas-flows-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function FlowResponsesPage() {
  const [view, setView] = useState<View>('analytics')

  // List view
  const [responses, setResponses] = useState<FlowResponse[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [filterJourney, setFilterJourney] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  // Campaign stats
  const [stats, setStats] = useState<CampaignStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [filterCampaign, setFilterCampaign] = useState('')

  // Analytics
  const [analyticsResponses, setAnalyticsResponses] = useState<FlowResponse[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsCampaign, setAnalyticsCampaign] = useState('')
  const [analyticsJourney, setAnalyticsJourney] = useState('')

  // Shared
  const [journeys, setJourneys] = useState<{ id: string; name: string }[]>([])
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    journeysApi.list().then((j: any[]) => setJourneys(j)).catch(() => {})
    campaignsApi.list().then((cs: any[]) => setCampaigns(cs)).catch(() => {})
  }, [])

  // List loader
  const loadList = useCallback(async (p = 1) => {
    setListLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, limit }
      if (filterJourney) params.journey_id = filterJourney
      const result = await flowResponsesApi.list(params)
      setResponses(result.data ?? [])
      setTotal(result.total ?? 0)
      setPage(p)
    } finally { setListLoading(false) }
  }, [filterJourney])

  // Campaign stats loader
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const result = await flowResponsesApi.campaignStats(filterCampaign || undefined)
      setStats(result.campaigns ?? [])
    } finally { setStatsLoading(false) }
  }, [filterCampaign])

  // Analytics loader — loads ALL responses for a campaign/journey to analyze
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, limit: 2000 }
      if (analyticsCampaign) params.campaign_id = analyticsCampaign
      if (analyticsJourney) params.journey_id = analyticsJourney
      const result = await flowResponsesApi.list(params)
      setAnalyticsResponses(result.data ?? [])
    } finally { setAnalyticsLoading(false) }
  }, [analyticsCampaign, analyticsJourney])

  useEffect(() => { if (view === 'list') loadList(1) }, [view, loadList])
  useEffect(() => { if (view === 'campaigns') loadStats() }, [view, loadStats])
  useEffect(() => { if (view === 'analytics') loadAnalytics() }, [view, loadAnalytics])

  async function handleDelete(id: string) {
    if (!confirm('Remover esta resposta?')) return
    await flowResponsesApi.delete(id)
    await loadList(page)
  }

  const totalPages = Math.ceil(total / limit)
  const isLoading = view === 'list' ? listLoading : view === 'campaigns' ? statsLoading : analyticsLoading
  const visibleStats = useMemo(
    () => filterCampaign ? stats.filter(s => s.campaign_id === filterCampaign) : stats,
    [stats, filterCampaign],
  )

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={22} className="text-blue-600" /> Respostas de Flows
          </h2>
          <p className="text-sm text-gray-500 mt-1">Formulários enviados via WhatsApp Flows</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
            {[
              { key: 'analytics' as View, label: 'Análise', icon: PieChart },
              { key: 'campaigns' as View, label: 'Por Campanha', icon: BarChart2 },
              { key: 'list' as View, label: 'Lista', icon: List },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  view === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>
          {view === 'analytics' && analyticsResponses.length > 0 && (
            <button
              onClick={() => exportCSV(analyticsResponses)}
              className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              <Download size={14} /> CSV
            </button>
          )}
          <button
            onClick={() => view === 'list' ? loadList(page) : view === 'campaigns' ? loadStats() : loadAnalytics()}
            disabled={isLoading}
            className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {/* ── Analytics view ── */}
      {view === 'analytics' && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <select value={analyticsCampaign} onChange={e => { setAnalyticsCampaign(e.target.value); setAnalyticsJourney('') }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas as campanhas</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={analyticsJourney} onChange={e => { setAnalyticsJourney(e.target.value); setAnalyticsCampaign('') }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas as jornadas</option>
              {journeys.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <AnalyticsView responses={analyticsResponses} loading={analyticsLoading} />
        </>
      )}

      {/* ── Campaign stats view ── */}
      {view === 'campaigns' && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas as campanhas</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {statsLoading ? (
            <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : visibleStats.length === 0 ? (
            <div className="bg-white rounded-xl border p-14 text-center text-gray-400">
              <BarChart2 size={38} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">Nenhum resultado por campanha</p>
              <p className="text-sm mt-1">Respostas agrupadas aparecem quando flows são preenchidos em campanhas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleStats.map(stat => <CampaignStatsCard key={stat.campaign_id} stat={stat} />)}
            </div>
          )}
        </>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <select value={filterJourney} onChange={e => setFilterJourney(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas as jornadas</option>
              {journeys.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            <span className="text-sm text-gray-500 ml-1">{total} resposta{total !== 1 ? 's' : ''}</span>
          </div>
          {listLoading ? (
            <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : responses.length === 0 ? (
            <div className="bg-white rounded-xl border p-14 text-center text-gray-400">
              <Inbox size={38} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">Nenhuma resposta encontrada</p>
              <p className="text-sm mt-1">Respostas aparecem quando um usuário preenche e envia um WhatsApp Flow.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span>Contato / Jornada</span>
                  <span>Campos</span>
                  <span>Recebido em</span>
                  <span></span>
                  <span></span>
                </div>
                <div>
                  {responses.map(r => (
                    <ResponseRow key={r.id} r={r} onDelete={() => handleDelete(r.id)} />
                  ))}
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>Página {page} de {totalPages} ({total} respostas)</span>
                  <div className="flex gap-2">
                    <button onClick={() => loadList(page - 1)} disabled={page <= 1}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">Anterior</button>
                    <button onClick={() => loadList(page + 1)} disabled={page >= totalPages}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">Próxima</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
