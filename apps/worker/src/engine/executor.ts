import { supabase } from '../lib/supabase'
import { executeNode } from './nodes'
import type { ExecutionContext, JourneyGraph, JourneyNode } from '@omnilink/shared'

/**
 * Advances a journey execution through nodes until it must suspend
 * (wait_for_reply, delay, or end).
 */
export async function advanceExecution(
  executionId: string,
  trigger?: 'start' | 'reply' | 'timeout' | 'delay_done',
): Promise<void> {
  // Load execution
  const { data: exec, error: execErr } = await supabase
    .from('journey_executions')
    .select(`
      *,
      journeys(graph),
      senders(twilio_from)
    `)
    .eq('id', executionId)
    .single()

  if (execErr || !exec) {
    console.error(`[executor] Execution ${executionId} not found:`, execErr?.message)
    return
  }

  if (!['active', 'waiting'].includes(exec.status)) {
    console.log(`[executor] Execution ${executionId} is ${exec.status}, skipping.`)
    return
  }

  const graph = (exec.journeys as any)?.graph as JourneyGraph
  if (!graph) {
    console.error(`[executor] Execution ${executionId} has no journey graph`)
    await markFailed(executionId, 'Journey graph not found')
    return
  }

  const senderFrom: string = (exec.senders as any)?.twilio_from ?? ''
  if (!senderFrom) {
    console.error(`[executor] Execution ${executionId} has no senderFrom (twilio_from) — sender_id=${exec.sender_id}`)
    await markFailed(executionId, 'Sender has no twilio_from configured — cannot send messages')
    return
  }

  // Build execution context
  const ctx: ExecutionContext = {
    contact: {
      id: exec.contact_id,
      ...(exec.variables as any)?.contact ?? {},
      phone: (exec.variables as any)?.contact?.phone ?? '',
    },
    variables: (exec.variables as any)?.variables ?? {},
    last_reply: exec.last_reply ?? undefined,
    campaign: (exec.variables as any)?.campaign,
  }

  // If no current node, find start node
  let currentNodeId = exec.current_node_id
  if (!currentNodeId) {
    const startNode = graph.nodes.find((n: JourneyNode) => n.type === 'start')
    if (!startNode) {
      await markFailed(executionId, 'Journey has no start node')
      return
    }
    currentNodeId = startNode.id
  }

  // Safety: if we're resuming after a reply and current node is still wait_for_reply,
  // advance past it to the next node (process_inbound should have done this, but guard against failures).
  if (trigger === 'reply') {
    const currentNode = graph.nodes.find((n: JourneyNode) => n.id === currentNodeId)
    if (currentNode?.type === 'wait_for_reply') {
      const allEdges = graph.edges.filter((e) => e.source === currentNodeId)
      const mainEdge = allEdges.find((e: any) => !e.sourceHandle || e.sourceHandle === 'default')
        ?? allEdges[0]
      if (mainEdge?.target) {
        console.log(`[executor] Safety: skipping wait_for_reply ${currentNodeId} → ${mainEdge.target}`)
        currentNodeId = mainEdge.target
      } else {
        await markFailed(executionId, `wait_for_reply node ${currentNodeId} has no outgoing edge`)
        return
      }
    }
  }

  // Mark as active
  await supabase
    .from('journey_executions')
    .update({ status: 'active', current_node_id: currentNodeId })
    .eq('id', executionId)

  const MAX_STEPS = 50  // safety limit to prevent infinite loops
  let steps = 0

  console.log(`[executor] Advancing execution ${executionId} from node ${currentNodeId} (trigger=${trigger ?? 'auto'}) | senderFrom=${senderFrom} | last_reply.body="${(ctx.last_reply as any)?.body ?? ''}"`)

  while (currentNodeId && steps < MAX_STEPS) {
    steps++
    const node = graph.nodes.find((n: JourneyNode) => n.id === currentNodeId)

    if (!node) {
      console.error(`[executor] Node ${currentNodeId} not found in graph for execution ${executionId}`)
      await markFailed(executionId, `Node ${currentNodeId} not found in graph`)
      return
    }

    console.log(`[executor] Step ${steps}: executing node ${node.id} (type=${node.type}, label=${(node.data as any)?.label ?? '-'})`)

    await supabase.from('events').insert({
      execution_id: executionId,
      type: 'node_entered',
      node_id: node.id,
      data: { node_type: node.type, trigger: trigger ?? 'auto', step: steps },
    })

    let result
    try {
      result = await executeNode(node, graph, ctx, executionId, senderFrom)
    } catch (err: any) {
      console.error(`[executor] ✕ Error on node ${node.id} (${node.type}): ${err.message}`)
      await supabase.from('events').insert({
        execution_id: executionId,
        type: 'error',
        node_id: node.id,
        data: { error: err.message, stack: err.stack?.slice(0, 500) },
      })
      await markFailed(executionId, err.message)
      return
    }

    console.log(`[executor] ✓ Node ${node.id} completed → next=${result.nextNodeId ?? 'END'} suspend=${!!result.suspend} scheduleAt=${result.scheduleAt ?? '-'}`)

    await supabase.from('events').insert({
      execution_id: executionId,
      type: 'node_completed',
      node_id: node.id,
      data: { next_node_id: result.nextNodeId, suspend: result.suspend, schedule: !!result.scheduleAt },
    })

    // Merge new variables into context
    if (result.newVariables) {
      Object.assign(ctx.variables, result.newVariables)
      await supabase
        .from('journey_executions')
        .update({ variables: { contact: ctx.contact, variables: ctx.variables, campaign: ctx.campaign } })
        .eq('id', executionId)
    }

    // Handle delay: schedule next advance, suspend
    if (result.scheduleAt && result.nextNodeId) {
      await supabase.from('jobs').insert({
        type: 'advance_execution',
        payload: { execution_id: executionId, trigger: 'delay_done' },
        run_at: result.scheduleAt.toISOString(),
      })
      await supabase
        .from('journey_executions')
        .update({
          status: 'waiting',
          current_node_id: result.nextNodeId,
        })
        .eq('id', executionId)
      return
    }

    // Handle suspend (wait_for_reply)
    if (result.suspend) {
      await supabase
        .from('journey_executions')
        .update({ status: 'waiting', current_node_id: node.id })
        .eq('id', executionId)
      return
    }

    // No next node = completed
    if (!result.nextNodeId) {
      await supabase
        .from('journey_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          current_node_id: null,
        })
        .eq('id', executionId)

      await supabase.from('events').insert({
        execution_id: executionId,
        type: 'journey_completed',
        data: {},
      })
      return
    }

    currentNodeId = result.nextNodeId

    await supabase
      .from('journey_executions')
      .update({ current_node_id: currentNodeId })
      .eq('id', executionId)
  }

  if (steps >= MAX_STEPS) {
    await markFailed(executionId, 'Max steps exceeded — possible infinite loop')
  }
}

async function markFailed(executionId: string, reason: string): Promise<void> {
  await supabase
    .from('journey_executions')
    .update({ status: 'failed' })
    .eq('id', executionId)

  await supabase.from('events').insert({
    execution_id: executionId,
    type: 'error',
    data: { error: reason },
  })
}
