'use client'

import { useState } from 'react'
import { TEMPLATE_TYPES } from '@omnilink/shared'
import { templatesApi } from '@/lib/api'
import {
  MessageSquare, Image as ImageIcon, MousePointerClick, ExternalLink, CreditCard,
  GalleryHorizontal, ShoppingBag, Workflow, Zap, Shield,
  ChevronRight, ChevronLeft, Check, Loader2, Plus, Trash2, X, AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import ContentDefinitionEditor, { getDefaultContentDef } from './ContentDefinitionEditor'

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare, Image: ImageIcon, MousePointerClick, ExternalLink, CreditCard,
  GalleryHorizontal, ShoppingBag, Workflow, Zap, Shield,
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Variable { name: string; example: string }

interface WizardData {
  name: string
  friendly_name: string
  language: string
  content_type: string
  variables: Variable[]
  content_definition: Record<string, unknown>
}

type SubmitStage = 'idle' | 'validating' | 'creating' | 'saving' | 'done' | 'error'
type StepStatus = 'pending' | 'active' | 'done'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function autoFriendlyName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function stageIndex(s: SubmitStage): number {
  return ['idle', 'validating', 'creating', 'saving', 'done'].indexOf(s)
}

function stepStatus(target: SubmitStage, current: SubmitStage): StepStatus {
  const ti = stageIndex(target)
  const ci = stageIndex(current)
  if (ci > ti) return 'done'
  if (ci === ti) return 'active'
  return 'pending'
}

const WIZARD_STEPS = ['Identidade', 'Tipo', 'Conteúdo', 'Revisão']

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const lbl = 'block text-sm font-medium text-gray-700 mb-1'

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5 flex items-start gap-4">
      <span className="text-gray-400 w-32 flex-shrink-0 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-gray-800 text-sm font-medium break-all">{value}</span>
    </div>
  )
}

function ProgressStep({ label, status }: { label: string; status: StepStatus }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-shrink-0">
        {status === 'done' && (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Check size={15} className="text-green-600" />
          </div>
        )}
        {status === 'active' && (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Loader2 size={15} className="text-blue-600 animate-spin" />
          </div>
        )}
        {status === 'pending' && (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
          </div>
        )}
      </div>
      <span className={`text-sm transition-colors ${
        status === 'active' ? 'text-blue-700 font-semibold' :
        status === 'done' ? 'text-green-700' : 'text-gray-400'
      }`}>
        {label}
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CreateTemplateWizard({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState(0)
  const [stage, setStage] = useState<SubmitStage>('idle')
  const [submitError, setSubmitError] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [hasContentSid, setHasContentSid] = useState(false)
  const [twilioCreateError, setTwilioCreateError] = useState<string | null>(null)
  const [submittingApproval, setSubmittingApproval] = useState(false)

  const [data, setData] = useState<WizardData>({
    name: '',
    friendly_name: '',
    language: 'pt_BR',
    content_type: 'twilio/text',
    variables: [],
    content_definition: getDefaultContentDef('twilio/text'),
  })

  function set<K extends keyof WizardData>(field: K, value: WizardData[K]) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const canAdvance =
    step === 0 ? data.name.trim() !== '' && data.friendly_name.trim() !== '' :
    step === 1 ? !!data.content_type :
    true

  const isSubmitting = stage !== 'idle' && stage !== 'error'

  function stepIndicatorState(i: number): { completed: boolean; current: boolean } {
    if (stage !== 'idle' && stage !== 'error') {
      return { completed: stage === 'done' || i < 3, current: stage !== 'done' && i === 3 }
    }
    return { completed: i < step, current: i === step }
  }

  // Derive body from content_definition for the summary and API call
  const bodyPreview = (data.content_definition.body as string) ?? ''

  async function handleCreate() {
    setSubmitError('')
    setTwilioCreateError(null)
    setStage('validating')
    await sleep(400)
    setStage('creating')

    try {
      const result = await templatesApi.create({
        name: data.name,
        friendly_name: data.friendly_name,
        language: data.language,
        content_type: data.content_type,
        body: bodyPreview,
        variables: data.variables,
        content_definition: data.content_definition,
      })

      setStage('saving')
      await sleep(450)
      setStage('done')
      setCreatedId(result.id)
      setHasContentSid(!!result.content_sid)
      if (result.twilio_error) setTwilioCreateError(result.twilio_error)
    } catch (e: any) {
      setStage('error')
      setSubmitError(e.response?.data?.error ?? e.message ?? 'Erro desconhecido ao criar template.')
    }
  }

  async function handleSubmitApproval() {
    if (!createdId) return
    setSubmittingApproval(true)
    try {
      await templatesApi.submit(createdId)
      onSuccess()
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.response?.data?.error ?? 'Erro ao enviar para aprovação'
      alert(msg)
      setSubmittingApproval(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* ── Header + Step Indicator ─────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Novo template</h2>
              <p className="text-xs text-gray-400 mt-0.5">Passo {Math.min(step + 1, 4)} de 4</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center">
            {WIZARD_STEPS.map((label, i) => {
              const { completed, current } = stepIndicatorState(i)
              const pending = !completed && !current
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      completed ? 'bg-blue-600 text-white' :
                      current ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {completed ? <Check size={14} /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium transition-colors ${
                      current ? 'text-blue-600' : completed ? 'text-gray-600' : pending ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {label}
                    </span>
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-5 rounded transition-colors duration-500 ${
                      i < step || stage === 'done' ? 'bg-blue-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* STEP 0 — Identity */}
          {step === 0 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">Defina o nome e idioma do template.</p>
              <div>
                <label className={lbl}>Nome interno *</label>
                <input
                  className={inp}
                  placeholder="NPS Clientes Template"
                  autoFocus
                  value={data.name}
                  onChange={e => {
                    const v = e.target.value
                    set('name', v)
                    if (data.friendly_name === autoFriendlyName(data.name) || data.friendly_name === '') {
                      set('friendly_name', autoFriendlyName(v))
                    }
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">Usado internamente na plataforma para identificar o template.</p>
              </div>
              <div>
                <label className={lbl}>Friendly Name (Twilio) *</label>
                <input
                  className={inp}
                  placeholder="nps_clientes_template"
                  value={data.friendly_name}
                  onChange={e => set('friendly_name', e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Identificador na Twilio. Sem espaços ou caracteres especiais.</p>
              </div>
              <div>
                <label className={lbl}>Idioma</label>
                <select className={inp} value={data.language} onChange={e => set('language', e.target.value)}>
                  <option value="pt_BR">Português (Brasil) — pt_BR</option>
                  <option value="en">English — en</option>
                  <option value="es">Español — es</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 1 — Type */}
          {step === 1 && (
            <div>
              <p className="text-sm text-gray-500 mb-4">Escolha o tipo de conteúdo do template WhatsApp.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {TEMPLATE_TYPES.map(t => {
                  const Icon = ICON_MAP[t.icon] ?? MessageSquare
                  const selected = data.content_type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        set('content_type', t.value)
                        set('content_definition', getDefaultContentDef(t.value))
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <Icon size={18} className={selected ? 'text-blue-600' : 'text-gray-500'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium leading-tight ${selected ? 'text-blue-700' : 'text-gray-700'}`}>{t.label}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{t.value}</p>
                      </div>
                      {selected && <Check size={16} className="ml-auto text-blue-500 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 2 — Content */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Variables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Variáveis dinâmicas</label>
                  <button
                    type="button"
                    onClick={() => set('variables', [...data.variables, { name: '', example: '' }])}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus size={12} /> Adicionar variável
                  </button>
                </div>
                {data.variables.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1 italic">Nenhuma variável. Use {'{{1}}'}, {'{{2}}'} na mensagem e adicione as variáveis aqui.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 font-medium px-8 mb-1">
                      <span>Nome</span>
                      <span>Exemplo</span>
                    </div>
                    {data.variables.map((v, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="w-6 h-6 bg-blue-50 rounded-md flex items-center justify-center text-xs font-bold text-blue-500 flex-shrink-0">
                          {i + 1}
                        </div>
                        <input
                          className={inp}
                          placeholder="customer_name"
                          value={v.name}
                          onChange={e => { const vs = [...data.variables]; vs[i] = { ...vs[i], name: e.target.value }; set('variables', vs) }}
                        />
                        <input
                          className={inp}
                          placeholder="João Silva"
                          value={v.example}
                          onChange={e => { const vs = [...data.variables]; vs[i] = { ...vs[i], example: e.target.value }; set('variables', vs) }}
                        />
                        <button
                          type="button"
                          onClick={() => { const vs = [...data.variables]; vs.splice(i, 1); set('variables', vs) }}
                          className="text-red-400 hover:text-red-600 flex-shrink-0 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Conteúdo — {TEMPLATE_TYPES.find(t => t.value === data.content_type)?.label ?? data.content_type}
                </p>
                <ContentDefinitionEditor
                  contentType={data.content_type}
                  value={data.content_definition}
                  onChange={v => set('content_definition', v)}
                />
              </div>
            </div>
          )}

          {/* STEP 3 — Review + Submission */}
          {step === 3 && (
            <div className="space-y-5">
              {(stage === 'idle' || stage === 'error') && (
                <>
                  <p className="text-sm text-gray-500">Revise os dados antes de criar o template na Twilio.</p>
                  <div className="bg-gray-50 rounded-xl border divide-y text-sm">
                    <SummaryRow label="Nome interno" value={data.name} />
                    <SummaryRow label="Friendly Name" value={data.friendly_name} />
                    <SummaryRow label="Idioma" value={data.language} />
                    <SummaryRow label="Tipo" value={data.content_type} />
                    {bodyPreview && <SummaryRow label="Mensagem" value={bodyPreview} />}
                    <SummaryRow label="Variáveis" value={`${data.variables.length} definida(s)`} />
                  </div>

                  {stage === 'error' && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}
                </>
              )}

              {isSubmitting && (
                <div className="py-2">
                  <ProgressStep label="Validando dados" status={stepStatus('validating', stage)} />
                  <ProgressStep label="Criando template na Twilio" status={stepStatus('creating', stage)} />
                  <ProgressStep label="Salvando no sistema" status={stepStatus('saving', stage)} />

                  {stage === 'done' && (
                    <div className="mt-8 text-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${hasContentSid ? 'bg-green-100' : 'bg-amber-100'}`}>
                        <Check size={30} className={hasContentSid ? 'text-green-600' : 'text-amber-600'} />
                      </div>
                      <p className="font-semibold text-gray-900 text-lg mb-1">
                        {hasContentSid ? 'Template criado!' : 'Template salvo localmente'}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        {hasContentSid
                          ? 'O template foi criado na Twilio. Você pode enviar para aprovação WhatsApp agora ou mais tarde.'
                          : 'O template foi salvo no sistema, mas a criação na Twilio falhou.'}
                      </p>
                      {twilioCreateError && (
                        <div className="text-left bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-xs text-red-700">
                          <p className="font-semibold mb-1">Erro da Twilio:</p>
                          <p className="break-words">{twilioCreateError}</p>
                        </div>
                      )}
                      <div className="flex gap-3 justify-center flex-wrap">
                        <button
                          onClick={onSuccess}
                          className="px-5 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition font-medium"
                        >
                          Fechar
                        </button>
                        {hasContentSid && (
                          <button
                            onClick={handleSubmitApproval}
                            disabled={submittingApproval}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            {submittingApproval && <Loader2 size={14} className="animate-spin" />}
                            Enviar para aprovação WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        {!isSubmitting && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
            <button
              type="button"
              onClick={step === 0 ? onClose : () => { setStage('idle'); setStep(s => s - 1) }}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition font-medium"
            >
              {step === 0 ? 'Cancelar' : <><ChevronLeft size={15} /> Anterior</>}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance}
                className="flex items-center gap-1 bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Próximo <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <Check size={15} /> Criar template
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
