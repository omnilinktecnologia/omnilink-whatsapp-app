'use client'

import { useEffect, useRef, useState } from 'react'
import { templatesApi, sendersApi } from '@/lib/api'
import type { JourneyNode } from '@omnilink/shared'
import { X, Plus, Trash2 } from 'lucide-react'

// ── Variable helpers ──────────────────────────────────────────────────────────

const QUICK_VARS = [
  '{{contact.name}}',
  '{{contact.phone}}',
  '{{contact.email}}',
  '{{last_reply.body}}',
  '{{campaign.name}}',
]

/** Inserts text at the cursor of a textarea or input element. */
function insertAtCursor(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  current: string,
  snippet: string,
  setValue: (v: string) => void,
) {
  const start = el?.selectionStart ?? current.length
  const end = el?.selectionEnd ?? current.length
  const next = current.slice(0, start) + snippet + current.slice(end)
  setValue(next)
  setTimeout(() => {
    el?.focus()
    el?.setSelectionRange(start + snippet.length, start + snippet.length)
  }, 0)
}

// ── Custom {{variables.x}} inline picker ─────────────────────────────────────

function CustomVarPicker({ onInsert }: { onInsert: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function confirm() {
    if (name.trim()) onInsert(`{{variables.${name.trim()}}}`)
    setName('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="text-xs text-gray-400 hover:text-blue-600 px-2 py-0.5 rounded-full border border-dashed border-gray-300 hover:border-blue-400 font-mono transition"
      >
        + {'{'}{'{'}{'}}'} variável
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
      <span className="text-xs text-blue-500 font-mono">{'{'}{'{'} variables.</span>
      <input
        ref={inputRef}
        className="text-xs w-20 bg-transparent border-none outline-none text-blue-700 font-mono"
        placeholder="nome"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') confirm()
          if (e.key === 'Escape') { setOpen(false); setName('') }
        }}
      />
      <span className="text-xs text-blue-500 font-mono">{'}}' }</span>
      <button
        type="button"
        onClick={confirm}
        className="text-xs text-blue-600 font-semibold hover:text-blue-800 ml-0.5"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setName('') }}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  )
}

// ── Variable chips bar ────────────────────────────────────────────────────────

function VarChips({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5 items-center">
      <span className="text-xs text-gray-400 mr-0.5">Inserir:</span>
      {QUICK_VARS.map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100 border border-blue-100 transition"
        >
          {v}
        </button>
      ))}
      <CustomVarPicker onInsert={onInsert} />
    </div>
  )
}

// ── VarTextarea: textarea + chips ─────────────────────────────────────────────

interface VarTextareaProps {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  className?: string
}

function VarTextarea({ value, onChange, rows = 3, placeholder, className }: VarTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <div>
      <textarea
        ref={ref}
        className={className ?? inp}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <VarChips onInsert={s => insertAtCursor(ref.current, value, s, onChange)} />
    </div>
  )
}

// ── VarInput: input + chips ───────────────────────────────────────────────────

interface VarInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

function VarInput({ value, onChange, placeholder, className }: VarInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <input
        ref={ref}
        className={className ?? inp}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <VarChips onInsert={s => insertAtCursor(ref.current, value, s, onChange)} />
    </div>
  )
}

// ── Content variables row (extracted to avoid hooks in map) ───────────────────

function ContentVarRow({
  varKey, value, onChange, onRemove,
}: { varKey: string; value: string; onChange: (v: string) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
          {varKey}
        </div>
        <input
          ref={ref}
          className={inp + ' flex-1'}
          placeholder="{{contact.name}}"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 flex-shrink-0 p-1">
          <Trash2 size={13} />
        </button>
      </div>
      <VarChips onInsert={s => insertAtCursor(ref.current, value, s, onChange)} />
    </div>
  )
}

// ── Content variables editor ──────────────────────────────────────────────────

function ContentVarsEditor({
  value,
  onChange,
}: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const entries = Object.entries(value ?? {}).sort(([a], [b]) => parseInt(a) - parseInt(b))

  function setEntry(key: string, val: string) {
    onChange({ ...(value ?? {}), [key]: val })
  }

  function removeEntry(key: string) {
    const next = { ...(value ?? {}) }
    delete next[key]
    // Re-index remaining keys
    const reindexed: Record<string, string> = {}
    Object.values(next).forEach((v, i) => { reindexed[String(i + 1)] = v })
    onChange(reindexed)
  }

  function addEntry() {
    const nextKey = String(entries.length + 1)
    onChange({ ...(value ?? {}), [nextKey]: '' })
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => (
        <ContentVarRow
          key={key}
          varKey={key}
          value={val}
          onChange={v => setEntry(key, v)}
          onRemove={() => removeEntry(key)}
        />
      ))}
      <button
        type="button"
        onClick={addEntry}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        <Plus size={12} /> Variável {entries.length + 1}
      </button>
      {entries.length === 0 && (
        <p className="text-xs text-gray-400 italic">O template não possui variáveis, ou clique para adicionar.</p>
      )}
    </div>
  )
}

// ── HTTP Headers editor ───────────────────────────────────────────────────────

function HeadersEditor({
  value,
  onChange,
}: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const entries = Object.entries(value ?? {})

  function setKey(i: number, newKey: string) {
    const next: Record<string, string> = {}
    entries.forEach(([k, v], j) => { next[j === i ? newKey : k] = v })
    onChange(next)
  }

  function setVal(i: number, newVal: string) {
    const next: Record<string, string> = {}
    entries.forEach(([k, v], j) => { next[k] = j === i ? newVal : v })
    onChange(next)
  }

  function remove(i: number) {
    const next: Record<string, string> = {}
    entries.filter((_, j) => j !== i).forEach(([k, v]) => { next[k] = v })
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className="w-32 flex-shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Authorization"
            value={k}
            onChange={e => setKey(i, e.target.value)}
          />
          <input
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Bearer {{variables.token}}"
            value={v}
            onChange={e => setVal(i, e.target.value)}
          />
          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...(value ?? {}), '': '' })}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        <Plus size={12} /> Adicionar header
      </button>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const lbl = 'block text-xs font-medium text-gray-600 mb-1'

const NODE_TYPE_LABELS: Record<string, string> = {
  start: 'Início', send_template: 'Enviar Template', send_message: 'Enviar Mensagem',
  wait_for_reply: 'Aguardar Resposta', condition: 'Condição', http_request: 'HTTP Request',
  set_variables: 'Variáveis', delay: 'Delay', end: 'Fim',
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  node: JourneyNode
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}

export default function NodeConfigPanel({ node, onUpdate, onClose }: Props) {
  const [templates, setTemplates] = useState<any[]>([])
  const [senders, setSenders] = useState<any[]>([])
  const [data, setData] = useState<Record<string, unknown>>(node.data as Record<string, unknown>)

  useEffect(() => {
    setData(node.data as Record<string, unknown>)
    if (['send_template', 'send_message'].includes(node.type)) {
      templatesApi.list().then(r => setTemplates(r.filter((t: any) => t.content_sid))).catch(() => {})
      sendersApi.list().then(setSenders).catch(() => {})
    }
  }, [node.id, node.type])

  function patch(updates: Record<string, unknown>) {
    const next = { ...data, ...updates }
    setData(next)
    onUpdate(node.id, next)
  }

  function patchBranch(i: number, updates: object) {
    const branches = [...((data.branches as any[]) ?? [])]
    branches[i] = { ...branches[i], ...updates }
    patch({ branches })
  }

  function addBranch() {
    const branches = [...((data.branches as any[]) ?? [])]
    branches.push({ id: `branch_${Date.now()}`, label: 'Branch ' + (branches.length + 1), expression: '', next_node_id: '' })
    patch({ branches })
  }

  function removeBranch(i: number) {
    const branches = [...((data.branches as any[]) ?? [])]
    branches.splice(i, 1)
    patch({ branches })
  }

  function patchAssignment(i: number, updates: object) {
    const assignments = [...((data.assignments as any[]) ?? [])]
    assignments[i] = { ...assignments[i], ...updates }
    patch({ assignments })
  }

  function patchMapping(i: number, updates: object) {
    const mappings = [...((data.response_mapping as any[]) ?? [])]
    mappings[i] = { ...mappings[i], ...updates }
    patch({ response_mapping: mappings })
  }

  const contentVars = (data.content_variables ?? {}) as Record<string, string>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 flex-shrink-0">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">{NODE_TYPE_LABELS[node.type] ?? node.type}</p>
          <h3 className="font-semibold text-gray-900 text-sm leading-tight mt-0.5">
            {(data.label as string) || NODE_TYPE_LABELS[node.type] || node.type}
          </h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-200">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* COMMON: block name */}
        <div>
          <label className={lbl}>Nome do bloco</label>
          <input
            className={inp}
            placeholder={NODE_TYPE_LABELS[node.type] ?? node.type}
            value={(data.label as string) ?? ''}
            onChange={e => patch({ label: e.target.value })}
          />
        </div>

        {/* ── SEND TEMPLATE ──────────────────────────────────────── */}
        {node.type === 'send_template' && (
          <>
            <div>
              <label className={lbl}>Template</label>
              <select
                className={inp}
                value={(data.content_sid as string) ?? ''}
                onChange={e => {
                  const tpl = templates.find(t => t.content_sid === e.target.value)
                  patch({
                    content_sid: e.target.value,
                    template_id: tpl?.id,
                    template_name: tpl ? (tpl.friendly_name || tpl.name) : undefined,
                  })
                }}
              >
                <option value="">Selecionar...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.content_sid}>
                    {t.friendly_name || t.name}
                    {t.approval_status ? ` [${t.approval_status}]` : ''}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="text-xs text-amber-500 mt-1">Nenhum template com ContentSid. Importe na aba Templates.</p>
              )}
            </div>

            <div>
              <label className={lbl}>Variáveis do template</label>
              <p className="text-xs text-gray-400 mb-2">
                Cada número corresponde a {'{{1}}'}, {'{{2}}'}… no corpo do template.
              </p>
              <ContentVarsEditor
                value={contentVars}
                onChange={v => patch({ content_variables: v })}
              />
            </div>

            <div>
              <label className={lbl}>Sender (opcional, sobrescreve padrão)</label>
              <select
                className={inp}
                value={(data.sender_id as string) ?? ''}
                onChange={e => patch({ sender_id: e.target.value || undefined })}
              >
                <option value="">Usar sender padrão da jornada</option>
                {senders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </>
        )}

        {/* ── SEND MESSAGE ───────────────────────────────────────── */}
        {node.type === 'send_message' && (
          <>
            <div>
              <label className={lbl}>Mensagem</label>
              <VarTextarea
                value={(data.body as string) ?? ''}
                onChange={v => patch({ body: v })}
                rows={4}
                placeholder="Olá {{contact.name}}! Tudo bem?"
              />
              <p className="text-xs text-amber-500 mt-1.5">⚠ Só funciona dentro da janela de 24h (user-initiated)</p>
            </div>
            <div>
              <label className={lbl}>Sender (opcional)</label>
              <select
                className={inp}
                value={(data.sender_id as string) ?? ''}
                onChange={e => patch({ sender_id: e.target.value || undefined })}
              >
                <option value="">Usar sender padrão da jornada</option>
                {senders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </>
        )}

        {/* ── WAIT FOR REPLY ─────────────────────────────────────── */}
        {node.type === 'wait_for_reply' && (
          <>
            <div>
              <label className={lbl}>Timeout (minutos, 0 = sem timeout)</label>
              <input
                type="number" min={0} className={inp}
                value={(data.timeout_minutes as number) ?? 0}
                onChange={e => patch({ timeout_minutes: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className={lbl}>ID do nó de timeout</label>
              <input
                className={inp}
                placeholder="ID do nó para onde ir se expirar"
                value={(data.timeout_node_id as string) ?? ''}
                onChange={e => patch({ timeout_node_id: e.target.value })}
              />
            </div>
          </>
        )}

        {/* ── CONDITION ──────────────────────────────────────────── */}
        {node.type === 'condition' && (
          <>
            <div className="space-y-3">
              {((data.branches as any[]) ?? []).map((b, i) => (
                <div key={b.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-600">Branch {i + 1}</span>
                    <button onClick={() => removeBranch(i)} className="text-red-400 text-xs hover:text-red-600">Remover</button>
                  </div>
                  <div>
                    <label className={lbl}>Label</label>
                    <input className={inp} value={b.label ?? ''} onChange={e => patchBranch(i, { label: e.target.value })} />
                  </div>
                  <div>
                    <label className={lbl}>Expressão</label>
                    <VarInput
                      value={b.expression ?? ''}
                      onChange={v => patchBranch(i, { expression: v })}
                      placeholder='{{last_reply.body}} == "1"'
                    />
                  </div>
                  <div>
                    <label className={lbl}>ID do próximo nó</label>
                    <input className={inp} placeholder="ID do nó alvo" value={b.next_node_id ?? ''} onChange={e => patchBranch(i, { next_node_id: e.target.value })} />
                  </div>
                </div>
              ))}
              <button
                onClick={addBranch}
                className="w-full border-2 border-dashed border-gray-300 text-gray-500 text-sm py-2 rounded-xl hover:border-blue-400 hover:text-blue-500 transition"
              >
                + Adicionar branch
              </button>
            </div>
            <div>
              <label className={lbl}>ID do nó padrão (default)</label>
              <input className={inp} value={(data.default_node_id as string) ?? ''} onChange={e => patch({ default_node_id: e.target.value })} />
            </div>
          </>
        )}

        {/* ── HTTP REQUEST ───────────────────────────────────────── */}
        {node.type === 'http_request' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={lbl}>Método</label>
                <select className={inp} value={(data.method as string) ?? 'GET'} onChange={e => patch({ method: e.target.value })}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>URL</label>
                <VarInput
                  value={(data.url as string) ?? ''}
                  onChange={v => patch({ url: v })}
                  placeholder="https://api.exemplo.com/{{contact.id}}"
                />
              </div>
            </div>
            <div>
              <label className={lbl}>Headers</label>
              <HeadersEditor
                value={(data.headers ?? {}) as Record<string, string>}
                onChange={v => patch({ headers: v })}
              />
            </div>
            <div>
              <label className={lbl}>Body</label>
              <VarTextarea
                value={(data.body as string) ?? ''}
                onChange={v => patch({ body: v })}
                rows={3}
                placeholder={'{"contact_id":"{{contact.id}}"}'}
              />
            </div>
            <div>
              <label className={lbl}>Salvar resposta em variável</label>
              <input className={inp} value={(data.response_variable as string) ?? ''} onChange={e => patch({ response_variable: e.target.value })} placeholder="http_response" />
            </div>
            <div>
              <label className={lbl}>Mapeamento da resposta</label>
              <div className="space-y-2">
                {((data.response_mapping as any[]) ?? []).map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className={inp} placeholder="data.score" value={m.json_path ?? ''} onChange={e => patchMapping(i, { json_path: e.target.value })} />
                    <span className="text-gray-400 text-sm flex-shrink-0">→</span>
                    <input className={inp} placeholder="nps_score" value={m.variable_name ?? ''} onChange={e => patchMapping(i, { variable_name: e.target.value })} />
                    <button onClick={() => { const r = [...((data.response_mapping as any[]) ?? [])]; r.splice(i, 1); patch({ response_mapping: r }) }} className="text-red-400 flex-shrink-0"><Trash2 size={13} /></button>
                  </div>
                ))}
                <button
                  onClick={() => patch({ response_mapping: [...((data.response_mapping as any[]) ?? []), { json_path: '', variable_name: '' }] })}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Plus size={12} /> Adicionar mapeamento
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── SET VARIABLES ──────────────────────────────────────── */}
        {node.type === 'set_variables' && (
          <div className="space-y-3">
            <label className={lbl}>Atribuições</label>
            {((data.assignments as any[]) ?? []).map((a, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Variável {i + 1}</span>
                  <button onClick={() => { const arr = [...((data.assignments as any[]) ?? [])]; arr.splice(i, 1); patch({ assignments: arr }) }} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
                </div>
                <div>
                  <label className={lbl}>Nome da variável</label>
                  <input className={inp} placeholder="minha_variavel" value={a.variable ?? ''} onChange={e => patchAssignment(i, { variable: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Valor</label>
                  <VarInput
                    value={a.value ?? ''}
                    onChange={v => patchAssignment(i, { value: v })}
                    placeholder="{{contact.name}} ou texto fixo"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => patch({ assignments: [...((data.assignments as any[]) ?? []), { variable: '', value: '' }] })}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus size={12} /> Adicionar atribuição
            </button>
          </div>
        )}

        {/* ── DELAY ──────────────────────────────────────────────── */}
        {node.type === 'delay' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={lbl}>Quantidade</label>
              <input type="number" min={1} className={inp} value={(data.amount as number) ?? 1} onChange={e => patch({ amount: parseInt(e.target.value) })} />
            </div>
            <div className="flex-1">
              <label className={lbl}>Unidade</label>
              <select className={inp} value={(data.unit as string) ?? 'minutes'} onChange={e => patch({ unit: e.target.value })}>
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Node ID ────────────────────────────────────────────── */}
        <div className="pt-2 border-t">
          <label className={lbl}>ID do nó</label>
          <input
            readOnly
            className={`${inp} bg-gray-50 font-mono text-xs text-gray-400 cursor-text`}
            value={node.id}
            onClick={e => (e.target as HTMLInputElement).select()}
            title="Clique para selecionar e copiar"
          />
          <p className="text-xs text-gray-400 mt-1">Use este ID em condições e timeouts.</p>
        </div>
      </div>
    </div>
  )
}
