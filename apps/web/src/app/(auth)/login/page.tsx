'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <span className="text-white text-xl font-bold">Omnilink</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Jornadas inteligentes no WhatsApp
          </h2>
          <p className="text-blue-200 text-lg leading-relaxed">
            Crie fluxos conversacionais, lance campanhas e monitore resultados com um copilot de IA integrado.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Copilot com IA que executa ações',
              'Builder visual drag-and-drop',
              'Analytics de entrega, leitura e resposta',
            ].map(feature => (
              <div key={feature} className="flex items-center gap-2 text-blue-100">
                <ArrowRight size={14} className="text-blue-300" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-300 text-xs">Powered by Twilio WhatsApp API + OpenAI</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white mb-4">
              <Sparkles size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Omnilink</h1>
            <p className="text-gray-500 text-sm mt-1">WhatsApp Journey Platform</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Entrar</h2>
            <p className="text-gray-500 text-sm mb-6">Acesse sua conta para gerenciar jornadas</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg py-2.5 transition disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Não tem uma conta?{' '}
              <Link href="/signup" className="text-blue-600 hover:underline font-medium">
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
