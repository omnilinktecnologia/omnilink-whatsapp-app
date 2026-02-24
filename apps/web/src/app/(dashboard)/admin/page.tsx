'use client'

import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import {
  Users, Plus, Shield, ShieldOff, Trash2,
  KeyRound, UserCog, CheckCircle, XCircle, X,
} from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  confirmed: boolean
  banned: boolean
  last_sign_in: string | null
  created_at: string
}

type ModalMode = 'create' | 'edit' | 'password' | null

const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', user: 'Usuário' }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<any>()

  async function load() {
    setLoading(true)
    try { setUsers(await adminApi.listUsers()) }
    catch (e: any) { setError(e.response?.data?.error ?? 'Erro ao carregar usuários') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    reset({ role: 'user' })
    setSelected(null)
    setModal('create')
    setError('')
  }

  function openEdit(u: User) {
    reset({ name: u.name, email: u.email, role: u.role })
    setSelected(u)
    setModal('edit')
    setError('')
  }

  function openPassword(u: User) {
    reset()
    setSelected(u)
    setModal('password')
    setError('')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setError('')
    reset()
  }

  async function onCreate(data: any) {
    setSaving(true)
    setError('')
    try {
      await adminApi.createUser({ email: data.email, password: data.password, name: data.name, role: data.role })
      closeModal()
      await load()
    } catch (e: any) { setError(e.response?.data?.error ?? 'Erro ao criar usuário') }
    finally { setSaving(false) }
  }

  async function onEdit(data: any) {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      await adminApi.updateUser(selected.id, { name: data.name, email: data.email, role: data.role })
      closeModal()
      await load()
    } catch (e: any) { setError(e.response?.data?.error ?? 'Erro ao atualizar usuário') }
    finally { setSaving(false) }
  }

  async function onPassword(data: any) {
    if (!selected) return
    if (data.password !== data.confirm) { setError('As senhas não coincidem'); return }
    setSaving(true)
    setError('')
    try {
      await adminApi.updateUser(selected.id, { password: data.password })
      closeModal()
    } catch (e: any) { setError(e.response?.data?.error ?? 'Erro ao alterar senha') }
    finally { setSaving(false) }
  }

  async function toggleBan(u: User) {
    const action = u.banned ? 'Desbloquear' : 'Bloquear'
    if (!confirm(`${action} o usuário ${u.email}?`)) return
    try {
      await adminApi.updateUser(u.id, { banned: !u.banned })
      await load()
    } catch (e: any) { alert(e.response?.data?.error ?? 'Erro') }
  }

  async function deleteUser(u: User) {
    if (!confirm(`Remover permanentemente ${u.email}? Esta ação não pode ser desfeita.`)) return
    try {
      await adminApi.deleteUser(u.id)
      await load()
    } catch (e: any) { alert(e.response?.data?.error ?? 'Erro ao remover') }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h2>
          <p className="text-gray-500 text-sm mt-1">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Usuário</th>
                <th className="px-5 py-3 text-left">Perfil</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Último acesso</th>
                <th className="px-5 py-3 text-left">Criado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${u.banned ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.name || <span className="text-gray-400 italic">sem nome</span>}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role === 'admin' ? <Shield size={10} /> : <UserCog size={10} />}
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 text-xs ${u.confirmed ? 'text-green-600' : 'text-amber-500'}`}>
                        {u.confirmed
                          ? <><CheckCircle size={12} /> Confirmado</>
                          : <><XCircle size={12} /> Pendente</>
                        }
                      </span>
                      {u.banned && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500">
                          <ShieldOff size={12} /> Bloqueado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {u.last_sign_in ? formatDate(u.last_sign_in) : 'Nunca'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(u)}
                        title="Editar"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <UserCog size={15} />
                      </button>
                      <button
                        onClick={() => openPassword(u)}
                        title="Alterar senha"
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => toggleBan(u)}
                        title={u.banned ? 'Desbloquear' : 'Bloquear'}
                        className={`p-1.5 rounded-lg transition ${
                          u.banned
                            ? 'text-green-500 hover:text-green-700 hover:bg-green-50'
                            : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                        }`}
                      >
                        {u.banned ? <Shield size={15} /> : <ShieldOff size={15} />}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        title="Remover"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-lg text-gray-900">
                {modal === 'create' && 'Novo usuário'}
                {modal === 'edit' && 'Editar usuário'}
                {modal === 'password' && 'Alterar senha'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {/* Create form */}
            {modal === 'create' && (
              <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
                <div>
                  <label className={labelClass}>Nome completo</label>
                  <input {...register('name')} className={inputClass} placeholder="João Silva" />
                </div>
                <div>
                  <label className={labelClass}>E-mail *</label>
                  <input {...register('email', { required: true })} type="email" className={inputClass} placeholder="joao@empresa.com" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">Obrigatório</p>}
                </div>
                <div>
                  <label className={labelClass}>Senha temporária *</label>
                  <input {...register('password', { required: true, minLength: 6 })} type="password" className={inputClass} placeholder="Mínimo 6 caracteres" />
                  {errors.password && <p className="text-red-500 text-xs mt-1">Mínimo 6 caracteres</p>}
                </div>
                <div>
                  <label className={labelClass}>Perfil</label>
                  <select {...register('role')} className={inputClass}>
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
                  <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Criando...' : 'Criar usuário'}
                  </button>
                </div>
              </form>
            )}

            {/* Edit form */}
            {modal === 'edit' && selected && (
              <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
                <div>
                  <label className={labelClass}>Nome completo</label>
                  <input {...register('name')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>E-mail *</label>
                  <input {...register('email', { required: true })} type="email" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Perfil</label>
                  <select {...register('role')} className={inputClass}>
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
                  <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            )}

            {/* Password form */}
            {modal === 'password' && selected && (
              <form onSubmit={handleSubmit(onPassword)} className="space-y-4">
                <p className="text-sm text-gray-500">Alterar senha de <strong>{selected.email}</strong></p>
                <div>
                  <label className={labelClass}>Nova senha *</label>
                  <input {...register('password', { required: true, minLength: 6 })} type="password" className={inputClass} placeholder="Mínimo 6 caracteres" />
                  {errors.password && <p className="text-red-500 text-xs mt-1">Mínimo 6 caracteres</p>}
                </div>
                <div>
                  <label className={labelClass}>Confirmar nova senha *</label>
                  <input {...register('confirm', { required: true })} type="password" className={inputClass} placeholder="Repita a senha" />
                </div>
                {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
                  <button type="submit" disabled={saving} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                    {saving ? 'Alterando...' : 'Alterar senha'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
