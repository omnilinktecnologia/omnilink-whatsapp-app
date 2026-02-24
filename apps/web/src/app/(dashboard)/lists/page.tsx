'use client'

import { useEffect, useState } from 'react'
import { listsApi, contactsApi } from '@/lib/api'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/lib/utils'
import { Plus, List, X } from 'lucide-react'

export default function ListsPage() {
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const [addContact, setAddContact] = useState('')
  const { register, handleSubmit, reset, setValue } = useForm()

  async function load() {
    setLists(await listsApi.list())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openDetail(list: any) {
    setSelected(list)
    const [m, c] = await Promise.all([
      listsApi.members(list.id, { limit: 200 }),
      contactsApi.list({ limit: 500 }),
    ])
    setMembers(m.data ?? [])
    setAllContacts(c.data ?? [])
  }

  async function onSubmit(data: any) {
    if (editing) await listsApi.update(editing.id, data)
    else await listsApi.create(data)
    setShowForm(false)
    await load()
  }

  async function addMember() {
    if (!addContact || !selected) return
    await listsApi.addMembers(selected.id, [addContact])
    setAddContact('')
    await openDetail(selected)
  }

  async function removeMember(cid: string) {
    await listsApi.removeMember(selected.id, cid)
    await openDetail(selected)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Listas</h2>
          <p className="text-gray-500 text-sm">Agrupe contatos para campanhas</p>
        </div>
        <button onClick={() => { reset(); setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={15} /> Nova lista
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-lg mb-4">{editing ? 'Editar' : 'Nova'} lista</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input {...register('name', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea {...register('description')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-end">
          <div className="bg-white h-full w-full max-w-xl shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-4">
                <select value={addContact} onChange={e => setAddContact(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Adicionar contato...</option>
                  {allContacts.filter(c => !members.some(m => m.contacts?.id === c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.name ?? c.phone} ({c.phone})</option>
                  ))}
                </select>
                <button onClick={addMember} disabled={!addContact}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  Adicionar
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">{members.length} contato(s) na lista</p>
              <div className="space-y-1">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800">{m.contacts?.name ?? m.contacts?.phone}</span>
                    <button onClick={() => removeMember(m.contacts?.id)} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
                  </div>
                ))}
                {members.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Lista vazia</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <List size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhuma lista criada</p>
          <p className="text-sm mt-1">Crie listas para organizar contatos em campanhas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Descrição</th>
                <th className="px-5 py-3 text-left">Criado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lists.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{l.name}</td>
                  <td className="px-5 py-3 text-gray-500">{l.description ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-400">{formatDate(l.created_at)}</td>
                  <td className="px-5 py-3 flex gap-2 justify-end">
                    <button onClick={() => openDetail(l)} className="text-blue-500 hover:text-blue-700 text-xs">Ver membros</button>
                    <button onClick={async () => { if (!confirm('Remover lista?')) return; await listsApi.delete(l.id); await load() }}
                      className="text-red-400 hover:text-red-600 text-xs">Remover</button>
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
