import { Router } from 'express'
import OpenAI from 'openai'
import { config } from '../config'
import { supabase } from '../lib/supabase'

type ChatCompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam
type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool

const router = Router()

// ─────────────────────────────────────────────────────────────────────────────
// Copilot System Prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Copilot da Omnilink — uma IA avançada capaz de **executar ações** na plataforma de automação de jornadas WhatsApp.

## Suas capacidades

Você pode **agir** na plataforma, não apenas explicar. Quando o usuário pedir para criar algo, lance algo, ou consulte dados, USE AS FERRAMENTAS DISPONÍVEIS para executar a ação diretamente.

### Ações que você pode executar:
- **Criar jornadas completas** com fluxo visual (nós e conexões)
- **Publicar jornadas** para ficarem prontas para uso
- **Criar campanhas** associando jornada + lista + sender
- **Lançar campanhas** para iniciar envios
- **Consultar dados** (contatos, listas, templates, analytics)
- **Gerar fluxos conversacionais** baseados em descrição do usuário

### Como criar jornadas:
Ao criar uma jornada, monte o grafo completo com nós e arestas. Use posições Y crescentes (espaçamento ~120px). Tipos de nós:
- \`start\`: ponto de entrada (sempre primeiro, position y=0)
- \`send_template\`: envia template aprovado (data: { template_id, content_sid, content_variables: {} })
- \`send_message\`: envia texto livre (data: { body: "texto com {{contact.name}}" })
- \`wait_for_reply\`: aguarda resposta (data: { timeout_minutes: 1440 })
- \`condition\`: ramifica fluxo (data: { branches: [{ id, label, expression: "{{last_reply.body}} == '1'" }], default_node_id })
- \`delay\`: pausa (data: { amount: 1, unit: "hours" })
- \`end\`: encerra (data: {})

IDs dos nós: use formato "node_1", "node_2", etc.
IDs das arestas: use formato "edge_1", "edge_2", etc.

## Módulos da plataforma

**Números (Senders)**: números WhatsApp conectados à Twilio
**Contatos**: base de contatos E.164
**Listas**: agrupamento para campanhas
**Templates**: mensagens aprovadas pelo WhatsApp (Twilio Content API)
**Jornadas**: fluxos visuais de conversação
**Campanhas**: envios outbound em massa

## Fluxo recomendado
1. Cadastrar número → 2. Importar contatos → 3. Criar lista → 4. Criar/aprovar template → 5. Criar jornada → 6. Publicar → 7. Criar campanha → 8. Lançar

## Navegação
Inclua links de navegação: [Ir para Jornadas](/journeys)
Rotas: /, /senders, /contacts, /lists, /templates, /journeys, /campaigns, /analytics

## Tom
- Português brasileiro, direto e profissional
- Quando executar uma ação, confirme o resultado e sugira próximos passos
- Seja proativo: se o usuário descreve o que quer, EXECUTE ao invés de apenas explicar como fazer
- Respostas concisas (máx 4 parágrafos, exceto quando pedido explicitamente)`

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Function Tools
// ─────────────────────────────────────────────────────────────────────────────

const COPILOT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_journeys',
      description: 'Lista todas as jornadas existentes com nome, status e tipo de gatilho',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_journey',
      description: 'Cria uma nova jornada de WhatsApp com fluxo conversacional completo (nós e arestas)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome da jornada' },
          description: { type: 'string', description: 'Descrição da jornada' },
          trigger_type: {
            type: 'string',
            enum: ['business_initiated', 'user_initiated'],
            description: 'business_initiated para outbound, user_initiated para inbound',
          },
          nodes: {
            type: 'array',
            description: 'Nós do fluxo',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['start', 'send_template', 'send_message', 'wait_for_reply', 'condition', 'delay', 'end'] },
                position: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' } },
                  required: ['x', 'y'],
                },
                data: { type: 'object', description: 'Dados específicos do tipo de nó' },
              },
              required: ['id', 'type', 'position', 'data'],
            },
          },
          edges: {
            type: 'array',
            description: 'Conexões entre nós',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                source: { type: 'string' },
                target: { type: 'string' },
                sourceHandle: { type: 'string' },
              },
              required: ['id', 'source', 'target'],
            },
          },
        },
        required: ['name', 'trigger_type', 'nodes', 'edges'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'publish_journey',
      description: 'Publica uma jornada, mudando seu status de draft para published',
      parameters: {
        type: 'object',
        properties: {
          journey_id: { type: 'string', description: 'ID da jornada' },
        },
        required: ['journey_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_templates',
      description: 'Lista os templates de mensagem disponíveis com status de aprovação',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_senders',
      description: 'Lista os números WhatsApp (senders) cadastrados',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_contacts',
      description: 'Lista contatos com busca opcional. Retorna contagem e amostra.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por nome ou telefone' },
          limit: { type: 'number', description: 'Limite (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_contact_lists',
      description: 'Lista as listas de contatos com contagem de membros',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_campaign',
      description: 'Cria uma nova campanha de envio outbound. Requer jornada publicada, lista com contatos e sender ativo.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome da campanha' },
          journey_id: { type: 'string', description: 'ID da jornada publicada' },
          list_id: { type: 'string', description: 'ID da lista de contatos' },
          sender_id: { type: 'string', description: 'ID do número sender' },
        },
        required: ['name', 'journey_id', 'list_id', 'sender_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'launch_campaign',
      description: 'Lança uma campanha existente para iniciar o envio imediatamente',
      parameters: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string', description: 'ID da campanha' },
        },
        required: ['campaign_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_campaigns',
      description: 'Lista campanhas com status e progresso',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_analytics',
      description: 'Obtém métricas analíticas: total de contatos, mensagens, taxas de entrega/leitura/resposta, campanhas ativas',
      parameters: { type: 'object', properties: {} },
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Tool Execution
// ─────────────────────────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_journeys': {
      const { data } = await supabase
        .from('journeys')
        .select('id, name, status, trigger_type, description, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      return { journeys: data ?? [], count: data?.length ?? 0 }
    }

    case 'create_journey': {
      const { name: jName, description, trigger_type, nodes, edges } = args as any
      const { data, error } = await supabase
        .from('journeys')
        .insert({
          name: jName,
          description: description ?? '',
          trigger_type: trigger_type ?? 'business_initiated',
          graph: { nodes: nodes ?? [], edges: edges ?? [] },
          status: 'draft',
        })
        .select('id, name, status')
        .single()
      if (error) return { error: error.message }
      return { success: true, journey: data, message: `Jornada "${data.name}" criada com sucesso (ID: ${data.id})` }
    }

    case 'publish_journey': {
      const { journey_id } = args as { journey_id: string }
      const { data: journey } = await supabase
        .from('journeys')
        .select('graph')
        .eq('id', journey_id)
        .single()

      if (!journey) return { error: 'Jornada não encontrada' }

      const graph = journey.graph as { nodes: any[] }
      if (!graph.nodes?.some((n: any) => n.type === 'start')) {
        return { error: 'Jornada precisa ter um nó de início' }
      }

      const { data, error } = await supabase
        .from('journeys')
        .update({ status: 'published' })
        .eq('id', journey_id)
        .select('id, name, status')
        .single()
      if (error) return { error: error.message }
      return { success: true, journey: data }
    }

    case 'list_templates': {
      const { data } = await supabase
        .from('templates')
        .select('id, name, content_sid, content_type, approval_status, language')
        .order('created_at', { ascending: false })
        .limit(30)
      return { templates: data ?? [] }
    }

    case 'list_senders': {
      const { data } = await supabase
        .from('senders')
        .select('id, name, phone_number, twilio_from, is_active')
        .order('created_at', { ascending: false })
      return { senders: data ?? [] }
    }

    case 'list_contacts': {
      const { search, limit: lim } = args as { search?: string; limit?: number }
      const pageSize = Math.min(lim ?? 10, 50)

      let query = supabase.from('contacts').select('id, phone, name, email, created_at', { count: 'exact' })
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
      }
      const { data, count } = await query.order('created_at', { ascending: false }).limit(pageSize)
      return { contacts: data ?? [], total: count ?? 0 }
    }

    case 'list_contact_lists': {
      const { data: lists } = await supabase
        .from('contact_lists')
        .select('id, name, description, created_at')
        .order('created_at', { ascending: false })

      const listsWithCounts = await Promise.all(
        (lists ?? []).map(async (l) => {
          const { count } = await supabase
            .from('contact_list_members')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', l.id)
          return { ...l, member_count: count ?? 0 }
        }),
      )
      return { lists: listsWithCounts }
    }

    case 'create_campaign': {
      const { name: cName, journey_id, list_id, sender_id } = args as any

      const { data: journey } = await supabase
        .from('journeys')
        .select('id, name, status')
        .eq('id', journey_id)
        .single()
      if (!journey) return { error: 'Jornada não encontrada' }
      if (journey.status !== 'published') return { error: `Jornada "${journey.name}" precisa estar publicada (status atual: ${journey.status})` }

      const { count } = await supabase
        .from('contact_list_members')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', list_id)

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: cName,
          journey_id,
          list_id,
          sender_id,
          total_contacts: count ?? 0,
        })
        .select('id, name, status, total_contacts')
        .single()
      if (error) return { error: error.message }
      return { success: true, campaign: data }
    }

    case 'launch_campaign': {
      const { campaign_id } = args as { campaign_id: string }
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .eq('id', campaign_id)
        .single()

      if (!campaign) return { error: 'Campanha não encontrada' }
      if (!['draft', 'scheduled'].includes(campaign.status)) {
        return { error: `Campanha já está ${campaign.status}` }
      }

      await supabase
        .from('campaigns')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', campaign_id)

      await supabase.from('jobs').insert({
        type: 'launch_campaign',
        payload: { campaign_id, batch_offset: 0, batch_size: 50 },
        priority: 8,
      })

      return { success: true, message: `Campanha "${campaign.name}" lançada!` }
    }

    case 'list_campaigns': {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, total_contacts, sent_count, delivered_count, read_count, replied_count, error_count, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      return { campaigns: data ?? [] }
    }

    case 'get_analytics': {
      const [contacts, journeys, campaigns, executions, messages] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('journeys').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('journey_executions').select('status'),
        supabase.from('messages').select('direction, status'),
      ])

      const execStatusCounts = (executions.data ?? []).reduce((acc: Record<string, number>, e: any) => {
        acc[e.status] = (acc[e.status] ?? 0) + 1
        return acc
      }, {})

      const outbound = (messages.data ?? []).filter((m: any) => m.direction === 'outbound')
      const inbound = (messages.data ?? []).filter((m: any) => m.direction === 'inbound')
      const delivered = outbound.filter((m: any) => ['delivered', 'read'].includes(m.status))
      const read = outbound.filter((m: any) => m.status === 'read')

      return {
        contacts_total: contacts.count ?? 0,
        journeys_total: journeys.count ?? 0,
        campaigns_total: campaigns.count ?? 0,
        messages_sent: outbound.length,
        messages_received: inbound.length,
        messages_delivered: delivered.length,
        messages_read: read.length,
        delivery_rate: outbound.length > 0 ? ((delivered.length / outbound.length) * 100).toFixed(1) + '%' : '0%',
        read_rate: outbound.length > 0 ? ((read.length / outbound.length) * 100).toFixed(1) + '%' : '0%',
        response_rate: outbound.length > 0 ? ((inbound.length / outbound.length) * 100).toFixed(1) + '%' : '0%',
        executions_by_status: execStatusCounts,
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat endpoint with function calling
// ─────────────────────────────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  if (!config.openaiApiKey) {
    res.status(503).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' })
    return
  }

  const { messages, current_page, page_label } = req.body as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    current_page?: string
    page_label?: string
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' })
    return
  }

  const openai = new OpenAI({ apiKey: config.openaiApiKey })

  const pageContext = current_page
    ? `\n\nContexto atual: o usuário está na página **${page_label ?? current_page}** (rota: ${current_page}).`
    : ''

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const conversationMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT + pageContext },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    const MAX_TOOL_ROUNDS = 5

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        tools: COPILOT_TOOLS,
        tool_choice: 'auto',
        max_tokens: 2048,
        temperature: 0.3,
      })

      const choice = response.choices[0]
      const msg = choice.message

      if (msg.tool_calls?.length) {
        conversationMessages.push(msg)

        for (const toolCall of msg.tool_calls) {
          if (toolCall.type !== 'function') continue
          const fn = (toolCall as any).function as { name: string; arguments: string }
          const fnName = fn.name
          let fnArgs: Record<string, unknown> = {}
          try {
            fnArgs = JSON.parse(fn.arguments || '{}')
          } catch {}

          res.write(`data: ${JSON.stringify({ action: fnName, args: fnArgs })}\n\n`)

          try {
            const result = await executeTool(fnName, fnArgs)
            res.write(`data: ${JSON.stringify({ action_result: fnName, result })}\n\n`)

            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            })
          } catch (err: any) {
            const errorResult = { error: err.message }
            res.write(`data: ${JSON.stringify({ action_result: fnName, result: errorResult })}\n\n`)
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(errorResult),
            })
          }
        }
        continue
      }

      // No more tool calls -- stream the final text response
      break
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversationMessages,
      stream: true,
      max_tokens: 2048,
      temperature: 0.3,
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

export default router
