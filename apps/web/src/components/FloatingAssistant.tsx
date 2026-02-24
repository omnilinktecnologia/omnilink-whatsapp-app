'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Bot, X, Send, RotateCcw, Loader2, Sparkles,
  LayoutDashboard, Smartphone, Users, List,
  FolderOpen, GitBranch, Megaphone, Compass,
} from 'lucide-react'

// ── Page context map ──────────────────────────────────────────────────────────

const PAGE_CONTEXT: Record<string, { label: string; suggestions: string[] }> = {
  '/': {
    label: 'Dashboard',
    suggestions: [
      'O que significam os números no dashboard?',
      'Por onde devo começar?',
      'Me explique o fluxo completo da plataforma',
    ],
  },
  '/senders': {
    label: 'Números WhatsApp',
    suggestions: [
      'Como adiciono um número aqui?',
      'O que é o campo Twilio From?',
      'Onde encontro o "From" no console da Twilio?',
    ],
  },
  '/contacts': {
    label: 'Contatos',
    suggestions: [
      'Como importar contatos via CSV?',
      'Qual formato usar no número de telefone?',
      'Posso editar um contato depois de importado?',
    ],
  },
  '/lists': {
    label: 'Listas',
    suggestions: [
      'Para que serve uma lista?',
      'Como adiciono contatos a uma lista?',
      'Uma lista pode ser usada em várias campanhas?',
    ],
  },
  '/templates': {
    label: 'Templates',
    suggestions: [
      'Como criar um template de mensagem?',
      'O que é necessário para aprovação?',
      'Como importar templates da Twilio?',
    ],
  },
  '/journeys': {
    label: 'Jornadas',
    suggestions: [
      'Como criar minha primeira jornada?',
      'Qual a diferença entre Business e User Initiated?',
      'Me explique os tipos de bloco disponíveis',
    ],
  },
  '/campaigns': {
    label: 'Campanhas',
    suggestions: [
      'Como lançar uma campanha agora?',
      'Quais são os pré-requisitos para criar uma campanha?',
      'Como acompanho o progresso do envio?',
    ],
  },
}

// ── Quick tour prompts ────────────────────────────────────────────────────────

const TOUR_PROMPTS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Números',   path: '/senders',   icon: Smartphone },
  { label: 'Contatos',  path: '/contacts',  icon: Users },
  { label: 'Listas',    path: '/lists',     icon: List },
  { label: 'Templates', path: '/templates', icon: FolderOpen },
  { label: 'Jornadas',  path: '/journeys',  icon: GitBranch },
  { label: 'Campanhas', path: '/campaigns', icon: Megaphone },
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
  // Match **bold**, *italic*, `code`, [label](/path) nav links
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
        // Navigation link: [label](/path)
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  isAction?: boolean
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

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

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
          messages: newMessages,
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
            if (parsed.delta) {
              accumulated += parsed.delta
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: accumulated }
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
    sendMessage(`Estou na página "${label}". Me explique interativamente o que posso fazer aqui e como usar cada funcionalidade, incluindo links para navegar quando relevante.`, true)
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-slate-700 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
        }`}
        title="Assistente Omnilink"
      >
        {open ? <X size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[390px] max-h-[620px] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">Assistente Omnilink</p>
                <p className="text-blue-200 text-[11px] mt-0.5">
                  {pageCtx.label !== 'Plataforma' ? `Página atual: ${pageCtx.label}` : 'powered by ChatGPT'}
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

          {/* Tour menu strip */}
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
              <p className="text-xs font-semibold text-blue-700 mb-2">Tour interativo — escolha uma seção:</p>
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
                {/* Welcome */}
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={13} className="text-blue-600" />
                  </div>
                  <div className="bg-slate-50 rounded-xl rounded-tl-none px-3 py-2.5 text-sm text-slate-700 leading-relaxed">
                    Olá! Sou o assistente da Omnilink. Posso te guiar pela plataforma de forma interativa, navegar entre as páginas enquanto explico, ou responder qualquer dúvida.
                    <br /><br />
                    Use os botões acima para iniciar um tour por qualquer seção, ou me pergunte algo diretamente.
                  </div>
                </div>

                {/* Contextual suggestions */}
                {pageCtx.suggestions.length > 0 && (
                  <div className="pl-8 space-y-1.5">
                    <p className="text-xs text-slate-400 font-medium">Sugestões para {pageCtx.label}:</p>
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
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      {msg.content === '' && streaming
                        ? <Loader2 size={12} className="text-blue-600 animate-spin" />
                        : <Bot size={13} className="text-blue-600" />
                      }
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? msg.isAction
                        ? 'bg-blue-50 border border-blue-200 text-blue-700 rounded-tr-none text-xs italic'
                        : 'bg-blue-600 text-white rounded-tr-none whitespace-pre-wrap'
                      : 'bg-slate-50 text-slate-700 rounded-tl-none'
                  }`}>
                    {msg.role === 'user'
                      ? msg.content
                      : msg.content
                        ? renderMarkdown(msg.content, navigate)
                        : streaming && i === messages.length - 1
                          ? <span className="inline-flex gap-1">
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          : ''
                    }
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
                placeholder="Pergunte algo ou peça para navegar..."
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
                  className="flex-shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </div>
      )}
    </>
  )
}
