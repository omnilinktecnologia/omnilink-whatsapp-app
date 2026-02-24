import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const token = authHeader.slice(7)
  const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
  const { data: { user }, error } = await client.auth.getUser(token)

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  ;(req as Request & { user: typeof user }).user = user
  next()
}
