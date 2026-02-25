'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Smartphone, Users, List,
  FolderOpen, GitBranch, Megaphone, LogOut,
  ShieldCheck, ClipboardList, BarChart3, Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FloatingAssistant from '@/components/FloatingAssistant'

const NAV_MAIN = [
  { href: '/',           label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/analytics',  label: 'Analytics',   icon: BarChart3 },
]

const NAV_DATA = [
  { href: '/senders',   label: 'Números',      icon: Smartphone },
  { href: '/contacts',  label: 'Contatos',     icon: Users },
  { href: '/lists',     label: 'Listas',       icon: List },
  { href: '/templates', label: 'Templates',    icon: FolderOpen },
]

const NAV_AUTOMATION = [
  { href: '/journeys',       label: 'Jornadas',        icon: GitBranch },
  { href: '/campaigns',      label: 'Campanhas',       icon: Megaphone },
  { href: '/flow-responses', label: 'Respostas Flows', icon: ClipboardList },
]

function NavSection({ title, items, pathname }: { title?: string; items: typeof NAV_MAIN; pathname: string }) {
  return (
    <div>
      {title && (
        <p className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">Omnilink</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">WhatsApp Journeys</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <NavSection items={NAV_MAIN} pathname={pathname} />
          <NavSection title="Dados" items={NAV_DATA} pathname={pathname} />
          <NavSection title="Automação" items={NAV_AUTOMATION} pathname={pathname} />

          <div className="pt-2 mt-1 border-t border-slate-700">
            <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Admin
            </p>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname.startsWith('/admin')
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck size={16} />
              Usuários
            </Link>
          </div>
        </nav>

        <div className="px-4 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 truncate mb-2">{user.email}</p>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* AI Copilot */}
      <FloatingAssistant />
    </div>
  )
}
