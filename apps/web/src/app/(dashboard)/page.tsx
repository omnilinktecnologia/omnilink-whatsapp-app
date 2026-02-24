'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Users, GitBranch, Megaphone, Zap, TrendingUp } from 'lucide-react'

interface Stats {
  contacts: number
  journeys: number
  campaigns: number
  executions_active: number
}

const STATUS_COLORS: Record<string, string> = {
  running:   'text-indigo-600 bg-indigo-50',
  completed: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
  draft:     'text-gray-600 bg-gray-100',
  scheduled: 'text-blue-600 bg-blue-50',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ contacts: 0, journeys: 0, campaigns: 0, executions_active: 0 })
  const [loading, setLoading] = useState(true)
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [c, j, camp, e, rc] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('journeys').select('id', { count: 'exact', head: true }),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }),
        supabase.from('journey_executions').select('id', { count: 'exact', head: true }).in('status', ['active', 'waiting']),
        supabase.from('campaigns').select('id, name, status, sent_count, total_contacts, created_at').order('created_at', { ascending: false }).limit(5),
      ])
      setStats({ contacts: c.count ?? 0, journeys: j.count ?? 0, campaigns: camp.count ?? 0, executions_active: e.count ?? 0 })
      setRecentCampaigns(rc.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const STAT_CARDS = [
    { label: 'Contatos',         value: stats.contacts,          icon: Users,      href: '/contacts',  color: 'text-blue-600 bg-blue-50' },
    { label: 'Jornadas',         value: stats.journeys,          icon: GitBranch,  href: '/journeys',  color: 'text-purple-600 bg-purple-50' },
    { label: 'Campanhas',        value: stats.campaigns,         icon: Megaphone,  href: '/campaigns', color: 'text-orange-600 bg-orange-50' },
    { label: 'Execuções ativas', value: stats.executions_active, icon: Zap,        href: '/campaigns', color: 'text-green-600 bg-green-50' },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Visão geral da plataforma</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {STAT_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <Link key={card.label} href={card.href}>
                  <div className="bg-white rounded-xl border p-5 hover:shadow-md transition">
                    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${card.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                    <div className="text-sm text-gray-500 mt-1">{card.label}</div>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="bg-white rounded-xl border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-gray-400" />
                <h3 className="font-semibold text-gray-900">Campanhas recentes</h3>
              </div>
              <Link href="/campaigns" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
            </div>
            {recentCampaigns.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                <p className="text-sm">Nenhuma campanha ainda.</p>
                <Link href="/campaigns" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                  Criar primeira campanha →
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3 text-left">Nome</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-right">Progresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentCampaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-500">
                        {c.sent_count}/{c.total_contacts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
