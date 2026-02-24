'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { journeysApi } from '@/lib/api'
import Builder from '@/components/journey-builder/Builder'
import { STATUS_COLORS } from '@/lib/utils'
import { ChevronLeft, Building2, User } from 'lucide-react'

export default function JourneyBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [journey, setJourney] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const j = await journeysApi.get(id)
    setJourney(j)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!journey) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>Jornada não encontrada</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/journeys')} className="flex items-center gap-1 text-gray-400 hover:text-gray-700 text-sm">
            <ChevronLeft size={15} /> Voltar
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">{journey.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[journey.status] ?? ''}`}>{journey.status}</span>
              <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {journey.trigger_type === 'business_initiated' ? <><Building2 size={11} /> Business</> : <><User size={11} /> User</>}
              </span>
            </div>
            {journey.description && <p className="text-xs text-gray-400">{journey.description}</p>}
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Arraste blocos da esquerda para o canvas • Clique para configurar • Delete para remover
        </div>
      </div>

      {/* Builder */}
      <div className="flex-1 overflow-hidden">
        <Builder
          journeyId={id}
          journeyName={journey.name}
          initialGraph={journey.graph}
          onStatusChange={load}
        />
      </div>
    </div>
  )
}
