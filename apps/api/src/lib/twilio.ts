import twilio from 'twilio'
import { config } from '../config'

export const twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken)

export async function sendTemplate(params: {
  to: string
  from: string
  contentSid: string
  contentVariables?: Record<string, string>
}) {
  return twilioClient.messages.create({
    to: `whatsapp:${params.to}`,
    from: params.from.startsWith('whatsapp:') ? params.from : `whatsapp:${params.from}`,
    contentSid: params.contentSid,
    ...(params.contentVariables && Object.keys(params.contentVariables).length > 0
      ? { contentVariables: JSON.stringify(params.contentVariables) }
      : {}),
  })
}

export async function sendFreeform(params: {
  to: string
  from: string
  body: string
}) {
  return twilioClient.messages.create({
    to: `whatsapp:${params.to}`,
    from: params.from.startsWith('whatsapp:') ? params.from : `whatsapp:${params.from}`,
    body: params.body,
  })
}

export function verifyWebhookSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(config.twilioAuthToken, signature, url, params)
}
