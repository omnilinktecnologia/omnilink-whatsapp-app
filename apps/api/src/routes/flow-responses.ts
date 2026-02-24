import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// ── Campaign-level aggregated stats ────────────────────────────────────────
// GET /api/flow-responses/stats?campaign_id=xxx
// Returns: { campaigns: [{ campaign_id, campaign_name, total, fields: { fieldName: { value: count } } }] }
router.get('/stats', async (req, res) => {
  const { campaign_id } = req.query

  let query = supabase
    .from('flow_responses')
    .select(`
      id,
      campaign_id,
      response_data,
      campaigns(id, name)
    `)
    .not('campaign_id', 'is', null)

  if (campaign_id) query = (query as any).eq('campaign_id', campaign_id)

  const { data, error } = await query
  if (error) throw error

  // Aggregate in-memory: group by campaign → field → value → count
  const campaignMap = new Map<string, {
    campaign_id: string
    campaign_name: string
    total: number
    fields: Record<string, Record<string, number>>
  }>()

  for (const row of (data ?? []) as any[]) {
    const cid   = row.campaign_id
    const cname = row.campaigns?.name ?? cid

    if (!campaignMap.has(cid)) {
      campaignMap.set(cid, { campaign_id: cid, campaign_name: cname, total: 0, fields: {} })
    }
    const entry = campaignMap.get(cid)!
    entry.total++

    const rd = (row.response_data ?? {}) as Record<string, unknown>
    for (const [key, val] of Object.entries(rd)) {
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')
      if (!entry.fields[key]) entry.fields[key] = {}
      entry.fields[key][strVal] = (entry.fields[key][strVal] ?? 0) + 1
    }
  }

  res.json({ campaigns: Array.from(campaignMap.values()) })
})

// List flow responses with contact + journey info
router.get('/', async (req, res) => {
  const { journey_id, contact_id, page = '1', limit = '50' } = req.query
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

  let query = supabase
    .from('flow_responses')
    .select(`
      *,
      contacts(id, name, phone),
      journeys(id, name)
    `, { count: 'exact' })
    .order('received_at', { ascending: false })
    .range(offset, offset + parseInt(limit as string) - 1)

  if (journey_id) query = query.eq('journey_id', journey_id)
  if (contact_id) query = query.eq('contact_id', contact_id)

  const { data, error, count } = await query
  if (error) throw error
  res.json({ data, total: count })
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('flow_responses')
    .select(`*, contacts(id, name, phone), journeys(id, name)`)
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Not found' }); return }
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('flow_responses').delete().eq('id', req.params.id)
  if (error) throw error
  res.status(204).end()
})

export default router
