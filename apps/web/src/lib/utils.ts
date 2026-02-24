import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatPhone(phone: string) {
  // +55 11 99999-9999
  const d = phone.replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,9)}-${d.slice(9)}`
  return phone
}

export const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived:  'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  running:   'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  active:    'bg-blue-100 text-blue-700',
  waiting:   'bg-yellow-100 text-yellow-700',
  failed:    'bg-red-100 text-red-700',
  timed_out: 'bg-orange-100 text-orange-700',
  approved:  'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  rejected:  'bg-red-100 text-red-700',
  unsubmitted: 'bg-gray-100 text-gray-600',
}

export const APPROVAL_LABELS: Record<string, string> = {
  unsubmitted: 'Não enviado',
  pending:     'Em análise',
  approved:    'Aprovado',
  rejected:    'Rejeitado',
  paused:      'Pausado',
  disabled:    'Desabilitado',
}
