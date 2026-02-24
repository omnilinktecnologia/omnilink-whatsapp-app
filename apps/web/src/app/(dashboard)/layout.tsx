'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Smartphone, Users, List,
  FolderOpen, GitBranch, Megaphone, LogOut, ShieldCheck, ClipboardList,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FloatingAssistant from '@/components/FloatingAssistant'

const NAV = [
  { href: '/',           label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/senders',   label: 'Números',      icon: Smartphone },
  { href: '/contacts',  label: 'Contatos',     icon: Users },
  { href: '/lists',     label: 'Listas',       icon: List },
  { href: '/templates', label: 'Templates',    icon: FolderOpen },
  { href: '/journeys',  label: 'Jornadas',     icon: GitBranch },
  { href: '/campaigns',      label: 'Campanhas',        icon: Megaphone },
  { href: '/flow-responses', label: 'Respostas Flows',  icon: ClipboardList },
]

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white">Omnilink</h1>
          <p className="text-xs text-slate-400 mt-0.5">WhatsApp Journeys</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
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

          {/* Admin section */}
          <div className="pt-3 mt-2 border-t border-slate-700">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
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

        <div className="px-4 py-4 border-t border-slate-700">
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

      {/* AI Assistant */}
      <FloatingAssistant />
    </div>
  )
}
