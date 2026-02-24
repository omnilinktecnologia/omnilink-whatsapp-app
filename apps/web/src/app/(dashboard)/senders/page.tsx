'use client'

import { useEffect, useState } from 'react'
import { sendersApi } from '@/lib/api'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/lib/utils'
import { Plus, Smartphone } from 'lucide-react'

interface Sender { id: string; name: string; phone_number: string; twilio_from: string; description: string; is_active: boolean; created_at: string }

export default function SendersPage() {
  const [senders, setSenders] = useState<Sender[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Sender | null>(null)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  async function load() {
    setSenders(await sendersApi.list())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { reset(); setEditing(null); setShowForm(true) }
  function openEdit(s: Sender) {
    setValue('name', s.name); setValue('phone_number', s.phone_number)
    setValue('twilio_from', s.twilio_from); setValue('description', s.description)
    setEditing(s); setShowForm(true)
  }

  async function onSubmit(data: any) {
    if (editing) await sendersApi.update(editing.id, data)
    else await sendersApi.create(data)
    setShowForm(false)
    await load()
  }

  async function del(id: string) {
    if (!confirm('Remover número?')) return
    await sendersApi.delete(id)
    await load()
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Números WhatsApp</h2>
          <p className="text-gray-500 text-sm mt-1">Gerencie os senders registrados na Twilio</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={15} /> Adicionar número
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">{editing ? 'Editar' : 'Novo'} número</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input {...register('name', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Suporte Principal" />
                {errors.name && <p className="text-red-500 text-xs mt-1">Obrigatório</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número (E.164)</label>
                <input {...register('phone_number', { required: true, pattern: /^\+\d{7,15}$/ })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+5511999999999" />
                {errors.phone_number && <p className="text-red-500 text-xs mt-1">Formato E.164 inválido</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Twilio From</label>
                <input {...register('twilio_from', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="whatsapp:+5511999999999" />
                <p className="text-xs text-gray-400 mt-1">Valor exato do campo "From" na Twilio (ex: whatsapp:+55...)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
                <input {...register('description')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : senders.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <Smartphone size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhum número cadastrado</p>
          <p className="text-sm mt-1">Adicione um número WhatsApp conectado à Twilio</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Número</th>
                <th className="px-5 py-3 text-left">Twilio From</th>
                <th className="px-5 py-3 text-left">Cadastrado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {senders.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-5 py-3 font-mono text-gray-600">{s.phone_number}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{s.twilio_from}</td>
                  <td className="px-5 py-3 text-gray-400">{formatDate(s.created_at)}</td>
                  <td className="px-5 py-3 flex gap-2 justify-end">
                    <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                    <button onClick={() => del(s.id)} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
