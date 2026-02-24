import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { verifyWebhookSignature } from '../lib/twilio'
import { config } from '../config'

const router = Router()

// Twilio sends form-encoded bodies for webhooks
router.use((req, _res, next) => {
  // body is already parsed by express.urlencoded in index.ts
  next()
})

router.post('/inbound', async (req: Request, res: Response) => {
  // Validate Twilio signature in production
  // Use x-forwarded-proto if present (e.g. behind ngrok or a reverse proxy) so the
  // reconstructed URL matches what Twilio used to sign the request.
  if (config.nodeEnv === 'production') {
    const signature = req.headers['x-twilio-signature'] as string
    const proto = (req.headers['x-forwarded-proto'] as string) ?? req.protocol
    const host  = (req.headers['x-forwarded-host'] as string) ?? req.get('host')
    const url = `${proto}://${host}${req.originalUrl}`
    const valid = verifyWebhookSignature(signature, url, req.body as Record<string, string>)
    if (!valid) {
      console.warn(`[webhook/inbound] Invalid Twilio signature. Expected URL: ${url}`)
      res.status(403).send('Forbidden'); return
    }
  }

  const {
    From,        // e.g. whatsapp:+5511999999999
    To,          // e.g. whatsapp:+5511888888888 (our sender)
    Body,
    MessageSid,
    NumMedia,
    ButtonText,
    ButtonPayload,
    InteractiveData,  // WhatsApp Flow submission data
  } = req.body as Record<string, string>

  console.log(`[webhook/inbound] From=${From} To=${To} Body="${Body}" ButtonText="${ButtonText ?? ''}" InteractiveData=${InteractiveData ? 'yes' : 'no'} sid=${MessageSid}`)

  const fromPhone = From.replace('whatsapp:', '')
  const toPhone = To.replace('whatsapp:', '')
  const receivedAt = new Date().toISOString()

  // Collect media URLs if any
  const mediaUrls: string[] = []
  const numMedia = parseInt(NumMedia ?? '0')
  for (let i = 0; i < numMedia; i++) {
    const url = req.body[`MediaUrl${i}`]
    if (url) mediaUrls.push(url)
  }

  // Parse InteractiveData from WhatsApp Flow submissions
  let interactiveData: Record<string, unknown> | undefined
  if (InteractiveData) {
    try { interactiveData = JSON.parse(InteractiveData) } catch { interactiveData = { raw: InteractiveData } }
  }

  // Use ButtonText as body fallback for quick-reply interactions
  const effectiveBody = Body || ButtonText || (interactiveData ? '[flow_submission]' : '')

  // Enqueue inbound processing job (non-blocking)
  await supabase.from('jobs').insert({
    type: 'process_inbound',
    payload: {
      from: fromPhone,
      to: toPhone,
      body: effectiveBody,
      message_sid: MessageSid,
      media_urls: mediaUrls,
      received_at: receivedAt,
      button_payload: ButtonPayload,
      interactive_data: interactiveData,
    },
    priority: 9,  // high priority
  })

  // Respond with empty TwiML immediately
  res.type('text/xml').send('<Response></Response>')
})

// Message status callback
router.post('/status', async (req: Request, res: Response) => {
  const { MessageSid, MessageStatus, ErrorCode } = req.body as Record<string, string>

  await supabase
    .from('messages')
    .update({ status: MessageStatus?.toLowerCase(), error_code: ErrorCode })
    .eq('twilio_sid', MessageSid)

  // Update campaign counters
  if (['delivered', 'read', 'failed'].includes(MessageStatus?.toLowerCase())) {
    const { data: msg } = await supabase
      .from('messages')
      .select('execution_id')
      .eq('twilio_sid', MessageSid)
      .single()

    if (msg?.execution_id) {
      const { data: exec } = await supabase
        .from('journey_executions')
        .select('campaign_id')
        .eq('id', msg.execution_id)
        .single()

      if (exec?.campaign_id) {
        const field = MessageStatus === 'delivered' ? 'delivered_count'
          : MessageStatus === 'read' ? 'read_count'
          : 'error_count'

        void supabase.rpc('increment_campaign_counter', {
          p_campaign_id: exec.campaign_id,
          p_field: field,
        })
      }
    }
  }

  res.status(204).end()
})

export default router
