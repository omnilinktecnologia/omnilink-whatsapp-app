'use client'

import { Plus, Trash2, Link2, Phone } from 'lucide-react'

// ── Default values per type ───────────────────────────────────────────────────

export function getDefaultContentDef(type: string): Record<string, unknown> {
  switch (type) {
    case 'twilio/text':
      return { body: '' }
    case 'twilio/media':
      return { body: '', media: [{ url: '' }] }
    case 'twilio/quick-reply':
      return { body: '', actions: [{ type: 'QUICK_REPLY', title: '' }] }
    case 'twilio/call-to-action':
      return { body: '', actions: [{ type: 'URL', title: '', url: '' }] }
    case 'twilio/card':
      return { title: '', subtitle: '', media: [{ url: '' }], actions: [] }
    case 'twilio/carousel':
      return { cards: [{ title: '', body: '', media: [{ url: '' }], actions: [] }] }
    case 'twilio/catalog':
      return { body: '', action: { id: '', title: 'Ver catálogo', thumbnail_url: '' } }
    case 'twilio/flows':
      return { body: '', flow_id: '', flow_cta: 'Iniciar', flow_type: 'NAVIGATE' }
    case 'whatsapp/flows':
      return {
        body: '',
        button_text: 'Começar',
        flow_id: '',
        flow_token: '{{1}}',
        flow_first_page_id: '',
        subtitle: '',
        media_url: '',
        is_flow_first_page_endpoint: false,
      }
    case 'whatsapp/authentication':
      return { code_expiration_minutes: 10, actions: [{ type: 'COPY_CODE', copy_code_text: 'Copiar código' }] }
    default:
      return {}
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const lbl = 'block text-xs font-medium text-gray-600 mb-1'

// ── Shared sub-components ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}

function BodyField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={lbl}>Mensagem *</label>
      <textarea
        className={inp}
        rows={3}
        placeholder={placeholder ?? 'Olá {{1}}, bem-vindo!'}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <p className="text-xs text-gray-400 mt-1">Use {'{{1}}'}, {'{{2}}'} para variáveis dinâmicas.</p>
    </div>
  )
}

function MediaField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={lbl}>URL da mídia</label>
      <input
        className={inp}
        placeholder="https://example.com/image.jpg"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <p className="text-xs text-gray-400 mt-1">URL pública de imagem, vídeo ou documento.</p>
    </div>
  )
}

// ── Action button editors ─────────────────────────────────────────────────────

type ActionType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'

interface ActionEditorProps {
  actions: any[]
  onChange: (actions: any[]) => void
  allowTypes?: ActionType[]
  maxButtons?: number
  label?: string
}

function ActionEditor({ actions, onChange, allowTypes = ['QUICK_REPLY'], maxButtons = 3, label = 'Botões' }: ActionEditorProps) {
  const multiType = allowTypes.length > 1

  function addAction() {
    const defaultAction = allowTypes[0] === 'URL'
      ? { type: 'URL', title: '', url: '' }
      : allowTypes[0] === 'PHONE_NUMBER'
      ? { type: 'PHONE_NUMBER', title: '', phone: '' }
      : { type: 'QUICK_REPLY', title: '' }
    onChange([...actions, defaultAction])
  }

  function updateAction(i: number, updates: object) {
    const arr = [...actions]
    arr[i] = { ...arr[i], ...updates }
    onChange(arr)
  }

  function removeAction(i: number) {
    const arr = [...actions]
    arr.splice(i, 1)
    onChange(arr)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={lbl + ' mb-0'}>{label}</label>
        {actions.length < maxButtons && (
          <button
            type="button"
            onClick={addAction}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus size={12} /> Adicionar
          </button>
        )}
      </div>

      {actions.length === 0 && (
        <p className="text-xs text-gray-400 italic py-1">Nenhum botão. Clique em "Adicionar" para criar (máx. {maxButtons}).</p>
      )}

      <div className="space-y-2">
        {actions.map((a, i) => (
          <div key={i} className="border border-gray-200 rounded-xl bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Botão {i + 1}</span>
              <button type="button" onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600 text-xs hover:underline">
                Remover
              </button>
            </div>

            {multiType && (
              <div>
                <label className={lbl}>Tipo</label>
                <select
                  className={inp}
                  value={a.type}
                  onChange={e => updateAction(i, { type: e.target.value, url: '', phone: '' })}
                >
                  {allowTypes.includes('QUICK_REPLY') && <option value="QUICK_REPLY">Resposta rápida</option>}
                  {allowTypes.includes('URL') && <option value="URL">Link (URL)</option>}
                  {allowTypes.includes('PHONE_NUMBER') && <option value="PHONE_NUMBER">Ligar (telefone)</option>}
                </select>
              </div>
            )}

            <div>
              <label className={lbl}>Texto do botão</label>
              <div className="relative">
                <input
                  className={inp}
                  placeholder={a.type === 'URL' ? 'Acessar site' : a.type === 'PHONE_NUMBER' ? 'Ligar agora' : 'Ex: Sim, Não, Talvez'}
                  maxLength={25}
                  value={a.title ?? ''}
                  onChange={e => updateAction(i, { title: e.target.value })}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 select-none">
                  {(a.title ?? '').length}/25
                </span>
              </div>
            </div>

            {a.type === 'URL' && (
              <div>
                <label className={lbl}><Link2 size={10} className="inline mr-1" />URL de destino</label>
                <input
                  className={inp}
                  placeholder="https://example.com"
                  value={a.url ?? ''}
                  onChange={e => updateAction(i, { url: e.target.value })}
                />
              </div>
            )}

            {a.type === 'PHONE_NUMBER' && (
              <div>
                <label className={lbl}><Phone size={10} className="inline mr-1" />Número de telefone</label>
                <input
                  className={inp}
                  placeholder="+5511999999999"
                  value={a.phone ?? ''}
                  onChange={e => updateAction(i, { phone: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card editor (used by twilio/card and each carousel card) ──────────────────

interface CardEditorProps {
  card: any
  onChange: (card: any) => void
  showRemove?: boolean
  onRemove?: () => void
  index?: number
}

function CardEditor({ card, onChange, showRemove, onRemove, index }: CardEditorProps) {
  function set(key: string, value: unknown) {
    onChange({ ...card, [key]: value })
  }

  const actions = (card.actions as any[]) ?? []

  return (
    <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 space-y-3">
      {showRemove && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-600">Card {(index ?? 0) + 1}</span>
          <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs hover:underline">
            Remover card
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Título</label>
          <input className={inp} placeholder="Título do card" value={card.title ?? ''} onChange={e => set('title', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>URL da imagem</label>
          <input
            className={inp}
            placeholder="https://example.com/img.jpg"
            value={card.media?.[0]?.url ?? ''}
            onChange={e => set('media', [{ url: e.target.value }])}
          />
        </div>
      </div>

      <div>
        <label className={lbl}>Texto do card</label>
        <textarea
          className={inp}
          rows={2}
          placeholder="Descrição ou mensagem..."
          value={card.body ?? ''}
          onChange={e => set('body', e.target.value)}
        />
      </div>

      <ActionEditor
        actions={actions}
        onChange={v => set('actions', v)}
        allowTypes={['QUICK_REPLY', 'URL', 'PHONE_NUMBER']}
        maxButtons={2}
        label="Botões do card"
      />
    </div>
  )
}

// ── Main Editor ───────────────────────────────────────────────────────────────

interface ContentDefinitionEditorProps {
  contentType: string
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}

export default function ContentDefinitionEditor({ contentType, value, onChange }: ContentDefinitionEditorProps) {
  function set(key: string, val: unknown) {
    onChange({ ...value, [key]: val })
  }

  const body = (value.body as string) ?? ''

  // ── twilio/text ────────────────────────────────────────────────
  if (contentType === 'twilio/text') {
    return <BodyField value={body} onChange={v => set('body', v)} />
  }

  // ── twilio/media ───────────────────────────────────────────────
  if (contentType === 'twilio/media') {
    const mediaUrl = (value.media as any[])?.[0]?.url ?? ''
    return (
      <div className="space-y-4">
        <MediaField value={mediaUrl} onChange={v => set('media', [{ url: v }])} />
        <div>
          <label className={lbl}>Legenda (opcional)</label>
          <input className={inp} placeholder="Confira nossa oferta!" value={body} onChange={e => set('body', e.target.value)} />
        </div>
      </div>
    )
  }

  // ── twilio/quick-reply ─────────────────────────────────────────
  if (contentType === 'twilio/quick-reply') {
    const actions = (value.actions as any[]) ?? []
    return (
      <div className="space-y-4">
        <BodyField value={body} onChange={v => set('body', v)} placeholder="Como posso ajudar?" />
        <ActionEditor
          actions={actions}
          onChange={v => set('actions', v)}
          allowTypes={['QUICK_REPLY']}
          maxButtons={3}
          label="Botões de resposta rápida (máx. 3)"
        />
      </div>
    )
  }

  // ── twilio/call-to-action ──────────────────────────────────────
  if (contentType === 'twilio/call-to-action') {
    const actions = (value.actions as any[]) ?? []
    return (
      <div className="space-y-4">
        <BodyField value={body} onChange={v => set('body', v)} placeholder="Acesse nosso site ou entre em contato." />
        <ActionEditor
          actions={actions}
          onChange={v => set('actions', v)}
          allowTypes={['URL', 'PHONE_NUMBER']}
          maxButtons={2}
          label="Botões de ação (máx. 2)"
        />
      </div>
    )
  }

  // ── twilio/card ────────────────────────────────────────────────
  if (contentType === 'twilio/card') {
    return (
      <CardEditor
        card={value}
        onChange={onChange}
      />
    )
  }

  // ── twilio/carousel ────────────────────────────────────────────
  if (contentType === 'twilio/carousel') {
    const cards = (value.cards as any[]) ?? []

    function updateCard(i: number, card: any) {
      const updated = [...cards]
      updated[i] = card
      set('cards', updated)
    }

    function removeCard(i: number) {
      const updated = [...cards]
      updated.splice(i, 1)
      set('cards', updated)
    }

    function addCard() {
      set('cards', [...cards, { title: '', body: '', media: [{ url: '' }], actions: [] }])
    }

    return (
      <div className="space-y-3">
        {cards.map((card, i) => (
          <CardEditor
            key={i}
            card={card}
            index={i}
            showRemove={cards.length > 1}
            onRemove={() => removeCard(i)}
            onChange={c => updateCard(i, c)}
          />
        ))}
        {cards.length < 10 && (
          <button
            type="button"
            onClick={addCard}
            className="w-full border-2 border-dashed border-gray-300 text-gray-500 text-sm py-2.5 rounded-xl hover:border-blue-400 hover:text-blue-500 transition"
          >
            <Plus size={13} className="inline mr-1" /> Adicionar card
          </button>
        )}
        <p className="text-xs text-gray-400">{cards.length}/10 cards</p>
      </div>
    )
  }

  // ── twilio/catalog ─────────────────────────────────────────────
  if (contentType === 'twilio/catalog') {
    const action = (value.action as any) ?? {}
    return (
      <div className="space-y-4">
        <BodyField value={body} onChange={v => set('body', v)} placeholder="Navegue pelo nosso catálogo!" />
        <Section title="Configuração do catálogo">
          <div className="space-y-3">
            <div>
              <label className={lbl}>ID do catálogo *</label>
              <input
                className={inp}
                placeholder="ID do catálogo no WhatsApp Manager"
                value={action.id ?? ''}
                onChange={e => set('action', { ...action, id: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">Encontre o ID no WhatsApp Manager da Meta.</p>
            </div>
            <div>
              <label className={lbl}>Texto do botão</label>
              <input
                className={inp}
                placeholder="Ver catálogo"
                maxLength={20}
                value={action.title ?? ''}
                onChange={e => set('action', { ...action, title: e.target.value })}
              />
            </div>
            <div>
              <label className={lbl}>URL da thumbnail (opcional)</label>
              <input
                className={inp}
                placeholder="https://example.com/thumb.jpg"
                value={action.thumbnail_url ?? ''}
                onChange={e => set('action', { ...action, thumbnail_url: e.target.value })}
              />
            </div>
          </div>
        </Section>
      </div>
    )
  }

  // ── twilio/flows ───────────────────────────────────────────────
  if (contentType === 'twilio/flows') {
    return (
      <div className="space-y-4">
        <BodyField value={body} onChange={v => set('body', v)} placeholder="Participe da nossa pesquisa!" />
        <Section title="Configuração do Twilio Flow">
          <div className="space-y-3">
            <div>
              <label className={lbl}>Flow ID *</label>
              <input
                className={inp}
                placeholder="ID do flow criado no Twilio"
                value={(value.flow_id as string) ?? ''}
                onChange={e => set('flow_id', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Texto do botão (CTA)</label>
                <input
                  className={inp}
                  placeholder="Iniciar"
                  maxLength={20}
                  value={(value.flow_cta as string) ?? ''}
                  onChange={e => set('flow_cta', e.target.value)}
                />
              </div>
              <div>
                <label className={lbl}>Tipo do flow</label>
                <select
                  className={inp}
                  value={(value.flow_type as string) ?? 'NAVIGATE'}
                  onChange={e => set('flow_type', e.target.value)}
                >
                  <option value="NAVIGATE">NAVIGATE — Navegar</option>
                  <option value="SURVEY">SURVEY — Pesquisa</option>
                  <option value="OTHER">OTHER — Outro</option>
                </select>
              </div>
            </div>
          </div>
        </Section>
      </div>
    )
  }

  // ── whatsapp/flows ─────────────────────────────────────────────
  if (contentType === 'whatsapp/flows') {
    return (
      <div className="space-y-4">
        <BodyField value={body} onChange={v => set('body', v)} placeholder="Por favor, responda nossa pesquisa rápida!" />

        <Section title="Configuração do WhatsApp Flow (Meta)">
          <div className="space-y-3">
            <div>
              <label className={lbl}>Flow ID * <span className="font-normal text-gray-400">(do WhatsApp Manager da Meta)</span></label>
              <input
                className={inp}
                placeholder="ex: 1243440023847104"
                value={(value.flow_id as string) ?? ''}
                onChange={e => set('flow_id', e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Encontre em <strong>WhatsApp Manager → Account Tools → Flows</strong>. O Flow deve estar publicado.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Texto do botão *</label>
                <input
                  className={inp}
                  placeholder="Começar"
                  maxLength={20}
                  value={(value.button_text as string) ?? ''}
                  onChange={e => set('button_text', e.target.value)}
                />
              </div>
              <div>
                <label className={lbl}>ID da primeira tela <span className="font-normal text-gray-400">(flow_first_page_id)</span></label>
                <input
                  className={inp}
                  placeholder="ex: QUESTION_ONE"
                  value={(value.flow_first_page_id as string) ?? ''}
                  onChange={e => set('flow_first_page_id', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Flow Token <span className="font-normal text-gray-400">(variável única por envio)</span></label>
                <input
                  className={inp}
                  placeholder="{'{{1}}'}"
                  value={(value.flow_token as string) ?? ''}
                  onChange={e => set('flow_token', e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Use {'{{1}}'} para gerar um token único por conversa via variável.</p>
              </div>
              <div>
                <label className={lbl}>Subtítulo <span className="font-normal text-gray-400">(opcional, máx. 80 chars)</span></label>
                <input
                  className={inp}
                  placeholder="Leva apenas 2 minutos!"
                  maxLength={80}
                  value={(value.subtitle as string) ?? ''}
                  onChange={e => set('subtitle', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={lbl}>URL de mídia <span className="font-normal text-gray-400">(opcional — .png, .jpg, .mp4, .pdf)</span></label>
              <input
                className={inp}
                placeholder="https://example.com/banner.jpg"
                value={(value.media_url as string) ?? ''}
                onChange={e => set('media_url', e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                checked={(value.is_flow_first_page_endpoint as boolean) ?? false}
                onChange={e => set('is_flow_first_page_endpoint', e.target.checked)}
              />
              <span>Usar endpoint para determinar a primeira tela <span className="text-gray-400 text-xs">(is_flow_first_page_endpoint)</span></span>
            </label>
          </div>
        </Section>
      </div>
    )
  }

  // ── whatsapp/authentication ────────────────────────────────────
  if (contentType === 'whatsapp/authentication') {
    const copyAction = (value.actions as any[])?.[0] ?? { type: 'COPY_CODE', copy_code_text: 'Copiar código' }
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
          O template de autenticação gera e envia um código OTP automaticamente. Configure apenas o tempo de expiração e o texto do botão de cópia.
        </div>
        <div>
          <label className={lbl}>Expiração do código (minutos)</label>
          <input
            type="number"
            min={1}
            max={90}
            className={inp}
            value={(value.code_expiration_minutes as number) ?? 10}
            onChange={e => set('code_expiration_minutes', parseInt(e.target.value) || 10)}
          />
          <p className="text-xs text-gray-400 mt-1">Entre 1 e 90 minutos.</p>
        </div>
        <div>
          <label className={lbl}>Texto do botão "Copiar código"</label>
          <input
            className={inp}
            placeholder="Copiar código"
            maxLength={20}
            value={copyAction.copy_code_text ?? ''}
            onChange={e => set('actions', [{ type: 'COPY_CODE', copy_code_text: e.target.value }])}
          />
        </div>
      </div>
    )
  }

  // ── Fallback ───────────────────────────────────────────────────
  return (
    <p className="text-sm text-gray-400 italic py-2">
      Nenhuma configuração adicional para o tipo <code className="bg-gray-100 px-1 rounded">{contentType}</code>.
    </p>
  )
}
