'use client'

import { useEffect, useState, useRef } from 'react'
import { contactsApi, listsApi } from '@/lib/api'
import { useForm } from 'react-hook-form'
import { formatDate, formatPhone } from '@/lib/utils'
import { Plus, Upload, Users, CheckCircle, List, Loader2, X } from 'lucide-react'

// ── Import result modal ────────────────────────────────────────────────────────

type ImportResult = {
  imported: number
  total_rows: number
  contact_ids: string[]
}

function ImportResultModal({
  result,
  onClose,
  onDone,
}: {
  result: ImportResult
  onClose: () => void
  onDone: () => void
}) {
  const [lists, setLists] = useState<{ id: string; name: string }[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [done, setDone] = useState(false)
  const [mode, setMode] = useState<'choose' | 'new'>('choose')

  useEffect(() => {
    listsApi.list().then(setLists).catch(() => {})
  }, [])

  async function handleAssign() {
    if (result.contact_ids.length === 0) return
    setAssigning(true)
    try {
      let listId = selectedList

      if (mode === 'new' && newListName.trim()) {
        setCreating(true)
        const created = await listsApi.create({ name: newListName.trim() })
        listId = created.id
        setCreating(false)
      }

      if (!listId) return

      await listsApi.addMembers(listId, result.contact_ids)
      setDone(true)
    } catch (err: any) {
      alert('Erro ao associar: ' + (err.response?.data?.error ?? err.message))
    } finally {
      setAssigning(false)
    }
  }

  function handleSkip() {
    onDone()
    onClose()
  }

  function handleFinish() {
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Importação concluída</h3>
              <p className="text-sm text-gray-500">
                {result.imported} contato{result.imported !== 1 ? 's' : ''} importado{result.imported !== 1 ? 's' : ''} de {result.total_rows} linha{result.total_rows !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {!done ? (
          <>
            {/* Question */}
            <div className="px-6 pb-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <List size={15} className="text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">Associar a uma lista?</span>
                </div>
                <p className="text-xs text-blue-700">
                  Vincule os {result.imported} contatos importados a uma lista para facilitar o envio de campanhas.
                </p>
              </div>
            </div>

            {/* Options */}
            <div className="px-6 pb-4 space-y-3">
              {/* Existing list */}
              <label
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                  mode === 'choose' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setMode('choose')}
              >
                <input
                  type="radio"
                  name="listMode"
                  checked={mode === 'choose'}
                  onChange={() => setMode('choose')}
                  className="accent-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">Lista existente</span>
                  {mode === 'choose' && (
                    <select
                      value={selectedList}
                      onChange={e => setSelectedList(e.target.value)}
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">Selecione uma lista...</option>
                      {lists.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              {/* New list */}
              <label
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                  mode === 'new' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setMode('new')}
              >
                <input
                  type="radio"
                  name="listMode"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                  className="accent-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">Criar nova lista</span>
                  {mode === 'new' && (
                    <input
                      value={newListName}
                      onChange={e => setNewListName(e.target.value)}
                      placeholder="Nome da nova lista..."
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={handleSkip}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Pular
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || (mode === 'choose' && !selectedList) || (mode === 'new' && !newListName.trim())}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {assigning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {creating ? 'Criando lista...' : 'Associando...'}
                  </>
                ) : (
                  <>Associar {result.imported} contatos</>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Done state */
          <div className="px-6 pb-6">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4 text-center">
              <CheckCircle size={24} className="mx-auto text-green-600 mb-2" />
              <p className="text-sm font-medium text-green-800">
                {result.imported} contatos associados à lista com sucesso!
              </p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  const LIMIT = 50

  async function load() {
    setLoading(true)
    const res = await contactsApi.list({ page, limit: LIMIT, search: search || undefined })
    setContacts(res.data)
    setTotal(res.total)
    setLoading(false)
  }

  useEffect(() => { load() }, [page, search])

  function openCreate() { reset(); setEditing(null); setShowForm(true) }
  function openEdit(c: any) {
    setValue('phone', c.phone); setValue('name', c.name ?? ''); setValue('email', c.email ?? '')
    setEditing(c); setShowForm(true)
  }

  async function onSubmit(data: any) {
    if (editing) await contactsApi.update(editing.id, data)
    else await contactsApi.create(data)
    setShowForm(false)
    await load()
  }

  async function del(id: string) {
    if (!confirm('Remover contato?')) return
    await contactsApi.delete(id)
    await load()
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const res = await contactsApi.import(file)
      setImportResult(res)
    } catch (err: any) {
      alert('Erro na importação: ' + (err.response?.data?.error ?? err.message))
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contatos</h2>
          <p className="text-gray-500 text-sm">{total} contatos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileRef} onChange={handleImport} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            <Upload size={14} />
            {importing ? 'Importando...' : 'Importar CSV'}
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={15} /> Novo contato
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">{editing ? 'Editar' : 'Novo'} contato</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (E.164) *</label>
                <input {...register('phone', { required: true, pattern: /^\+\d{7,15}$/ })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+5511999999999" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">Formato inválido (use +55...)</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input {...register('name')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input {...register('email')} type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import result → associate to list */}
      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
          onDone={() => load()}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <>
          {contacts.length === 0 && !search ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <Users size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Nenhum contato cadastrado</p>
              <p className="text-sm mt-1">Adicione manualmente ou importe um CSV</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3 text-left">Nome</th>
                    <th className="px-5 py-3 text-left">Telefone</th>
                    <th className="px-5 py-3 text-left">E-mail</th>
                    <th className="px-5 py-3 text-left">Cadastrado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{c.name ?? '—'}</td>
                      <td className="px-5 py-3 font-mono text-gray-600">{formatPhone(c.phone)}</td>
                      <td className="px-5 py-3 text-gray-500">{c.email ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-400">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-3 flex gap-2 justify-end">
                        <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                        <button onClick={() => del(c.id)} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {contacts.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Nenhum contato encontrado</div>
              )}
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50">
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">{page} / {pages}</span>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50">
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
