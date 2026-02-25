'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  Users, GitBranch, Megaphone, Zap, TrendingUp,
  ArrowRight, Send, Eye, MessageCircle, BarChart3,
  CheckCircle2, FolderOpen, Plus,
} from 'lucide-react'

interface Stats {
  contacts: number
  journeys: number
  journeys_published: number
  campaigns: number
  campaigns_running: number
  executions_active: number
  templates_approved: number
  messages_sent: number
  messages_delivered: number
  messages_read: number
  messages_received: number
}

const STATUS_COLORS: Record<string, string> = {
  running:   'text-indigo-600 bg-indigo-50',
  completed: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
  draft:     'text-gray-600 bg-gray-100',
  scheduled: 'text-blue-600 bg-blue-50',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [c, j, jp, camp, campR, e, tpl, msg, rc] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('journeys').select('id', { count: 'exact', head: true }),
        supabase.from('journeys').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'running'),
        supabase.from('journey_executions').select('id', { count: 'exact', head: true }).in('status', ['active', 'waiting']),
        supabase.from('templates').select('id', { count: 'exact', head: true }).eq('approval_status', 'approved'),
        supabase.from('messages').select('direction, status'),
        supabase.from('campaigns').select('id, name, status, sent_count, total_contacts, delivered_count, read_count, created_at').order('created_at', { ascending: false }).limit(5),
      ])

      const outbound = (msg.data ?? []).filter((m: any) => m.direction === 'outbound')
      const inbound = (msg.data ?? []).filter((m: any) => m.direction === 'inbound')
      const delivered = outbound.filter((m: any) => ['delivered', 'read'].includes(m.status))
      const read = outbound.filter((m: any) => m.status === 'read')

      setStats({
        contacts: c.count ?? 0,
        journeys: j.count ?? 0,
        journeys_published: jp.count ?? 0,
        campaigns: camp.count ?? 0,
        campaigns_running: campR.count ?? 0,
        executions_active: e.count ?? 0,
        templates_approved: tpl.count ?? 0,
        messages_sent: outbound.length,
        messages_delivered: delivered.length,
        messages_read: read.length,
        messages_received: inbound.length,
      })
      setRecentCampaigns(rc.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !stats) {
    return (
      <div className="p-8 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const deliveryRate = stats.messages_sent > 0 ? ((stats.messages_delivered / stats.messages_sent) * 100).toFixed(1) : '0'
  const readRate = stats.messages_sent > 0 ? ((stats.messages_read / stats.messages_sent) * 100).toFixed(1) : '0'
  const responseRate = stats.messages_sent > 0 ? ((stats.messages_received / stats.messages_sent) * 100).toFixed(1) : '0'

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Visão geral da plataforma Omnilink</p>
        </div>
        <div className="flex gap-2">
          <Link href="/journeys" className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={15} /> Nova Jornada
          </Link>
          <Link href="/campaigns" className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            <Megaphone size={15} /> Nova Campanha
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Contatos', value: stats.contacts, icon: Users, href: '/contacts', color: 'text-blue-600 bg-blue-50' },
          { label: 'Jornadas', value: stats.journeys, sub: `${stats.journeys_published} publicadas`, icon: GitBranch, href: '/journeys', color: 'text-purple-600 bg-purple-50' },
          { label: 'Campanhas', value: stats.campaigns, sub: `${stats.campaigns_running} ativas`, icon: Megaphone, href: '/campaigns', color: 'text-orange-600 bg-orange-50' },
          { label: 'Execuções Ativas', value: stats.executions_active, icon: Zap, href: '/analytics', color: 'text-green-600 bg-green-50' },
        ].map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.label} href={card.href}>
              <div className="bg-white rounded-xl border p-5 hover:shadow-md transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${card.color}`}>
                    <Icon size={18} />
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{card.value.toLocaleString('pt-BR')}</div>
                <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
                {'sub' in card && card.sub && (
                  <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Rates + Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><Send size={15} /></div>
            <span className="text-sm text-gray-500">Taxa de Entrega</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{deliveryRate}%</div>
          <div className="text-xs text-gray-400 mt-1">{stats.messages_delivered.toLocaleString('pt-BR')} de {stats.messages_sent.toLocaleString('pt-BR')} msgs</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Eye size={15} /></div>
            <span className="text-sm text-gray-500">Taxa de Leitura</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{readRate}%</div>
          <div className="text-xs text-gray-400 mt-1">{stats.messages_read.toLocaleString('pt-BR')} lidas</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><MessageCircle size={15} /></div>
            <span className="text-sm text-gray-500">Taxa de Resposta</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{responseRate}%</div>
          <div className="text-xs text-gray-400 mt-1">{stats.messages_received.toLocaleString('pt-BR')} respostas</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Campaigns */}
        <div className="col-span-2 bg-white rounded-xl border">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Campanhas Recentes</h3>
            </div>
            <Link href="/campaigns" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              <Megaphone size={30} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma campanha ainda</p>
              <Link href="/campaigns" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                Criar primeira campanha
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 text-left">Nome</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Progresso</th>
                  <th className="px-6 py-3 text-right">Entrega</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentCampaigns.map((c) => {
                  const dRate = c.sent_count > 0 ? ((c.delivered_count / c.sent_count) * 100).toFixed(0) : '—'
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-500">{c.sent_count}/{c.total_contacts}</td>
                      <td className="px-6 py-3 text-right font-medium text-green-600">{dRate}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-gray-400" /> Pré-requisitos
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'Número cadastrado', done: stats.contacts > 0 || stats.campaigns > 0, href: '/senders', icon: '📱' },
                { label: 'Contatos importados', done: stats.contacts > 0, href: '/contacts', icon: '👥' },
                { label: 'Template aprovado', done: stats.templates_approved > 0, href: '/templates', icon: '📝' },
                { label: 'Jornada publicada', done: stats.journeys_published > 0, href: '/journeys', icon: '🔀' },
              ].map(item => (
                <Link key={item.label} href={item.href}>
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    item.done ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}>
                    <span>{item.icon}</span>
                    <span className={item.done ? 'line-through' : 'font-medium'}>{item.label}</span>
                    {item.done && <CheckCircle2 size={14} className="ml-auto text-green-500" />}
                    {!item.done && <ArrowRight size={14} className="ml-auto text-gray-400" />}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <Link href="/analytics">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-5 text-white hover:opacity-95 transition">
              <BarChart3 size={20} className="mb-2 text-blue-200" />
              <div className="font-semibold text-sm">Analytics Completo</div>
              <p className="text-blue-200 text-xs mt-1">Funil, performance, volume diário</p>
              <div className="flex items-center gap-1 text-xs text-blue-200 mt-2">
                Ver métricas <ArrowRight size={12} />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
