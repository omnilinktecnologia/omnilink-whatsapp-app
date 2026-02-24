import { Router } from 'express'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { twilioClient } from '../lib/twilio'
import { config } from '../config'
import { TemplateSchema } from '@omnilink/shared'

const router = Router()

// List all content templates directly from Twilio Content API (not yet imported)
router.get('/twilio-list', async (req, res) => {
  try {
    const contents = await (twilioClient.content.v1.contents as any).list({ pageSize: 100 })

    // Fetch already-imported content_sids to exclude them
    const { data: existing } = await supabase
      .from('templates')
      .select('content_sid')
      .not('content_sid', 'is', null)

    const importedSids = new Set((existing ?? []).map((t: any) => t.content_sid))

    const result = contents
      .filter((c: any) => !importedSids.has(c.sid))
      .map((c: any) => {
        const contentType = Object.keys(c.types ?? {})[0] ?? 'twilio/text'
        const contentDef = c.types?.[contentType] ?? {}
        const body: string =
          contentDef.body ??
          contentDef.message ??
          contentDef.text ??
          ''
        const approvalStatus: string =
          c.approvalRequests?.whatsapp?.status ?? 'unsubmitted'

        return {
          sid: c.sid,
          friendly_name: c.friendlyName,
          language: c.language,
          content_type: contentType,
          content_definition: contentDef,
          body,
          approval_status: approvalStatus,
          date_created: c.dateCreated,
        }
      })

    res.json(result)
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to fetch from Twilio', detail: err.message })
  }
})

// Import a template from Twilio into local database by ContentSid
router.post('/import-from-twilio', async (req, res) => {
  const { content_sid } = req.body
  if (!content_sid) { res.status(400).json({ error: 'content_sid is required' }); return }

  try {
    const c = await (twilioClient.content.v1.contents as any)(content_sid).fetch()

    const contentType = Object.keys(c.types ?? {})[0] ?? 'twilio/text'
    const contentDef = c.types?.[contentType] ?? {}
    const body: string =
      contentDef.body ??
      contentDef.message ??
      contentDef.text ??
      ''
    const approvalStatus: string =
      c.approvalRequests?.whatsapp?.status ?? 'unsubmitted'

    // Build variables array from Twilio variables map (e.g. {"1":"João"} → [{name:"1",example:"João"}])
    const variables = Object.entries(c.variables ?? {}).map(([k, v]) => ({
      name: k,
      example: String(v),
    }))

    const { data, error } = await supabase
      .from('templates')
      .insert({
        name: c.friendlyName,
        friendly_name: c.friendlyName,
        content_sid: c.sid,
        content_type: contentType,
        content_definition: contentDef,
        language: c.language ?? 'pt_BR',
        body,
        variables,
        approval_status: approvalStatus,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to import from Twilio', detail: err.message })
  }
})

router.get('/', async (req, res) => {
  const { status, content_type } = req.query
  let query = supabase.from('templates').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('approval_status', status)
  if (content_type) query = query.eq('content_type', content_type)

  const { data, error } = await query
  if (error) throw error
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) { res.status(404).json({ error: 'Template not found' }); return }
  res.json(data)
})

router.post('/', async (req, res) => {
  const parsed = TemplateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  // Create content template on Twilio Content API via direct HTTP (SDK v5 mangles nested snake_case fields)
  let contentSid: string | undefined
  let twilioError: string | undefined
  try {
    const response = await axios.post(
      'https://content.twilio.com/v1/Content',
      buildTwilioContent(parsed.data),
      {
        auth: { username: config.twilioAccountSid, password: config.twilioAuthToken },
        headers: { 'Content-Type': 'application/json' },
      }
    )
    contentSid = response.data.sid
  } catch (err: any) {
    twilioError =
      err.response?.data?.message ??
      err.response?.data?.detail ??
      err.message ??
      'Unknown error'
    console.error('Twilio Content API error:', twilioError)
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({
      ...parsed.data,
      content_sid: contentSid,
      approval_status: 'unsubmitted',
    })
    .select()
    .single()
  if (error) throw error
  res.status(201).json({ ...data, twilio_error: twilioError })
})

router.put('/:id', async (req, res) => {
  const parsed = TemplateSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { data, error } = await supabase
    .from('templates')
    .update(parsed.data)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('templates').delete().eq('id', req.params.id)
  if (error) throw error
  res.status(204).end()
})

// Submit template for WhatsApp approval
router.post('/:id/submit', async (req, res) => {
  const { data: template, error: fetchErr } = await supabase
    .from('templates')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (fetchErr) { res.status(404).json({ error: 'Template not found' }); return }
  if (!template.content_sid) { res.status(400).json({ error: 'Template has no ContentSid (Twilio)' }); return }

  const category: string = req.body?.category ?? 'MARKETING'

  try {
    // POST to the channel-specific approval endpoint (Twilio Content API v1)
    // URL uses singular /Content/ as per Twilio docs; body must be JSON with name + category
    await axios.post(
      `https://content.twilio.com/v1/Content/${template.content_sid}/ApprovalRequests/whatsapp`,
      { name: template.friendly_name, category },
      {
        auth: { username: config.twilioAccountSid, password: config.twilioAuthToken },
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const { data, error } = await supabase
      .from('templates')
      .update({ approval_status: 'pending' })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err: any) {
    const detail =
      err.response?.data?.message ??
      err.response?.data?.detail ??
      err.message ??
      'Unknown error'
    res.status(502).json({ error: 'Erro ao enviar para aprovação na Twilio', detail })
  }
})

// Sync approval status from Twilio
router.post('/:id/sync', async (req, res) => {
  const { data: template, error: fetchErr } = await supabase
    .from('templates')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (fetchErr) { res.status(404).json({ error: 'Template not found' }); return }
  if (!template.content_sid) { res.status(400).json({ error: 'No ContentSid to sync' }); return }

  try {
    const twContent = await (twilioClient.content.v1.contents as any)(template.content_sid).fetch()
    const approvalStatus = twContent.approvalRequests?.whatsapp?.status ?? template.approval_status

    const { data, error } = await supabase
      .from('templates')
      .update({ approval_status: approvalStatus })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to sync from Twilio', detail: err.message })
  }
})

// Remove keys whose value is an empty string, null, or undefined (recursively for plain objects)
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )
}

function buildTwilioContent(template: any): Record<string, unknown> {
  const rawDef: Record<string, unknown> = template.content_definition ?? {}
  const cleanDef = stripEmpty(rawDef)

  return {
    friendly_name: template.friendly_name,
    language: template.language ?? 'pt_BR',
    variables: template.variables?.reduce((acc: Record<string, string>, v: any, i: number) => {
      acc[String(i + 1)] = v.example ?? v.name ?? `variable${i + 1}`
      return acc
    }, {}),
    types: {
      [template.content_type]: cleanDef,
    },
  }
}

export default router
