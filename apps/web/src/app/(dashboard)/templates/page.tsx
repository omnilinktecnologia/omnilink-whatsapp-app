'use client'

import { useEffect, useState } from 'react'
import { templatesApi } from '@/lib/api'
import { APPROVAL_LABELS } from '@/lib/utils'
import {
  Plus, RefreshCw, FolderOpen, Cloud, Download, AlertTriangle,
  SendHorizonal, RotateCcw, Trash2, Copy, Check, Loader2,
  BookOpen, ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'
import CreateTemplateWizard from '@/components/CreateTemplateWizard'

// ── Types ─────────────────────────────────────────────────────────────────────

type LocalTemplate = {
  source: 'local'
  id: string
  name: string
  friendly_name: string
  content_type: string
  content_sid: string | null
  approval_status: string
  created_at: string
  body?: string
}

type TwilioOnlyTemplate = {
  source: 'twilio'
  sid: string
  friendly_name: string
  content_type: string
  approval_status: string
  language: string
  body: string
  date_created: string
}

type Row = LocalTemplate | TwilioOnlyTemplate

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  'twilio/text':             { label: 'Texto',      color: 'bg-blue-100 text-blue-700' },
  'twilio/media':            { label: 'Mídia',      color: 'bg-indigo-100 text-indigo-700' },
  'twilio/quick-reply':      { label: 'Quick Reply',color: 'bg-purple-100 text-purple-700' },
  'twilio/call-to-action':   { label: 'CTA',        color: 'bg-orange-100 text-orange-700' },
  'twilio/card':             { label: 'Card',       color: 'bg-pink-100 text-pink-700' },
  'twilio/carousel':         { label: 'Carrossel',  color: 'bg-cyan-100 text-cyan-700' },
  'twilio/catalog':          { label: 'Catálogo',   color: 'bg-emerald-100 text-emerald-700' },
  'twilio/flows':            { label: 'Flow',       color: 'bg-teal-100 text-teal-700' },
  'whatsapp/flows':          { label: 'WA Flow',    color: 'bg-green-100 text-green-700' },
  'whatsapp/authentication': { label: 'Auth OTP',   color: 'bg-red-100 text-red-700' },
}

const APPROVAL_STYLE: Record<string, string> = {
  unsubmitted: 'bg-gray-100 text-gray-500',
  pending:     'bg-amber-100 text-amber-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  paused:      'bg-orange-100 text-orange-700',
  disabled:    'bg-gray-100 text-gray-400',
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_LABEL[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>
}

function ApprovalBadge({ status }: { status: string }) {
  const style = APPROVAL_STYLE[status] ?? 'bg-gray-100 text-gray-600'
  const label = APPROVAL_LABELS[status] ?? status
  const isPending = status === 'pending'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style}`}>
      {isPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />}
      {status === 'approved' && <Check size={10} className="flex-shrink-0" />}
      {label}
    </span>
  )
}

function CopySid({ sid }: { sid: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(sid)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const short = sid.slice(0, 12) + '…'
  return (
    <button
      onClick={copy}
      title={sid}
      className="inline-flex items-center gap-1 font-mono text-xs text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-2 py-0.5 rounded transition"
    >
      {copied ? <><Check size={10} className="text-green-500" /> Copiado</> : <><Copy size={10} />{short}</>}
    </button>
  )
}

// ── WhatsApp Flows Guide ──────────────────────────────────────────────────────

const GUIDE_STEPS = [
  {
    title: '1. Criar o Flow no Meta Business Manager',
    items: [
      'Acesse business.facebook.com e selecione a sua conta.',
      'No menu lateral, vá em "WhatsApp" → "Flows".',
      'Clique em "Criar Flow". Escolha um nome, selecione a categoria (ex.: Cadastro, Pesquisa, Atendimento) e o idioma.',
      'Use o editor visual para montar as telas do formulário: arraste campos de texto, múltipla escolha, data, dropdown, etc.',
      'Cada tela gera um screen_id (visível no painel de propriedades). Anote o ID da primeira tela.',
      'Clique em "Visualizar" para testar o preenchimento do formulário dentro do editor.',
    ],
  },
  {
    title: '2. Publicar o Flow',
    items: [
      'Ainda no editor de Flows da Meta, clique em "Publicar". O status mudará para "Published".',
      'Após publicar, copie o Flow ID (exibido na URL e no topo da página do flow).',
      'O Flow ID tem formato numérico (ex.: 1234567890123456). Ele será necessário no próximo passo.',
    ],
  },
  {
    title: '3. Criar o template tipo "WA Flow" no Omnilink',
    items: [
      'Aqui nesta página, clique em "Novo template" e selecione o tipo whatsapp/flows.',
      'Preencha o Flow ID, o texto do botão (CTA que o usuário verá), e o ID da primeira tela (flow_first_page_id).',
      'Opcionalmente adicione um subtítulo e/ou URL de mídia para header.',
      'Avance até o final do wizard. O template será criado na Twilio Content API automaticamente.',
    ],
  },
  {
    title: '4. Enviar para aprovação',
    items: [
      'Após criar, o template aparecerá na lista com status "Não enviado".',
      'Clique em "Aprovar", selecione a categoria (Marketing, Utilitário ou Autenticação) e confirme.',
      'O template será enviado à Meta para revisão. O status mudará para "Pendente".',
      'A aprovação costuma levar de alguns minutos a 24h. Use o botão de sincronizar para atualizar o status.',
    ],
  },
  {
    title: '5. Usar o template em jornadas ou campanhas',
    items: [
      'Com o template aprovado, ele estará disponível nos nós "Enviar Template" do construtor de jornadas.',
      'Quando o contato recebe a mensagem, verá o botão do Flow. Ao clicar, o formulário abre nativamente no WhatsApp.',
      'As respostas do formulário são salvas automaticamente e podem ser visualizadas em "Respostas de Flows".',
    ],
  },
]

function WhatsAppFlowsGuide() {
  const [open, setOpen] = useState(false)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition group"
      >
        <BookOpen size={15} />
        <span>Como criar templates do tipo WhatsApp Flows</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="mt-3 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border border-blue-200/70 rounded-xl p-5 space-y-1">
          <p className="text-sm text-gray-600 mb-4">
            Para usar WhatsApp Flows (formulários nativos dentro do WhatsApp), é necessário primeiro criá-los no Meta Business Manager
            e depois vincular ao template nesta plataforma. Siga as etapas abaixo:
          </p>

          {GUIDE_STEPS.map((step, i) => {
            const isExpanded = expandedStep === i
            return (
              <div key={i} className="bg-white/80 rounded-lg border border-blue-100/80 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-50/50 transition"
                  onClick={() => setExpandedStep(isExpanded ? null : i)}
                >
                  <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    {step.title.replace(/^\d+\.\s*/, '')}
                  </span>
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1">
                    <ol className="space-y-2">
                      {step.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <span className="text-xs font-bold text-blue-400 mt-0.5 shrink-0 w-5 text-right">{j + 1}.</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center gap-3 pt-3">
            <a
              href="https://business.facebook.com/latest/whatsapp_manager/flows"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition"
            >
              <ExternalLink size={12} /> Abrir Meta Business Manager
            </a>
            <a
              href="https://developers.facebook.com/docs/whatsapp/flows"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            >
              <ExternalLink size={12} /> Documentação oficial (Meta)
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const APPROVAL_CATEGORIES = [
  { value: 'MARKETING',      label: 'Marketing' },
  { value: 'UTILITY',        label: 'Utilitário' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
]

function CategoryModal({ onConfirm, onClose }: { onConfirm: (cat: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState('MARKETING')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-gray-900 mb-1">Enviar para aprovação</h3>
        <p className="text-sm text-gray-500 mb-4">Selecione a categoria do template conforme as diretrizes da Meta.</p>
        <div className="space-y-2 mb-5">
          {APPROVAL_CATEGORIES.map(c => (
            <label key={c.value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${cat === c.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="cat" value={c.value} checked={cat === c.value} onChange={() => setCat(c.value)} className="accent-blue-600" />
              <span className="text-sm font-medium text-gray-700">{c.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Cancelar</button>
          <button onClick={() => onConfirm(cat)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">Enviar</button>
        </div>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTwilio, setLoadingTwilio] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [pendingSubmitId, setPendingSubmitId] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [twilioError, setTwilioError] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)

  async function load() {
    setLoading(true)
    setLoadingTwilio(true)
    setTwilioError(null)

    const localData: LocalTemplate[] = (await templatesApi.list()).map((t: any) => ({
      source: 'local' as const, ...t,
    }))
    setRows(localData)
    setLoading(false)

    try {
      const twilioData: TwilioOnlyTemplate[] = (await templatesApi.twilioList()).map((t: any) => ({
        source: 'twilio' as const,
        sid: t.sid,
        friendly_name: t.friendly_name,
        content_type: t.content_type,
        approval_status: t.approval_status,
        language: t.language,
        body: t.body,
        date_created: t.date_created,
      }))
      setRows([...localData, ...twilioData])
    } catch (e: any) {
      setTwilioError(e.response?.data?.error ?? e.message)
    } finally {
      setLoadingTwilio(false)
    }
  }

  useEffect(() => { load() }, [])

  async function submitForApproval(id: string, category: string) {
    setPendingSubmitId(null)
    setSubmitting(id)
    setSubmitResult(null)
    try {
      await templatesApi.submit(id, { category })
      setSubmitResult({ id, ok: true, msg: 'Enviado para aprovação!' })
      await load()
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.response?.data?.error ?? 'Erro ao enviar'
      setSubmitResult({ id, ok: false, msg })
    } finally {
      setSubmitting(null)
    }
  }

  async function syncStatus(id: string) {
    setSyncing(id)
    try { await templatesApi.sync(id); await load() }
    catch { }
    finally { setSyncing(null) }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Remover este template permanentemente?')) return
    await templatesApi.delete(id)
    await load()
  }

  async function importTemplate(sid: string) {
    setImporting(sid)
    try { await templatesApi.importFromTwilio(sid); await load() }
    catch (e: any) { alert('Erro ao importar: ' + (e.response?.data?.error ?? e.message)) }
    finally { setImporting(null) }
  }

  const localCount = rows.filter(r => r.source === 'local').length
  const twilioCount = rows.filter(r => r.source === 'twilio').length
  const pendingApproval = rows.filter(r => r.source === 'local' && (r as LocalTemplate).approval_status === 'unsubmitted' && (r as LocalTemplate).content_sid).length

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Templates</h2>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-sm text-gray-500">{localCount} no sistema</span>
            {loadingTwilio
              ? <span className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> buscando na Twilio…</span>
              : twilioError
              ? <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> erro Twilio</span>
              : twilioCount > 0
              ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{twilioCount} só na Twilio</span>
              : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Twilio sincronizada</span>
            }
            {pendingApproval > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {pendingApproval} aguardando envio
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading || loadingTwilio}
            title="Sincronizar com Twilio"
            className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition"
          >
            <RefreshCw size={14} className={loadingTwilio ? 'animate-spin' : ''} />
            Sincronizar
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus size={15} /> Novo template
          </button>
        </div>
      </div>

      {/* ── Feedback banner ──────────────────────────────────────── */}
      {submitResult && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm mb-4 ${submitResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <span>{submitResult.ok ? '✓' : '✕'} {submitResult.msg}</span>
          <button onClick={() => setSubmitResult(null)} className="text-current opacity-50 hover:opacity-100 text-xs">Fechar</button>
        </div>
      )}

      {twilioError && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
          <AlertTriangle size={13} /> Erro ao buscar da Twilio: {twilioError}
        </div>
      )}

      {/* ── WhatsApp Flows guide ────────────────────────────────── */}
      <WhatsAppFlowsGuide />

      {/* ── Wizard ───────────────────────────────────────────────── */}
      {showForm && (
        <CreateTemplateWizard
          onClose={() => setShowForm(false)}
          onSuccess={async () => { setShowForm(false); await load() }}
        />
      )}

      {/* ── Category modal ───────────────────────────────────────── */}
      {pendingSubmitId && (
        <CategoryModal
          onConfirm={cat => submitForApproval(pendingSubmitId, cat)}
          onClose={() => setPendingSubmitId(null)}
        />
      )}

      {/* ── List ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border p-14 text-center text-gray-400">
          <FolderOpen size={38} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Nenhum template encontrado</p>
          <p className="text-sm mt-1">Crie um novo template ou sincronize com a Twilio.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={14} className="inline mr-1" /> Criar template
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          {/* Table head */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Template</span>
            <span className="w-28 text-center">Tipo</span>
            <span className="w-32 text-center">Aprovação</span>
            <span className="w-48 text-right">Ações</span>
          </div>

          <div className="divide-y">
            {rows.map((row) => {

              /* ── Local template row ── */
              if (row.source === 'local') {
                const t = row as LocalTemplate
                const canSubmit = !!t.content_sid && t.approval_status === 'unsubmitted'
                const canSync   = !!t.content_sid
                const isSubmitting_ = submitting === t.id
                const isSyncing_    = syncing === t.id

                return (
                  <div key={`local-${t.id}`} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 items-center hover:bg-gray-50/70 transition group">
                    {/* Name + meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{t.name}</span>
                        {t.content_sid
                          ? <CopySid sid={t.content_sid} />
                          : <span className="text-xs text-amber-500 italic">sem ContentSid</span>
                        }
                      </div>
                      {t.body && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{t.body}</p>
                      )}
                    </div>

                    {/* Type */}
                    <div className="w-28 flex justify-center">
                      <TypeBadge type={t.content_type} />
                    </div>

                    {/* Approval */}
                    <div className="w-32 flex justify-center">
                      <ApprovalBadge status={t.approval_status} />
                    </div>

                    {/* Actions */}
                    <div className="w-48 flex items-center justify-end gap-1.5">
                      {canSubmit && (
                        <button
                          onClick={() => setPendingSubmitId(t.id)}
                          disabled={isSubmitting_}
                          title="Enviar para aprovação WhatsApp"
                          className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {isSubmitting_
                            ? <Loader2 size={12} className="animate-spin" />
                            : <SendHorizonal size={12} />
                          }
                          {isSubmitting_ ? 'Enviando…' : 'Aprovar'}
                        </button>
                      )}
                      {canSync && (
                        <button
                          onClick={() => syncStatus(t.id)}
                          disabled={isSyncing_}
                          title="Sincronizar status com Twilio"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-40"
                        >
                          <RotateCcw size={14} className={isSyncing_ ? 'animate-spin' : ''} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        title="Remover template"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              }

              /* ── Twilio-only row ── */
              const t = row as TwilioOnlyTemplate
              return (
                <div key={`twilio-${t.sid}`} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 items-center bg-amber-50/40 hover:bg-amber-50/70 transition">
                  {/* Name + meta */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-700 text-sm">{t.friendly_name}</span>
                      <CopySid sid={t.sid} />
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        <Cloud size={10} /> Só na Twilio
                      </span>
                    </div>
                    {t.body && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.body}</p>}
                  </div>

                  {/* Type */}
                  <div className="w-28 flex justify-center">
                    <TypeBadge type={t.content_type} />
                  </div>

                  {/* Approval */}
                  <div className="w-32 flex justify-center">
                    <ApprovalBadge status={t.approval_status} />
                  </div>

                  {/* Actions */}
                  <div className="w-48 flex items-center justify-end">
                    <button
                      onClick={() => importTemplate(t.sid)}
                      disabled={importing === t.sid}
                      className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-white disabled:opacity-50 transition"
                    >
                      {importing === t.sid
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Download size={12} />
                      }
                      {importing === t.sid ? 'Importando…' : 'Importar'}
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Loading skeleton while Twilio fetches */}
            {loadingTwilio && (
              <div className="px-5 py-3 flex items-center gap-2 text-xs text-gray-400 bg-gray-50/50">
                <Loader2 size={12} className="animate-spin" /> Buscando templates na Twilio…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
