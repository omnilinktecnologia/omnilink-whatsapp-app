'use client'

import { useEffect, useState, useMemo } from 'react'
import { listsApi, contactsApi } from '@/lib/api'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/lib/utils'
import { Plus, List, X, Search, Check, UserPlus, Users, Loader2 } from 'lucide-react'

function DetailPanel({
  selected, members, allContacts, selectedIds, searchTerm, adding,
  onClose, onSearch, onToggle, onSelectAll, onAdd, onRemove,
}: {
  selected: any
  members: any[]
  allContacts: any[]
  selectedIds: Set<string>
  searchTerm: string
  adding: boolean
  onClose: () => void
  onSearch: (v: string) => void
  onToggle: (id: string) => void
  onSelectAll: (ids: string[]) => void
  onAdd: () => void
  onRemove: (cid: string) => void
}) {
  const memberIds = useMemo(() => new Set(members.map((m: any) => m.contacts?.id)), [members])

  const available = useMemo(() => {
    return allContacts.filter(c => !memberIds.has(c.id))
  }, [allContacts, memberIds])

  const filtered = useMemo(() => {
    if (!searchTerm) return available
    const q = searchTerm.toLowerCase()
    return available.filter(c =>
      (c.name?.toLowerCase().includes(q)) ||
      (c.phone?.toLowerCase().includes(q)) ||
      (c.email?.toLowerCase().includes(q))
    )
  }, [available, searchTerm])

  const filteredIds = filtered.map(c => c.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-end">
      <div className="bg-white h-full w-full max-w-xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{selected.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition">
            <X size={20} />
          </button>
        </div>

        {/* Add contacts section */}
        <div className="px-6 py-4 border-b bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={15} className="text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Adicionar contatos</span>
            {available.length > 0 && (
              <span className="text-xs text-gray-400 ml-auto">{available.length} disponíve{available.length !== 1 ? 'is' : 'l'}</span>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou email..."
              className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Select all + add button */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={() => onSelectAll(filteredIds)}
                  className="accent-blue-600 rounded"
                />
                Selecionar todos ({filtered.length})
              </label>
              {selectedIds.size > 0 && (
                <button
                  onClick={onAdd}
                  disabled={adding}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {adding
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Plus size={12} />
                  }
                  Adicionar {selectedIds.size} contato{selectedIds.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* Contact list (checkboxes) */}
          <div className="max-h-48 overflow-y-auto rounded-lg border bg-white divide-y">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                {available.length === 0
                  ? 'Todos os contatos já estão na lista'
                  : 'Nenhum contato encontrado'}
              </p>
            ) : (
              filtered.map(c => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition hover:bg-blue-50/50 ${
                    selectedIds.has(c.id) ? 'bg-blue-50/70' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => onToggle(c.id)}
                    className="accent-blue-600 rounded shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-gray-800 font-medium block truncate">
                      {c.name ?? c.phone}
                    </span>
                    {c.name && (
                      <span className="text-xs text-gray-400 font-mono">{c.phone}</span>
                    )}
                  </div>
                  {selectedIds.has(c.id) && (
                    <Check size={14} className="text-blue-600 shrink-0" />
                  )}
                </label>
              ))
            )}
          </div>
        </div>

        {/* Current members */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Membros da lista</span>
            <span className="text-xs text-gray-400 ml-auto">{members.length}</span>
          </div>

          <div className="space-y-1">
            {members.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 group">
                <div className="min-w-0">
                  <span className="text-sm text-gray-800 font-medium block truncate">
                    {m.contacts?.name ?? m.contacts?.phone}
                  </span>
                  {m.contacts?.name && m.contacts?.phone && (
                    <span className="text-xs text-gray-400 font-mono">{m.contacts.phone}</span>
                  )}
                </div>
                <button
                  onClick={() => onRemove(m.contacts?.id)}
                  className="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  Remover
                </button>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Lista vazia — adicione contatos acima</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ListsPage() {
  const [lists, setLists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [adding, setAdding] = useState(false)
  const { register, handleSubmit, reset } = useForm()

  async function load() {
    setLists(await listsApi.list())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openDetail(list: any) {
    setSelected(list)
    setSelectedIds(new Set())
    setSearchTerm('')
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

  async function addMembers() {
    if (selectedIds.size === 0 || !selected) return
    setAdding(true)
    try {
      await listsApi.addMembers(selected.id, Array.from(selectedIds))
      setSelectedIds(new Set())
      setSearchTerm('')
      await openDetail(selected)
    } finally { setAdding(false) }
  }

  async function removeMember(cid: string) {
    await listsApi.removeMember(selected.id, cid)
    await openDetail(selected)
  }

  function toggleContact(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll(ids: string[]) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => next.has(id))
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
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
        <DetailPanel
          selected={selected}
          members={members}
          allContacts={allContacts}
          selectedIds={selectedIds}
          searchTerm={searchTerm}
          adding={adding}
          onClose={() => setSelected(null)}
          onSearch={setSearchTerm}
          onToggle={toggleContact}
          onSelectAll={selectAll}
          onAdd={addMembers}
          onRemove={removeMember}
        />
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
