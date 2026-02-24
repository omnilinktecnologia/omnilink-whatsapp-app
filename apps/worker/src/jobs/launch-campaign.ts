import { supabase } from '../lib/supabase'
import type { LaunchCampaignPayload } from '@omnilink/shared'

const DEFAULT_BATCH_SIZE = 50

export async function handleLaunchCampaign(payload: LaunchCampaignPayload): Promise<void> {
  const { campaign_id, batch_offset = 0, batch_size = DEFAULT_BATCH_SIZE } = payload

  // Load campaign
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*, journeys(graph, status), senders(id, twilio_from)')
    .eq('id', campaign_id)
    .single()

  if (error || !campaign) {
    console.error(`[launch_campaign] Campaign ${campaign_id} not found`)
    return
  }

  if (campaign.status === 'cancelled') {
    console.log(`[launch_campaign] Campaign ${campaign_id} cancelled, aborting.`)
    return
  }

  const journey = campaign.journeys as any
  if (journey.status !== 'published') {
    console.error(`[launch_campaign] Journey not published for campaign ${campaign_id}`)
    await supabase
      .from('campaigns')
      .update({ status: 'cancelled' })
      .eq('id', campaign_id)
    return
  }

  // Load batch of list members
  const { data: members, error: membersErr } = await supabase
    .from('contact_list_members')
    .select('contacts(*)')
    .eq('list_id', campaign.list_id)
    .range(batch_offset, batch_offset + batch_size - 1)

  if (membersErr) {
    console.error(`[launch_campaign] Error loading members:`, membersErr.message)
    return
  }

  if (!members || members.length === 0) {
    // Done — mark campaign completed
    await supabase
      .from('campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaign_id)
    console.log(`[launch_campaign] Campaign ${campaign_id} completed.`)
    return
  }

  // Create executions and advance jobs for each contact
  const executions = []
  for (const member of members) {
    const contact = (member as any).contacts
    if (!contact || contact.opted_out || !contact.is_active) continue

    // Check if execution already exists (idempotency)
    const { data: existing } = await supabase
      .from('journey_executions')
      .select('id')
      .eq('campaign_id', campaign_id)
      .eq('contact_id', contact.id)
      .maybeSingle()

    if (existing) continue

    const variables = {
      contact: { id: contact.id, phone: contact.phone, name: contact.name, email: contact.email, ...contact.attributes },
      variables: {},
      campaign: { id: campaign_id, name: campaign.name },
    }

    const { data: exec, error: execErr } = await supabase
      .from('journey_executions')
      .insert({
        journey_id: campaign.journey_id,
        campaign_id,
        contact_id: contact.id,
        sender_id: campaign.sender_id,
        status: 'active',
        variables,
      })
      .select('id')
      .single()

    if (execErr || !exec) {
      console.error(`[launch_campaign] Failed to create execution for contact ${contact.id}:`, execErr?.message)
      continue
    }

    executions.push(exec.id)
  }

  // Enqueue advance jobs for all created executions
  if (executions.length > 0) {
    const jobs = executions.map((id) => ({
      type: 'advance_execution',
      payload: { execution_id: id, trigger: 'start' },
      priority: 5,
    }))
    await supabase.from('jobs').insert(jobs)

    // Update sent_count
    void supabase.rpc('increment_by', {
      table_name: 'campaigns',
      row_id: campaign_id,
      column_name: 'sent_count',
      amount: executions.length,
    })
  }

  // If there are more members, enqueue next batch
  if (members.length === batch_size) {
    await supabase.from('jobs').insert({
      type: 'launch_campaign',
      payload: { campaign_id, batch_offset: batch_offset + batch_size, batch_size },
      priority: 7,
    })
  } else {
    // Last batch — mark campaign completed
    await supabase
      .from('campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaign_id)
  }
}
