'use client'

import { useEffect, useState, useMemo } from 'react'
import { flowResponsesApi, journeysApi, campaignsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import {
  ClipboardList, RefreshCw, ChevronDown, ChevronRight, Inbox, Trash2,
  BarChart2, List,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

function ResponseDataTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <p className="text-xs text-gray-400 italic">Sem campos</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase tracking-wide">Campo</th>
            <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(([key, value]) => (
            <tr key={key} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-gray-600 font-medium">{key}</td>
              <td className="px-3 py-2 text-gray-800">
                {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
        <div className="px-5 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
          <ResponseDataTable data={r.response_data ?? {}} />
        </div>
      )}
    </div>
  )
}

// ── Campaign stats view ────────────────────────────────────────────────────

/** Horizontal bar showing proportional width */
function FieldBar({
  label,
  count,
  max,
  total,
}: { label: string; count: number; max: number; total: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  const share = total > 0 ? ((count / total) * 100).toFixed(1) : '0'

  return (
    <div className="flex items-center gap-3 py-1">
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

function FieldDistribution({
  fieldName,
  valueCounts,
}: { fieldName: string; valueCounts: Record<string, number> }) {
  const sorted = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])
  const total  = sorted.reduce((s, [, c]) => s + c, 0)
  const max    = sorted[0]?.[1] ?? 1

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-700 font-mono bg-gray-100 px-2 py-0.5 rounded">
          {fieldName}
        </span>
        <span className="text-xs text-gray-400">{total} resposta{total !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-0.5">
        {sorted.map(([val, cnt]) => (
          <FieldBar key={val} label={val} count={cnt} max={max} total={total} />
        ))}
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
            {stat.total} envio{stat.total !== 1 ? 's' : ''}
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
            fields.map(([fieldName, valueCounts]) => (
              <FieldDistribution key={fieldName} fieldName={fieldName} valueCounts={valueCounts} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

type View = 'list' | 'campaigns'

export default function FlowResponsesPage() {
  const [view, setView] = useState<View>('campaigns')

  // List view state
  const [responses, setResponses]     = useState<FlowResponse[]>([])
  const [total, setTotal]             = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [filterJourney, setFilterJourney] = useState('')
  const [page, setPage]               = useState(1)
  const limit = 50

  // Campaign stats state
  const [stats, setStats]             = useState<CampaignStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [filterCampaign, setFilterCampaign] = useState('')

  // Shared
  const [journeys, setJourneys]     = useState<{ id: string; name: string }[]>([])
  const [campaigns, setCampaigns]   = useState<{ id: string; name: string }[]>([])

  // ── Load campaigns/journeys on mount ──
  useEffect(() => {
    journeysApi.list().then((j: any[]) => setJourneys(j)).catch(() => {})
    campaignsApi.list().then((cs: any[]) => setCampaigns(cs)).catch(() => {})
  }, [])

  // ── List view loader ──
  async function loadList(p = 1) {
    setListLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, limit }
      if (filterJourney) params.journey_id = filterJourney
      const result = await flowResponsesApi.list(params)
      setResponses(result.data ?? [])
      setTotal(result.total ?? 0)
      setPage(p)
    } finally {
      setListLoading(false)
    }
  }

  // ── Campaign stats loader ──
  async function loadStats() {
    setStatsLoading(true)
    try {
      const result = await flowResponsesApi.campaignStats(filterCampaign || undefined)
      setStats(result.campaigns ?? [])
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => { if (view === 'list') loadList(1) },    [view, filterJourney])
  useEffect(() => { if (view === 'campaigns') loadStats() }, [view, filterCampaign])

  async function handleDelete(id: string) {
    if (!confirm('Remover esta resposta?')) return
    await flowResponsesApi.delete(id)
    await loadList(page)
  }

  const totalPages = Math.ceil(total / limit)
  const isLoading  = view === 'list' ? listLoading : statsLoading

  // Filter stats client-side for the dropdown (API already filters if campaign_id is set)
  const visibleStats = useMemo(
    () => filterCampaign ? stats.filter(s => s.campaign_id === filterCampaign) : stats,
    [stats, filterCampaign],
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={22} className="text-blue-600" /> Respostas de Flows
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Formulários enviados via WhatsApp Flows
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('campaigns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'campaigns'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart2 size={14} /> Por Campanha
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={14} /> Lista
            </button>
          </div>
          <button
            onClick={() => view === 'list' ? loadList(page) : loadStats()}
            disabled={isLoading}
            className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Campaign stats view ── */}
      {view === 'campaigns' && (
        <>
          {/* Filter */}
          <div className="flex items-center gap-3 mb-5">
            <select
              value={filterCampaign}
              onChange={e => setFilterCampaign(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {statsLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : visibleStats.length === 0 ? (
            <div className="bg-white rounded-xl border p-14 text-center text-gray-400">
              <BarChart2 size={38} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">Nenhum resultado por campanha</p>
              <p className="text-sm mt-1">
                As respostas agrupadas aparecem aqui quando flows enviados em campanhas são preenchidos.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleStats.map(stat => (
                <CampaignStatsCard key={stat.campaign_id} stat={stat} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <>
          {/* Filter */}
          <div className="flex items-center gap-3 mb-5">
            <select
              value={filterJourney}
              onChange={e => setFilterJourney(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as jornadas</option>
              {journeys.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            <span className="text-sm text-gray-500 ml-1">{total} resposta{total !== 1 ? 's' : ''}</span>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : responses.length === 0 ? (
            <div className="bg-white rounded-xl border p-14 text-center text-gray-400">
              <Inbox size={38} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">Nenhuma resposta encontrada</p>
              <p className="text-sm mt-1">
                As respostas aparecem aqui quando um usuário preenche e envia um WhatsApp Flow.
              </p>
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
                <div className="divide-y">
                  {responses.map(r => (
                    <ResponseRow key={r.id} r={r} onDelete={() => handleDelete(r.id)} />
                  ))}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>Página {page} de {totalPages} ({total} respostas)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadList(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => loadList(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                    >
                      Próxima
                    </button>
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
