import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { JourneySchema } from '@omnilink/shared'

const router = Router()

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('journeys')
    .select('id, name, description, trigger_type, status, created_at, updated_at, default_sender_id')
    .order('created_at', { ascending: false })
  if (error) throw error
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('journeys')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Journey not found' }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const parsed = JourneySchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('journeys')
    .insert(parsed.data)
    .select()
    .single()
  if (error) throw error
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const parsed = JourneySchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('journeys')
    .update(parsed.data)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

// Save graph (builder autosave)
router.put('/:id/graph', async (req, res) => {
  const { graph } = req.body
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    res.status(400).json({ error: 'Invalid graph structure' }); return
  }

  const { data, error } = await supabase
    .from('journeys')
    .update({ graph })
    .eq('id', req.params.id)
    .select('id, name, graph, updated_at')
    .single()
  if (error) throw error
  res.json(data)
})

// Publish journey
router.post('/:id/publish', async (req, res) => {
  const { data: journey, error: fetchErr } = await supabase
    .from('journeys')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (fetchErr) { res.status(404).json({ error: 'Journey not found' }); return }

  const graph = journey.graph as { nodes: any[]; edges: any[] }
  const hasStart = graph.nodes.some((n: any) => n.type === 'start')
  if (!hasStart) {
    res.status(400).json({ error: 'Journey must have a Start node before publishing' }); return
  }

  const { data, error } = await supabase
    .from('journeys')
    .update({ status: 'published' })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

// Archive journey
router.post('/:id/archive', async (req, res) => {
  const { data, error } = await supabase
    .from('journeys')
    .update({ status: 'archived' })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('journeys').delete().eq('id', req.params.id)
  if (error) throw error
  res.status(204).end()
})

export default router
