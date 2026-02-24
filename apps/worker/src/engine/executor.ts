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
    console.error(`[executor] Execution ${executionId} has no senderFrom (twilio_from) — check sender record`)
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

  // Mark as active
  await supabase
    .from('journey_executions')
    .update({ status: 'active', current_node_id: currentNodeId })
    .eq('id', executionId)

  const MAX_STEPS = 50  // safety limit to prevent infinite loops
  let steps = 0

  console.log(`[executor] Advancing execution ${executionId} from node ${currentNodeId} (trigger=${trigger ?? 'auto'})`)

  while (currentNodeId && steps < MAX_STEPS) {
    steps++
    const node = graph.nodes.find((n: JourneyNode) => n.id === currentNodeId)

    if (!node) {
      console.error(`[executor] Node ${currentNodeId} not found in graph for execution ${executionId}`)
      await markFailed(executionId, `Node ${currentNodeId} not found in graph`)
      return
    }

    console.log(`[executor] Executing node ${node.id} (type=${node.type})`)


    await supabase.from('events').insert({
      execution_id: executionId,
      type: 'node_entered',
      node_id: node.id,
      data: { node_type: node.type, trigger: trigger ?? 'auto' },
    })

    let result
    try {
      result = await executeNode(node, graph, ctx, executionId, senderFrom)
    } catch (err: any) {
      console.error(`[executor] Error executing node ${node.id}:`, err.message)
      await supabase.from('events').insert({
        execution_id: executionId,
        type: 'error',
        node_id: node.id,
        data: { error: err.message },
      })
      await markFailed(executionId, err.message)
      return
    }

    await supabase.from('events').insert({
      execution_id: executionId,
      type: 'node_completed',
      node_id: node.id,
      data: { next_node_id: result.nextNodeId },
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
