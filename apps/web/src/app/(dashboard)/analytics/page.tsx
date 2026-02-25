'use client'

import { useEffect, useState } from 'react'
import { analyticsApi } from '@/lib/api'
import {
  BarChart3, Send, Eye, MessageCircle, AlertTriangle,
  TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw,
  Users, GitBranch, Megaphone, CheckCircle2,
} from 'lucide-react'

interface Analytics {
  totals: { contacts: number; journeys: number; campaigns: number; approved_templates: number }
  messages: { sent: number; received: number; delivered: number; read: number; failed: number }
  rates: { delivery: number; read: number; response: number }
  executions: Record<string, number>
  daily_volume: Record<string, { sent: number; received: number }>
  campaign_performance: Array<{
    id: string; name: string; status: string
    total: number; sent: number; delivered: number; read: number; replied: number; errors: number
    delivery_rate: string; read_rate: string; response_rate: string
  }>
}

function RateCard({ label, value, icon: Icon, color, trend }: {
  label: string; value: number; icon: any; color: string; trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        {trend === 'up' && <ArrowUpRight size={16} className="text-green-500" />}
        {trend === 'down' && <ArrowDownRight size={16} className="text-red-500" />}
      </div>
      <div>
        <div className="text-3xl font-bold text-gray-900">{value}%</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string
}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon size={16} />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString('pt-BR')}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-4">
      <div className="w-24 text-sm text-gray-600 font-medium text-right">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden relative">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
          {value.toLocaleString('pt-BR')} ({pct.toFixed(1)}%)
        </span>
      </div>
    </div>
  )
}

function CampaignRow({ c }: { c: Analytics['campaign_performance'][0] }) {
  const statusColors: Record<string, string> = {
    running: 'bg-indigo-50 text-indigo-700',
    completed: 'bg-green-50 text-green-700',
  }
  return (
    <tr className="hover:bg-gray-50/60 transition">
      <td className="px-5 py-3">
        <div className="font-medium text-gray-900 text-sm">{c.name}</div>
      </td>
      <td className="px-5 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {c.status}
        </span>
      </td>
      <td className="px-5 py-3 text-sm text-gray-600 text-right">{c.sent}/{c.total}</td>
      <td className="px-5 py-3 text-sm text-right">
        <span className="text-green-600 font-medium">{c.delivery_rate}%</span>
      </td>
      <td className="px-5 py-3 text-sm text-right">
        <span className="text-blue-600 font-medium">{c.read_rate}%</span>
      </td>
      <td className="px-5 py-3 text-sm text-right">
        <span className="text-purple-600 font-medium">{c.response_rate}%</span>
      </td>
      <td className="px-5 py-3 text-sm text-right text-red-500">{c.errors}</td>
    </tr>
  )
}

function DailyChart({ data }: { data: Record<string, { sent: number; received: number }> }) {
  const days = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Sem dados de volume diário
      </div>
    )
  }

  const maxVal = Math.max(...days.map(([, v]) => Math.max(v.sent, v.received)), 1)

  return (
    <div className="flex items-end gap-1.5 h-48 px-2">
      {days.map(([day, vol]) => {
        const sentH = (vol.sent / maxVal) * 100
        const recvH = (vol.received / maxVal) * 100
        const label = day.slice(5)
        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${day}: ${vol.sent} enviadas, ${vol.received} recebidas`}>
            <div className="w-full flex gap-0.5 items-end" style={{ height: '160px' }}>
              <div className="flex-1 bg-blue-400 rounded-t transition-all duration-500 group-hover:bg-blue-500" style={{ height: `${sentH}%`, minHeight: vol.sent > 0 ? '4px' : '0' }} />
              <div className="flex-1 bg-emerald-400 rounded-t transition-all duration-500 group-hover:bg-emerald-500" style={{ height: `${recvH}%`, minHeight: vol.received > 0 ? '4px' : '0' }} />
            </div>
            <span className="text-[10px] text-gray-400 font-mono">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      setData(await analyticsApi.overview())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-600" /> Analytics
          </h2>
          <p className="text-gray-500 text-sm mt-1">Métricas de performance das suas campanhas WhatsApp</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Rate Cards */}
      <div className="grid grid-cols-3 gap-4">
        <RateCard label="Taxa de Entrega" value={data.rates.delivery} icon={Send} color="bg-green-50 text-green-600" trend={data.rates.delivery >= 90 ? 'up' : data.rates.delivery < 70 ? 'down' : 'neutral'} />
        <RateCard label="Taxa de Leitura" value={data.rates.read} icon={Eye} color="bg-blue-50 text-blue-600" trend={data.rates.read >= 50 ? 'up' : data.rates.read < 20 ? 'down' : 'neutral'} />
        <RateCard label="Taxa de Resposta" value={data.rates.response} icon={MessageCircle} color="bg-purple-50 text-purple-600" trend={data.rates.response >= 30 ? 'up' : 'neutral'} />
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Contatos" value={data.totals.contacts} icon={Users} color="bg-blue-50 text-blue-600" />
        <MetricCard label="Jornadas" value={data.totals.journeys} icon={GitBranch} color="bg-purple-50 text-purple-600" />
        <MetricCard label="Campanhas" value={data.totals.campaigns} icon={Megaphone} color="bg-orange-50 text-orange-600" />
        <MetricCard label="Templates Aprovados" value={data.totals.approved_templates} icon={CheckCircle2} color="bg-green-50 text-green-600" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Message Funnel */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-gray-400" />
            <h3 className="font-semibold text-gray-900">Funil de Mensagens</h3>
          </div>
          <div className="space-y-3">
            <FunnelBar label="Enviadas" value={data.messages.sent} max={data.messages.sent} color="bg-blue-400" />
            <FunnelBar label="Entregues" value={data.messages.delivered} max={data.messages.sent} color="bg-green-400" />
            <FunnelBar label="Lidas" value={data.messages.read} max={data.messages.sent} color="bg-indigo-400" />
            <FunnelBar label="Respostas" value={data.messages.received} max={data.messages.sent} color="bg-purple-400" />
            {data.messages.failed > 0 && (
              <FunnelBar label="Falhas" value={data.messages.failed} max={data.messages.sent} color="bg-red-400" />
            )}
          </div>
        </div>

        {/* Daily Volume */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Volume Diário (14 dias)</h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Enviadas</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Recebidas</span>
            </div>
          </div>
          <DailyChart data={data.daily_volume} />
        </div>
      </div>

      {/* Execution Status */}
      {Object.keys(data.executions).length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Execuções por Status</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(data.executions).map(([status, count]) => {
              const colors: Record<string, string> = {
                active: 'bg-blue-50 text-blue-700 border-blue-200',
                waiting: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                completed: 'bg-green-50 text-green-700 border-green-200',
                failed: 'bg-red-50 text-red-700 border-red-200',
                timed_out: 'bg-orange-50 text-orange-700 border-orange-200',
              }
              return (
                <div key={status} className={`px-4 py-2.5 rounded-xl border font-medium text-sm ${colors[status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  <span className="text-lg font-bold">{count}</span>
                  <span className="ml-1.5">{status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Campaign Performance Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Megaphone size={16} className="text-gray-400" />
          <h3 className="font-semibold text-gray-900">Performance de Campanhas</h3>
        </div>
        {data.campaign_performance.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <AlertTriangle size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Nenhuma campanha executada ainda</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-5 py-3 text-left">Campanha</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Enviados</th>
                <th className="px-5 py-3 text-right">Entrega</th>
                <th className="px-5 py-3 text-right">Leitura</th>
                <th className="px-5 py-3 text-right">Resposta</th>
                <th className="px-5 py-3 text-right">Erros</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.campaign_performance.map(c => <CampaignRow key={c.id} c={c} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
