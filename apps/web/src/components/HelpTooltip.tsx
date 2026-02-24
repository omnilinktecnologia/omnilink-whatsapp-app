'use client'

import { useState, useRef, useEffect } from 'react'

interface HelpTooltipProps {
  content: string | React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  width?: number
}

export function HelpTooltip({ content, position = 'top', width = 260 }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const posClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent',
  }

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 hover:bg-blue-100 text-slate-500 hover:text-blue-600 text-[10px] font-bold leading-none transition focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Ajuda"
      >
        ?
      </button>

      {visible && (
        <span
          className={`absolute z-50 ${posClasses[position]}`}
          style={{ width }}
        >
          <span className="block bg-slate-800 text-white text-xs rounded-lg px-3 py-2 leading-relaxed shadow-xl">
            {content}
          </span>
          <span
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
          />
        </span>
      )}
    </span>
  )
}

interface PageHintProps {
  title: string
  steps: string[]
}

export function PageHint({ title, steps }: PageHintProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
             className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition border border-slate-200 hover:border-blue-300 rounded-lg px-3 py-1.5 bg-white hover:bg-blue-50"
             >
               Como usar
             </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-slate-600">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
