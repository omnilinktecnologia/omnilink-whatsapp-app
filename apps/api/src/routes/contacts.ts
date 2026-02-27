import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse'
import { supabase } from '../lib/supabase'
import { ContactSchema } from '@omnilink/shared'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

router.get('/', async (req, res) => {
  const { page = '1', limit = '50', search } = req.query
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit as string) - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  res.json({ data, total: count, page: parseInt(page as string), limit: parseInt(limit as string) })
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Contact not found' }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const parsed = ContactSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('contacts')
    .upsert(parsed.data, { onConflict: 'phone' })
    .select()
    .single()
  if (error) throw error
  res.status(201).json(data)
})

router.put('/:id', async (req, res) => {
  const parsed = ContactSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('contacts')
    .update(parsed.data)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('contacts').delete().eq('id', req.params.id)
  if (error) throw error
  res.status(204).end()
})

// ── CSV Import ────────────────────────────────────────────────────────────────
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file provided' }); return }

  const rows: Record<string, string>[] = await new Promise((resolve, reject) => {
    parse(req.file!.buffer, { columns: true, skip_empty_lines: true, trim: true }, (err, records) => {
      if (err) reject(err)
      else resolve(records)
    })
  })

  // Map columns: phone (required), name, email, plus anything else → attributes
  const contacts = rows.map((row) => {
    const phone = row.phone ?? row.telefone ?? row.whatsapp ?? ''
    // Normalize to E.164: if starts with 55 or similar, add +
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`
    const name = row.name ?? row.nome ?? undefined
    const email = row.email ?? undefined
    const reserved = new Set(['phone', 'telefone', 'whatsapp', 'name', 'nome', 'email'])
    const attributes: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!reserved.has(k) && v) attributes[k] = v
    }
    return { phone: normalizedPhone, name, email, attributes }
  }).filter((c) => c.phone.match(/^\+\d{7,15}$/))

  if (contacts.length === 0) {
    res.status(400).json({ error: 'No valid contacts found. Ensure "phone" column exists with E.164 numbers.' })
    return
  }

  const { data, error } = await supabase
    .from('contacts')
    .upsert(contacts, { onConflict: 'phone' })
    .select()

  if (error) throw error
  res.json({
    imported: data?.length ?? 0,
    total_rows: rows.length,
    contact_ids: (data ?? []).map((c: any) => c.id),
  })
})

export default router
