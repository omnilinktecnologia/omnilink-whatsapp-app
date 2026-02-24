'use client'

import { useEffect, useState } from 'react'
import { campaignsApi, journeysApi, listsApi, sendersApi } from '@/lib/api'
import { formatDate, STATUS_COLORS } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { Plus, Megaphone, Play, Square, BarChart2, Trash2 } from 'lucide-react'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [journeys, setJourneys] = useState<any[]>([])
  const [lists, setLists] = useState<any[]>([])
  const [senders, setSenders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [stats, setStats] = useState<Record<string, any>>({})
  const { register, handleSubmit, reset } = useForm()

  async function load() {
    const [c, j, l, s] = await Promise.all([
      campaignsApi.list(),
      journeysApi.list(),
      listsApi.list(),
      sendersApi.list(),
    ])
    setCampaigns(c)
    setJourneys(j.filter((j: any) => j.status === 'published'))
    setLists(l)
    setSenders(s.filter((s: any) => s.is_active))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadStats(id: string) {
    try {
      const s = await campaignsApi.stats(id)
      setStats(prev => ({ ...prev, [id]: s }))
    } catch {}
  }

  async function onSubmit(data: any) {
    const payload = { ...data }
    if (!payload.journey_id) delete payload.journey_id
    if (!payload.list_id) delete payload.list_id
    if (!payload.sender_id) delete payload.sender_id
    if (!payload.scheduled_at) delete payload.scheduled_at
    await campaignsApi.create(payload)
    setShowForm(false)
    reset()
    await load()
  }

  async function launch(id: string) {
    if (!confirm('Lançar campanha agora?')) return
    try {
      await campaignsApi.launch(id)
      await load()
    } catch (e: any) { alert(e.response?.data?.error ?? 'Erro ao lançar') }
  }

  async function cancel(id: string) {
    if (!confirm('Cancelar campanha?')) return
    await campaignsApi.cancel(id)
    await load()
  }

  async function deleteCampaign(id: string, name: string) {
    if (!confirm(`Excluir a campanha "${name}" permanentemente? Isso também remove todas as execuções e histórico associados.`)) return
    await campaignsApi.delete(id)
    await load()
  }

  const progressPct = (c: any) => c.total_contacts > 0 ? Math.round(c.sent_count / c.total_contacts * 100) : 0

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campanhas</h2>
          <p className="text-gray-500 text-sm">Envios outbound para listas de contatos</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={15} /> Nova campanha
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold text-lg mb-4">Nova campanha</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input {...register('name', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: NPS Clientes Maio/2025" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jornada publicada *</label>
                <select {...register('journey_id', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecionar...</option>
                  {journeys.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
                {journeys.length === 0 && <p className="text-xs text-amber-500 mt-1">Nenhuma jornada publicada. Publique uma jornada primeiro.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lista de contatos *</label>
                <select {...register('list_id', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecionar...</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de envio *</label>
                <select {...register('sender_id', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecionar...</option>
                  {senders.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone_number})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agendar para (opcional)</label>
                <input type="datetime-local" {...register('scheduled_at')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Deixe em branco para lançar manualmente depois</p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Criar campanha</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <Megaphone size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhuma campanha criada</p>
          <p className="text-sm mt-1">Crie uma campanha para enviar jornadas para seus contatos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? ''}`}>{c.status}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mb-3">
                    <span>Jornada: <span className="text-gray-600">{c.journeys?.name ?? '—'}</span></span>
                    <span>Lista: <span className="text-gray-600">{c.contact_lists?.name ?? '—'}</span></span>
                    <span>Número: <span className="text-gray-600">{c.senders?.phone_number ?? '—'}</span></span>
                  </div>

                  {c.total_contacts > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{c.sent_count} enviados / {c.total_contacts} total</span>
                        <span>{progressPct(c)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct(c)}%` }} />
                      </div>
                    </div>
                  )}

                  {c.started_at && <p className="text-xs text-gray-400">Iniciado: {formatDate(c.started_at)}</p>}
                </div>

                <div className="flex gap-2 ml-4 items-center">
                  {c.status === 'running' && (
                    <button onClick={() => loadStats(c.id)}
                      className="flex items-center gap-1 text-blue-500 text-xs hover:underline">
                      <BarChart2 size={13} /> Stats
                    </button>
                  )}
                  {['draft', 'scheduled'].includes(c.status) && (
                    <button onClick={() => launch(c.id)}
                      className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
                      <Play size={12} /> Lançar
                    </button>
                  )}
                  {['running', 'scheduled'].includes(c.status) && (
                    <button onClick={() => cancel(c.id)}
                      className="flex items-center gap-1.5 border border-red-300 text-red-500 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50">
                      <Square size={12} /> Cancelar
                    </button>
                  )}
                  <button
                    onClick={() => deleteCampaign(c.id, c.name)}
                    title="Excluir campanha"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {stats[c.id] && (
                <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-3">
                  {Object.entries(stats[c.id].execution_stats ?? {}).map(([status, count]) => (
                    <div key={status} className="text-center">
                      <div className="text-lg font-bold text-gray-800">{count as number}</div>
                      <div className="text-xs text-gray-400">{status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
