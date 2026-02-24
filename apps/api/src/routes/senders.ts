import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { SenderSchema } from '@omnilink/shared'

const router = Router()

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('senders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('senders')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Sender not found' }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const parsed = SenderSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('senders')
    .insert(parsed.data)
    .select()
    .single()
  if (error) throw error
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const parsed = SenderSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('senders')
    .update(parsed.data)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('senders').delete().eq('id', req.params.id)
  if (error) throw error
  res.status(204).end()
})

export default router
