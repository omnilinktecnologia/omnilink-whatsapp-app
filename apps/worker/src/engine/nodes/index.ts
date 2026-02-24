import axios from 'axios'
import { supabase } from '../../lib/supabase'
import { sendTemplate, sendFreeform } from '../../lib/twilio'
import { interpolate, evaluateCondition } from '../interpolator'
import type { ExecutionContext, JourneyNode, JourneyGraph } from '@omnilink/shared'

export interface NodeResult {
  nextNodeId: string | null    // null = end
  newVariables?: Record<string, unknown>
  suspend?: boolean            // true = wait_for_reply, stop processing
  scheduleAt?: Date            // for delay nodes
}

export async function executeNode(
  node: JourneyNode,
  graph: JourneyGraph,
  ctx: ExecutionContext,
  executionId: string,
  senderFrom: string,
): Promise<NodeResult> {
  const contactPhone = ctx.contact.phone

  switch (node.type) {
    case 'start': {
      const firstEdge = graph.edges.find((e) => e.source === node.id)
      return { nextNodeId: firstEdge?.target ?? null }
    }

    case 'send_template': {
      const data = node.data as any

      // Build content variables, skipping entries whose interpolated value is empty
      const contentVariables: Record<string, string> = {}
      for (const [k, v] of Object.entries(data.content_variables ?? {})) {
        const interpolated = interpolate(String(v), ctx)
        if (interpolated !== '') contentVariables[k] = interpolated
      }

      console.log(`[node/send_template] contentSid=${data.content_sid} vars=${JSON.stringify(contentVariables)}`)

      if (!data.content_sid) {
        throw new Error(`send_template node ${node.id} has no content_sid configured`)
      }

      const sid = await sendTemplate({
        to: contactPhone,
        from: senderFrom,
        contentSid: data.content_sid,
        contentVariables: Object.keys(contentVariables).length > 0 ? contentVariables : undefined,
      })

      await supabase.from('messages').insert({
        execution_id: executionId,
        contact_id: ctx.contact.id,
        direction: 'outbound',
        twilio_sid: sid,
        template_sid: data.content_sid,
        status: 'sent',
      })

      const nextEdge = graph.edges.find((e) => e.source === node.id)
      return { nextNodeId: nextEdge?.target ?? null }
    }

    case 'send_message': {
      const data = node.data as any
      const body = interpolate(data.body, ctx)
      const sid = await sendFreeform({ to: contactPhone, from: senderFrom, body })

      await supabase.from('messages').insert({
        execution_id: executionId,
        contact_id: ctx.contact.id,
        direction: 'outbound',
        twilio_sid: sid,
        body,
        status: 'sent',
      })

      const nextEdge = graph.edges.find((e) => e.source === node.id)
      return { nextNodeId: nextEdge?.target ?? null }
    }

    case 'wait_for_reply': {
      const data = node.data as any

      // Schedule timeout job if configured
      if (data.timeout_minutes && data.timeout_minutes > 0) {
        const runAt = new Date(Date.now() + data.timeout_minutes * 60 * 1000)
        await supabase.from('jobs').insert({
          type: 'handle_timeout',
          payload: { execution_id: executionId, node_id: node.id },
          run_at: runAt.toISOString(),
        })
      }

      return { nextNodeId: null, suspend: true }
    }

    case 'condition': {
      const data = node.data as any

      for (const branch of data.branches ?? []) {
        const matched = evaluateCondition(branch.expression, ctx)
        console.log(`[node/condition] branch="${branch.label}" expr="${branch.expression}" → ${matched}`)
        if (matched) {
          await supabase.from('events').insert({
            execution_id: executionId,
            type: 'condition_evaluated',
            node_id: node.id,
            data: { branch_id: branch.id, expression: branch.expression, result: true },
          })
          return { nextNodeId: branch.next_node_id || null }
        }
      }

      // Treat empty string default as no default (avoid stuck executions)
      const defaultNext = data.default_node_id || null
      console.log(`[node/condition] no branch matched — default=${defaultNext ?? 'none (end)'}`)
      return { nextNodeId: defaultNext }
    }

    case 'http_request': {
      const data = node.data as any
      const url = interpolate(data.url ?? '', ctx)

      if (!url) {
        console.warn(`[node/http_request] URL is empty — skipping request`)
        const nextEdge = graph.edges.find((e) => e.source === node.id && e.sourceHandle !== 'error')
          ?? graph.edges.find((e) => e.source === node.id)
        return { nextNodeId: nextEdge?.target ?? null }
      }
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(data.headers ?? {})) {
        headers[k] = interpolate(String(v), ctx)
      }

      let responseData: unknown
      try {
        const response = await axios({
          method: data.method ?? 'GET',
          url,
          headers,
          ...(data.body ? { data: JSON.parse(interpolate(data.body, ctx)) } : {}),
          timeout: 15_000,
        })
        responseData = response.data
      } catch (err: any) {
        await supabase.from('events').insert({
          execution_id: executionId,
          type: 'error',
          node_id: node.id,
          data: { error: err.message, url },
        })
        const errorEdge = graph.edges.find(
          (e) => e.source === node.id && e.sourceHandle === 'error'
        )
        return { nextNodeId: data.on_error_node_id ?? errorEdge?.target ?? null }
      }

      // Map response fields to variables
      const newVariables: Record<string, unknown> = {}
      if (data.response_variable) {
        newVariables[data.response_variable] = responseData
      }
      for (const mapping of data.response_mapping ?? []) {
        const value = getNestedValue(responseData as Record<string, unknown>, mapping.json_path)
        newVariables[mapping.variable_name] = value
      }

      await supabase.from('events').insert({
        execution_id: executionId,
        type: 'http_called',
        node_id: node.id,
        data: { url, method: data.method, variables_set: Object.keys(newVariables) },
      })

      const nextEdge = graph.edges.find(
        (e) => e.source === node.id && e.sourceHandle !== 'error'
      ) ?? graph.edges.find((e) => e.source === node.id)

      return { nextNodeId: nextEdge?.target ?? null, newVariables }
    }

    case 'set_variables': {
      const data = node.data as any
      const newVariables: Record<string, unknown> = {}
      for (const { variable, value } of data.assignments ?? []) {
        newVariables[variable] = interpolate(String(value), ctx)
      }

      const nextEdge = graph.edges.find((e) => e.source === node.id)
      return { nextNodeId: nextEdge?.target ?? null, newVariables }
    }

    case 'delay': {
      const data = node.data as any
      const ms = data.amount * (
        data.unit === 'minutes' ? 60_000
          : data.unit === 'hours' ? 3_600_000
          : 86_400_000
      )
      const scheduleAt = new Date(Date.now() + ms)

      const nextEdge = graph.edges.find((e) => e.source === node.id)
      return { nextNodeId: nextEdge?.target ?? null, scheduleAt }
    }

    case 'end':
    default:
      return { nextNodeId: null }
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((curr: unknown, key: string) => {
    if (curr === null || curr === undefined) return undefined
    return (curr as Record<string, unknown>)[key]
  }, obj)
}
