import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { CampaignSchema } from '@omnilink/shared'

const router = Router()

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      journeys(id, name),
      contact_lists(id, name),
      senders(id, name, phone_number)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      journeys(*),
      contact_lists(*),
      senders(*)
    `)
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Campaign not found' }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const parsed = CampaignSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  // Get contact count for this list
  const { count } = await supabase
    .from('contact_list_members')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', parsed.data.list_id)

  const { data, error } = await supabase
    .from('campaigns')
    .insert({ ...parsed.data, total_contacts: count ?? 0 })
    .select()
    .single()
  if (error) throw error
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const parsed = CampaignSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('campaigns')
    .update(parsed.data)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

// Launch campaign (enqueue job)
router.post('/:id/launch', async (req, res) => {
  const { data: campaign, error: fetchErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (fetchErr) { res.status(404).json({ error: 'Campaign not found' }); return }

  if (!['draft', 'scheduled'].includes(campaign.status)) {
    res.status(400).json({ error: `Campaign is already ${campaign.status}` }); return
  }

  // Update campaign status and enqueue launch job
  const { error: updateErr } = await supabase
    .from('campaigns')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', req.params.id)
  if (updateErr) throw updateErr

  const { error: jobErr } = await supabase.from('jobs').insert({
    type: 'launch_campaign',
    payload: { campaign_id: req.params.id, batch_offset: 0, batch_size: 50 },
    priority: 8,
  })
  if (jobErr) throw jobErr

  res.json({ message: 'Campaign launched', campaign_id: req.params.id })
})

// Cancel campaign
router.post('/:id/cancel', async (req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

// Campaign stats
router.get('/:id/stats', async (req, res) => {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Campaign not found' }); return }

  const { data: execStats } = await supabase
    .from('journey_executions')
    .select('status')
    .eq('campaign_id', req.params.id)

  const statusCounts = (execStats ?? []).reduce((acc: Record<string, number>, e: any) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})

  res.json({ ...campaign, execution_stats: statusCounts })
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id)
  if (error) throw error
  res.status(204).end()
})

export default router
