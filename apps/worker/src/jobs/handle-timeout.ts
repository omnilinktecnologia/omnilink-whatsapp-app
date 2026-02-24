import { supabase } from '../lib/supabase'
import { advanceExecution } from '../engine/executor'
import type { HandleTimeoutPayload } from '@omnilink/shared'

export async function handleTimeout(payload: HandleTimeoutPayload): Promise<void> {
  const { data: exec } = await supabase
    .from('journey_executions')
    .select('status, current_node_id')
    .eq('id', payload.execution_id)
    .single()

  // Only timeout if still waiting at the same node
  if (!exec || exec.status !== 'waiting' || exec.current_node_id !== payload.node_id) {
    console.log(`[timeout] Execution ${payload.execution_id} already moved past node ${payload.node_id}`)
    return
  }

  // Load journey graph to find timeout node
  const { data: execution } = await supabase
    .from('journey_executions')
    .select('journeys(graph)')
    .eq('id', payload.execution_id)
    .single()

  const graph = (execution?.journeys as any)?.graph
  const node = graph?.nodes?.find((n: any) => n.id === payload.node_id)
  const timeoutNodeId = node?.data?.timeout_node_id

  await supabase.from('events').insert({
    execution_id: payload.execution_id,
    type: 'node_completed',
    node_id: payload.node_id,
    data: { reason: 'timeout', next_node_id: timeoutNodeId ?? null },
  })

  if (timeoutNodeId) {
    await supabase
      .from('journey_executions')
      .update({ status: 'active', current_node_id: timeoutNodeId })
      .eq('id', payload.execution_id)

    await advanceExecution(payload.execution_id, 'timeout')
  } else {
    await supabase
      .from('journey_executions')
      .update({ status: 'timed_out', completed_at: new Date().toISOString() })
      .eq('id', payload.execution_id)
  }
}
