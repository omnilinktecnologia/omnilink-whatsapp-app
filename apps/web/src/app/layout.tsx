import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Omnilink — WhatsApp Journeys',
  description: 'Plataforma de jornadas interativas no WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
