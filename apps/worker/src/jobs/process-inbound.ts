import { supabase } from '../lib/supabase'
import { advanceExecution } from '../engine/executor'
import type { ProcessInboundPayload } from '@omnilink/shared'

export async function handleProcessInbound(payload: ProcessInboundPayload): Promise<void> {
  const { from, to, body, message_sid, media_urls, received_at } = payload

  console.log(`[process_inbound] Received message from ${from} to ${to} | body="${body}" | sid=${message_sid}`)

  // Find sender by phone number
  const { data: sender } = await supabase
    .from('senders')
    .select('id')
    .eq('phone_number', to)
    .maybeSingle()

  if (!sender) {
    console.warn(`[process_inbound] No sender found for phone ${to} — will search execution without sender filter`)
  }

  // Find or create contact
  let contact: any
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', from)
    .maybeSingle()

  if (existingContact) {
    contact = existingContact
  } else {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ phone: from, attributes: {} })
      .select()
      .single()
    contact = newContact
  }

  if (!contact) {
    console.error(`[process_inbound] Could not resolve contact for phone ${from}`)
    return
  }

  console.log(`[process_inbound] Contact resolved: ${contact.id} (${contact.name ?? 'unnamed'})`)

  // Capture InteractiveData from WhatsApp Flow submissions
  const interactiveData = (payload as any).interactive_data ?? null
  const lastReply = { body: body || (interactiveData ? '[flow_submission]' : ''), sid: message_sid, received_at, interactive_data: interactiveData }

  // Log inbound message
  const { data: message } = await supabase
    .from('messages')
    .insert({
      contact_id: contact.id,
      sender_id: sender?.id,
      direction: 'inbound',
      twilio_sid: message_sid,
      body,
      media_urls: media_urls && media_urls.length > 0 ? media_urls : undefined,
      status: 'received',
    })
    .select('id')
    .single()

  // Save WhatsApp Flow form submission to flow_responses table
  if (interactiveData) {
    const flowId    = interactiveData.flow_id    ?? interactiveData.id    ?? null
    const flowToken = interactiveData.flow_token ?? null
    const screenId  = interactiveData.screen     ?? interactiveData.screen_id ?? null

    // Twilio sends WhatsApp Flow submissions as:
    //   { type: "nfm_reply", response_json: "{\"nps\":\"5\",\"flow_token\":\"...\"}", desc: "..." }
    // Decompose the nested response_json string if present; fall back to .data or the full object.
    let responseData: Record<string, unknown> = interactiveData.data ?? interactiveData
    if (typeof (interactiveData as any).response_json === 'string') {
      try {
        const parsed = JSON.parse((interactiveData as any).response_json)
        if (parsed && typeof parsed === 'object') responseData = parsed
      } catch {
        // keep responseData as-is
      }
    }
    // Strip internal Twilio meta-fields; expand one level of nested objects;
    // shorten dotted keys (e.g. flowResponse.nps → nps) so the DB stores clean field names.
    const META_FIELDS = new Set(['type', 'desc', 'response_json', 'flow_token'])

    // Expand nested objects first
    const rawData: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(responseData)) {
      if (META_FIELDS.has(k)) continue
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
          rawData[nk] = nv
        }
      } else {
        rawData[k] = v
      }
    }

    // Shorten dotted keys (e.g. flowResponse.nps → nps), fall back to full if collision
    const seen = new Set<string>()
    const cleanedData: Record<string, unknown> = {}
    for (const k of Object.keys(rawData)) {
      let sk = k
      if (k.includes('.')) {
        const short = k.split('.').pop()!
        sk = seen.has(short) ? k : short
      }
      seen.add(sk)
      cleanedData[sk] = rawData[k]
    }

    console.log(`[process_inbound] Saving flow response — flow_id=${flowId} screen=${screenId} fields=${Object.keys(cleanedData).join(',')}`)

    // Find the execution to link (if any — might not exist yet before wait_for_reply)
    const { data: activeExec } = await supabase
      .from('journey_executions')
      .select('id, journey_id, campaign_id')
      .eq('contact_id', contact.id)
      .in('status', ['waiting', 'active'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('flow_responses').insert({
      contact_id:    contact.id,
      execution_id:  activeExec?.id          ?? null,
      journey_id:    activeExec?.journey_id  ?? null,
      campaign_id:   (activeExec as any)?.campaign_id ?? null,
      flow_id:       flowId,
      flow_token:    flowToken,
      screen_id:     screenId,
      response_data: cleanedData,
      received_at:   received_at,
    })
  }

  // Find active execution waiting for reply from this contact
  // If sender was found, filter by sender_id; otherwise find any waiting execution for this contact
  let executionQuery = supabase
    .from('journey_executions')
    .select('id, current_node_id, variables, journeys(graph), sender_id')
    .eq('contact_id', contact.id)
    .eq('status', 'waiting')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (sender?.id) {
    executionQuery = executionQuery.eq('sender_id', sender.id)
  }

  const { data: execution } = await executionQuery.maybeSingle()

  if (!execution) {
    console.log(`[process_inbound] No waiting execution found for contact ${contact.id}${sender?.id ? ` / sender ${sender.id}` : ''}`)
  }

  if (execution) {
    console.log(`[process_inbound] Found waiting execution ${execution.id} at node ${execution.current_node_id}`)

    // Update last_reply in execution
    const existingVars = (execution.variables as any) ?? {}
    await supabase
      .from('journey_executions')
      .update({
        last_reply: lastReply,
        status: 'active',
        variables: { ...existingVars, last_reply: lastReply },
      })
      .eq('id', execution.id)

    // Link message to execution
    if (message?.id) {
      await supabase
        .from('messages')
        .update({ execution_id: execution.id })
        .eq('id', message.id)
    }

    await supabase.from('events').insert({
      execution_id: execution.id,
      type: 'reply_received',
      node_id: execution.current_node_id,
      data: { body, sid: message_sid, interactive_data: interactiveData },
    })

    // Find next node after wait_for_reply — prefer main-flow edges over timeout/error handles
    const graph = (execution.journeys as any).graph
    const allEdges = (graph?.edges ?? []).filter((e: any) => e.source === execution.current_node_id)
    const nextEdge = allEdges.find((e: any) => !e.sourceHandle || e.sourceHandle === 'default')
      ?? allEdges[0]

    if (nextEdge?.target) {
      console.log(`[process_inbound] Advancing execution ${execution.id} from ${execution.current_node_id} → ${nextEdge.target} (handle=${nextEdge.sourceHandle ?? 'default'})`)
      await supabase
        .from('journey_executions')
        .update({ current_node_id: nextEdge.target })
        .eq('id', execution.id)
    } else {
      console.error(`[process_inbound] No outgoing edge from wait_for_reply node ${execution.current_node_id} — edges in graph: ${JSON.stringify(allEdges.map((e: any) => ({ source: e.source, target: e.target, handle: e.sourceHandle })))}`)
    }

    await advanceExecution(execution.id, 'reply')
    return
  }

  // No active execution — check for user-initiated journeys triggered by this message
  const { data: userJourneys } = await supabase
    .from('journeys')
    .select('*')
    .eq('trigger_type', 'user_initiated')
    .eq('status', 'published')

  if (!userJourneys || userJourneys.length === 0) return

  for (const journey of userJourneys) {
    const triggerConfig = journey.trigger_config as any
    const shouldTrigger =
      triggerConfig?.any_message === true
      || (Array.isArray(triggerConfig?.keywords) &&
          triggerConfig.keywords.some((kw: string) =>
            body.toLowerCase().includes(kw.toLowerCase())
          ))

    if (!shouldTrigger) continue

    const variables = {
      contact: { id: contact.id, phone: contact.phone, name: contact.name, email: contact.email, ...contact.attributes },
      variables: {},
      last_reply: lastReply,
    }

    const { data: newExec } = await supabase
      .from('journey_executions')
      .insert({
        journey_id: journey.id,
        contact_id: contact.id,
        sender_id: sender?.id ?? journey.default_sender_id,
        status: 'active',
        variables,
        last_reply: lastReply,
      })
      .select('id')
      .single()

    if (newExec) {
      if (message?.id) {
        await supabase
          .from('messages')
          .update({ execution_id: newExec.id })
          .eq('id', message.id)
      }
      await advanceExecution(newExec.id, 'reply')
    }

    break  // Start only the first matching journey
  }
}
