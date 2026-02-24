import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

router.get('/', async (req, res) => {
  const { campaign_id, contact_id, status, page = '1', limit = '50' } = req.query
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

  let query = supabase
    .from('journey_executions')
    .select(`
      *,
      contacts(id, name, phone),
      journeys(id, name),
      campaigns(id, name),
      senders(id, name, phone_number)
    `, { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(offset, offset + parseInt(limit as string) - 1)

  if (campaign_id) query = query.eq('campaign_id', campaign_id)
  if (contact_id) query = query.eq('contact_id', contact_id)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw error
  res.json({ data, total: count })
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('journey_executions')
    .select(`
      *,
      contacts(*),
      journeys(*),
      campaigns(*),
      senders(*)
    `)
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Execution not found' }); return }
  res.json(data)
})

router.get('/:id/events', async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('execution_id', req.params.id)
    .order('created_at', { ascending: true })
  if (error) throw error
  res.json(data)
})

router.get('/:id/messages', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('execution_id', req.params.id)
    .order('created_at', { ascending: true })
  if (error) throw error
  res.json(data)
})

export default router
