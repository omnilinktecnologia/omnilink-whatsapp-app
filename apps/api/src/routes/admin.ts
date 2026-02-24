import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// ── List all users ───────────────────────────────────────────────────────────
router.get('/users', async (_req, res) => {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) { res.status(500).json({ error: error.message }); return }

  const users = data.users.map(u => ({
    id:             u.id,
    email:          u.email,
    name:           u.user_metadata?.full_name ?? u.user_metadata?.name ?? '',
    role:           (u.app_metadata?.role as string) ?? 'user',
    confirmed:      !!u.email_confirmed_at,
    banned:         u.banned_until ? new Date(u.banned_until) > new Date() : false,
    last_sign_in:   u.last_sign_in_at,
    created_at:     u.created_at,
  }))

  res.json(users)
})

// ── Create user ──────────────────────────────────────────────────────────────
router.post('/users', async (req, res) => {
  const { email, password, name, role = 'user' } = req.body as {
    email: string; password: string; name?: string; role?: string
  }

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' }); return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata:  { full_name: name ?? '' },
    app_metadata:   { role },
  })

  if (error) { res.status(400).json({ error: error.message }); return }
  res.status(201).json({ id: data.user.id })
})

// ── Update user ──────────────────────────────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { id } = req.params
  const { email, name, password, role, banned } = req.body as {
    email?: string; name?: string; password?: string; role?: string; banned?: boolean
  }

  const updates: Record<string, any> = {}
  if (email)    updates.email          = email
  if (password) updates.password       = password
  if (name !== undefined) updates.user_metadata = { full_name: name }
  if (role !== undefined) updates.app_metadata  = { role }
  if (banned !== undefined) {
    updates.ban_duration = banned ? '876600h' : 'none'
  }

  const { error } = await supabase.auth.admin.updateUserById(id, updates)
  if (error) { res.status(400).json({ error: error.message }); return }
  res.json({ ok: true })
})

// ── Delete user ──────────────────────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) { res.status(400).json({ error: error.message }); return }
  res.json({ ok: true })
})

export default router
