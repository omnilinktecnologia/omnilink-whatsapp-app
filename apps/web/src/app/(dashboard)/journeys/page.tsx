'use client'

import { useEffect, useState } from 'react'
import { journeysApi, sendersApi } from '@/lib/api'
import { formatDate, STATUS_COLORS } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { Plus, GitBranch, Building2, User } from 'lucide-react'

export default function JourneysPage() {
  const router = useRouter()
  const [journeys, setJourneys] = useState<any[]>([])
  const [senders, setSenders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const { register, handleSubmit, reset } = useForm<{
    name: string; description: string; trigger_type: string; default_sender_id: string
  }>({ defaultValues: { trigger_type: 'business_initiated' } })

  async function load() {
    const [j, s] = await Promise.all([journeysApi.list(), sendersApi.list()])
    setJourneys(j)
    setSenders(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function onCreate(data: any) {
    const payload = { ...data }
    if (!payload.default_sender_id) delete payload.default_sender_id
    const journey = await journeysApi.create(payload)
    setShowForm(false)
    reset()
    router.push(`/journeys/${journey.id}`)
  }

  async function archive(id: string) {
    await journeysApi.archive(id)
    await load()
  }

  async function del(id: string) {
    if (!confirm('Remover jornada?')) return
    await journeysApi.delete(id)
    await load()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jornadas</h2>
          <p className="text-gray-500 text-sm">Fluxos interativos de conversação no WhatsApp</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={15} /> Nova jornada
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Nova jornada</h3>
            <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input {...register('name', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: NPS Clientes Maio" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea {...register('description')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de gatilho</label>
                <select {...register('trigger_type')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="business_initiated">Business Initiated (outbound via campanha)</option>
                  <option value="user_initiated">User Initiated (inbound — usuário inicia)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sender padrão</label>
                <select {...register('default_sender_id')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecionar no nó</option>
                  {senders.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone_number})</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Criar e abrir editor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : journeys.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <GitBranch size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhuma jornada criada</p>
          <p className="text-sm mt-1">Crie um fluxo de conversação no editor visual</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {journeys.map((j) => (
            <div key={j.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{j.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[j.status] ?? ''}`}>{j.status}</span>
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {j.trigger_type === 'business_initiated'
                          ? <><Building2 size={11} /> Business</>
                          : <><User size={11} /> User</>
                        }
                      </span>
                    </div>
                    {j.description && <p className="text-sm text-gray-500 mt-0.5">{j.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(j.updated_at)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => router.push(`/journeys/${j.id}`)}
                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium transition">
                    Editar
                  </button>
                  {j.status === 'published' && (
                    <button onClick={() => archive(j.id)}
                      className="text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs">
                      Arquivar
                    </button>
                  )}
                  {j.status === 'draft' && (
                    <button onClick={() => del(j.id)}
                      className="text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg text-xs">
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
