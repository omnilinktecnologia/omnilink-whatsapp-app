import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { ListSchema } from '@omnilink/shared'

const router = Router()

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('contact_lists')
    .select(`*, contact_list_members(count)`)
    .order('created_at', { ascending: false })
  if (error) throw error
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('contact_lists')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'List not found' }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const parsed = ListSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('contact_lists')
    .insert(parsed.data)
    .select()
    .single()
  if (error) throw error
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const parsed = ListSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('contact_lists')
    .update(parsed.data)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('contact_lists').delete().eq('id', req.params.id)
  if (error) throw error
  res.status(204).end()
})

// ── Members ───────────────────────────────────────────────────────────────────
router.get('/:id/members', async (req, res) => {
  const { page = '1', limit = '50' } = req.query
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

  const { data, error, count } = await supabase
    .from('contact_list_members')
    .select('*, contacts(*)', { count: 'exact' })
    .eq('list_id', req.params.id)
    .range(offset, offset + parseInt(limit as string) - 1)
  if (error) throw error
  res.json({ data, total: count })
})

router.post('/:id/members', async (req, res) => {
  const { contact_ids } = req.body as { contact_ids: string[] }
  if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
    res.status(400).json({ error: 'contact_ids must be a non-empty array' }); return
  }

  const rows = contact_ids.map((cid) => ({ list_id: req.params.id, contact_id: cid }))
  const { data, error } = await supabase
    .from('contact_list_members')
    .upsert(rows, { onConflict: 'list_id,contact_id' })
    .select()
  if (error) throw error
  res.status(201).json({ added: data?.length })
})

router.delete('/:id/members/:contactId', async (req, res) => {
  const { error } = await supabase
    .from('contact_list_members')
    .delete()
    .eq('list_id', req.params.id)
    .eq('contact_id', req.params.contactId)
  if (error) throw error
  res.status(204).end()
})

export default router
