'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Bot, X, Send, RotateCcw, Loader2, Sparkles,
  LayoutDashboard, Smartphone, Users, List,
  FolderOpen, GitBranch, Megaphone, Compass,
  BarChart3, Zap, CheckCircle, AlertCircle,
} from 'lucide-react'

// ── Page context map ──────────────────────────────────────────────────────────

const PAGE_CONTEXT: Record<string, { label: string; suggestions: string[] }> = {
  '/': {
    label: 'Dashboard',
    suggestions: [
      'Mostre as métricas da plataforma',
      'Crie uma jornada de boas-vindas para novos contatos',
      'Quais campanhas estão ativas?',
    ],
  },
  '/senders': {
    label: 'Números WhatsApp',
    suggestions: [
      'Quais números estão cadastrados?',
      'Como configuro um número na Twilio?',
    ],
  },
  '/contacts': {
    label: 'Contatos',
    suggestions: [
      'Quantos contatos tenho cadastrados?',
      'Como importar contatos via CSV?',
    ],
  },
  '/lists': {
    label: 'Listas',
    suggestions: [
      'Quais listas existem e quantos contatos cada uma tem?',
      'Para que servem as listas?',
    ],
  },
  '/templates': {
    label: 'Templates',
    suggestions: [
      'Quais templates estão aprovados?',
      'Como criar um template novo?',
    ],
  },
  '/journeys': {
    label: 'Jornadas',
    suggestions: [
      'Crie uma jornada de NPS com pergunta e condição',
      'Quais jornadas existem?',
      'Crie uma jornada de follow-up de vendas',
    ],
  },
  '/campaigns': {
    label: 'Campanhas',
    suggestions: [
      'Crie uma campanha com a última jornada publicada',
      'Qual o status das campanhas?',
      'Lance a campanha mais recente',
    ],
  },
  '/analytics': {
    label: 'Analytics',
    suggestions: [
      'Mostre um resumo das métricas',
      'Qual a taxa de entrega?',
      'Como melhorar a taxa de resposta?',
    ],
  },
}

// ── Tour prompts ──────────────────────────────────────────────────────────────

const TOUR_PROMPTS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Números',   path: '/senders',   icon: Smartphone },
  { label: 'Contatos',  path: '/contacts',  icon: Users },
  { label: 'Listas',    path: '/lists',     icon: List },
  { label: 'Templates', path: '/templates', icon: FolderOpen },
  { label: 'Jornadas',  path: '/journeys',  icon: GitBranch },
  { label: 'Campanhas', path: '/campaigns', icon: Megaphone },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
]

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(text: string, onNavigate: (path: string) => void): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, li) => {
    const listMatch = line.match(/^[-*]\s+(.+)/)
    if (listMatch) {
      elements.push(
        <div key={li} className="flex gap-1.5 items-start">
          <span className="w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" style={{ marginTop: 7 }} />
          <span>{renderInline(listMatch[1], onNavigate)}</span>
        </div>
      )
      return
    }
    const numMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (numMatch) {
      elements.push(
        <div key={li} className="flex gap-1.5 items-start">
          <span className="flex-shrink-0 font-semibold text-xs">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2], onNavigate)}</span>
        </div>
      )
      return
    }
    const h3 = line.match(/^###\s+(.+)/)
    if (h3) { elements.push(<p key={li} className="font-semibold text-sm mt-2">{renderInline(h3[1], onNavigate)}</p>); return }
    const h2 = line.match(/^##\s+(.+)/)
    if (h2) { elements.push(<p key={li} className="font-bold text-sm mt-2">{renderInline(h2[1], onNavigate)}</p>); return }
    if (line.trim() === '') { elements.push(<div key={li} className="h-1.5" />); return }
    elements.push(<span key={li}>{renderInline(line, onNavigate)}<br /></span>)
  })

  return <>{elements}</>
}

function renderInline(text: string, onNavigate: (path: string) => void): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(\/[^)]+\))/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i}>{part.slice(1, -1)}</em>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="bg-black/10 rounded px-1 text-[11px] font-mono">{part.slice(1, -1)}</code>
        const navMatch = part.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/)
        if (navMatch) {
          return (
            <button
              key={i}
              onClick={() => onNavigate(navMatch[2])}
              className="inline-flex items-center gap-1 text-blue-600 underline underline-offset-2 hover:text-blue-800 transition font-medium"
            >
              {navMatch[1]}
            </button>
          )
        }
        return part
      })}
    </>
  )
}

// ── Action labels ─────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  list_journeys:       { label: 'Consultando jornadas',     icon: GitBranch,  color: 'text-purple-600 bg-purple-50' },
  create_journey:      { label: 'Criando jornada',          icon: Zap,        color: 'text-blue-600 bg-blue-50' },
  publish_journey:     { label: 'Publicando jornada',       icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  list_templates:      { label: 'Consultando templates',    icon: FolderOpen, color: 'text-orange-600 bg-orange-50' },
  list_senders:        { label: 'Consultando números',      icon: Smartphone, color: 'text-teal-600 bg-teal-50' },
  list_contacts:       { label: 'Consultando contatos',     icon: Users,      color: 'text-blue-600 bg-blue-50' },
  list_contact_lists:  { label: 'Consultando listas',       icon: List,       color: 'text-indigo-600 bg-indigo-50' },
  create_campaign:     { label: 'Criando campanha',         icon: Megaphone,  color: 'text-orange-600 bg-orange-50' },
  launch_campaign:     { label: 'Lançando campanha',        icon: Zap,        color: 'text-green-600 bg-green-50' },
  list_campaigns:      { label: 'Consultando campanhas',    icon: Megaphone,  color: 'text-orange-600 bg-orange-50' },
  get_analytics:       { label: 'Obtendo analytics',        icon: BarChart3,  color: 'text-blue-600 bg-blue-50' },
}

// ── Action badge component ────────────────────────────────────────────────────

function ActionBadge({ action, result }: { action: string; result?: any }) {
  const info = ACTION_LABELS[action] ?? { label: action, icon: Zap, color: 'text-gray-600 bg-gray-50' }
  const Icon = info.icon
  const hasError = result?.error
  const isSuccess = result?.success

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
      hasError ? 'bg-red-50 text-red-700 border-red-200' :
      isSuccess ? 'bg-green-50 text-green-700 border-green-200' :
      `${info.color} border-current/20`
    }`}>
      {hasError ? <AlertCircle size={13} /> : isSuccess ? <CheckCircle size={13} /> : <Icon size={13} />}
      <span>{hasError ? `Erro: ${result.error}` : isSuccess ? result.message ?? info.label : info.label}</span>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  isAction?: boolean
  actions?: Array<{ name: string; result?: any }>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FloatingAssistant() {
  const router = useRouter()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showTourMenu, setShowTourMenu] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const pageCtx = PAGE_CONTEXT[pathname] ?? PAGE_CONTEXT[
    Object.keys(PAGE_CONTEXT).find(k => k !== '/' && pathname.startsWith(k)) ?? '/'
  ] ?? { label: 'Plataforma', suggestions: [] }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  function navigate(path: string) {
    router.push(path)
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

  const sendMessage = useCallback(async (text: string, isAction = false) => {
    if (!text.trim() || streaming) return

    const userMsg: Message = { role: 'user', content: text.trim(), isAction }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)
    setShowTourMenu(false)

    const pendingActions: Array<{ name: string; result?: any }> = []
    setMessages(prev => [...prev, { role: 'assistant', content: '', actions: [] }])

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch(`${apiUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          current_page: pathname,
          page_label: pageCtx.label,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erro na API')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) throw new Error(parsed.error)

            if (parsed.action && !parsed.action_result) {
              pendingActions.push({ name: parsed.action })
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                  actions: [...pendingActions],
                }
                return updated
              })
            }

            if (parsed.action_result) {
              const idx = pendingActions.findIndex(a => a.name === parsed.action_result && !a.result)
              if (idx !== -1) pendingActions[idx].result = parsed.result
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                  actions: [...pendingActions],
                }
                return updated
              })
            }

            if (parsed.delta) {
              accumulated += parsed.delta
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulated,
                  actions: pendingActions.length > 0 ? [...pendingActions] : undefined,
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Erro: ${err.message}. Verifique se o **OPENAI_API_KEY** está configurado no .env.`,
          }
          return updated
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, streaming, apiUrl, pathname, pageCtx.label])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function startTourPage(path: string, label: string) {
    if (pathname !== path) router.push(path)
    sendMessage(`Estou na página "${label}". Me explique interativamente o que posso fazer aqui.`, true)
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-slate-700 hover:bg-slate-800 scale-90' : 'bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-105 hover:shadow-xl'
        }`}
        title="Copilot Omnilink"
      >
        {open ? <X size={20} className="text-white" /> : <Sparkles size={20} className="text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[420px] max-h-[650px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">Copilot Omnilink</p>
                <p className="text-blue-200 text-[11px] mt-0.5">
                  {pageCtx.label !== 'Plataforma' ? `${pageCtx.label}` : 'IA que executa por você'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isEmpty && (
                <button
                  onClick={() => setMessages([])}
                  title="Nova conversa"
                  className="text-white/60 hover:text-white p-1 rounded transition"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tour strip */}
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setShowTourMenu(v => !v)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                  showTourMenu
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700'
                }`}
              >
                <Compass size={12} /> Tour
              </button>
              <span className="text-slate-200 text-xs">|</span>
              {TOUR_PROMPTS.map(({ label, path, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => startTourPage(path, label)}
                  className={`flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition ${
                    pathname === path || (path !== '/' && pathname.startsWith(path))
                      ? 'bg-blue-50 border border-blue-200 text-blue-600 font-medium'
                      : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tour dropdown */}
          {showTourMenu && (
            <div className="border-b border-slate-100 bg-blue-50 px-4 py-3 flex-shrink-0">
              <p className="text-xs font-semibold text-blue-700 mb-2">Tour interativo:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TOUR_PROMPTS.map(({ label, path, icon: Icon }) => (
                  <button
                    key={path}
                    onClick={() => startTourPage(path, label)}
                    className="flex items-center gap-1.5 text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-2 rounded-lg hover:bg-blue-100 transition font-medium"
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {isEmpty ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles size={12} className="text-blue-600" />
                  </div>
                  <div className="bg-slate-50 rounded-xl rounded-tl-none px-3 py-2.5 text-sm text-slate-700 leading-relaxed">
                    Olá! Sou o <strong>Copilot da Omnilink</strong>. Posso <strong>criar jornadas</strong>, <strong>lançar campanhas</strong> e <strong>consultar métricas</strong> diretamente — além de guiar você pela plataforma.
                    <br /><br />
                    Experimente: <em>"Crie uma jornada de NPS"</em> ou <em>"Qual a taxa de entrega?"</em>
                  </div>
                </div>

                {pageCtx.suggestions.length > 0 && (
                  <div className="pl-8 space-y-1.5">
                    <p className="text-xs text-slate-400 font-medium">Sugestões:</p>
                    {pageCtx.suggestions.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="block w-full text-left text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      {msg.content === '' && streaming && !msg.actions?.length
                        ? <Loader2 size={12} className="text-blue-600 animate-spin" />
                        : <Sparkles size={12} className="text-blue-600" />
                      }
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
                    {/* Action badges */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-2">
                        {msg.actions.map((a, ai) => (
                          <ActionBadge key={ai} action={a.name} result={a.result} />
                        ))}
                      </div>
                    )}
                    {/* Message content */}
                    <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? msg.isAction
                          ? 'bg-blue-50 border border-blue-200 text-blue-700 rounded-tr-none text-xs italic'
                          : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none whitespace-pre-wrap'
                        : 'bg-slate-50 text-slate-700 rounded-tl-none'
                    }`}>
                      {msg.role === 'user'
                        ? msg.content
                        : msg.content
                          ? renderMarkdown(msg.content, navigate)
                          : streaming && i === messages.length - 1
                            ? msg.actions?.length
                              ? <span className="text-xs text-slate-400 italic">Processando ações...</span>
                              : <span className="inline-flex gap-1">
                                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                            : ''
                      }
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Contextual suggestions after reply */}
          {!isEmpty && !streaming && messages[messages.length - 1]?.role === 'assistant' && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {pageCtx.suggestions.slice(0, 2).map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-100 px-3 py-3 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Peça para criar uma jornada, lançar campanha..."
                rows={1}
                disabled={streaming}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-h-32"
                style={{ fieldSizing: 'content' } as any}
              />
              {streaming ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="flex-shrink-0 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl flex items-center justify-center transition"
                >
                  <X size={14} />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-300 mt-1.5 text-center">Enter para enviar · O Copilot pode executar ações na plataforma</p>
          </div>
        </div>
      )}
    </>
  )
}
