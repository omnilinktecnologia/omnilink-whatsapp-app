import twilio from 'twilio'
import { config } from '../config'

export const twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken)

export async function sendTemplate(params: {
  to: string
  from: string
  contentSid: string
  contentVariables?: Record<string, string>
}): Promise<string> {
  const msg = await twilioClient.messages.create({
    to: params.to.startsWith('whatsapp:') ? params.to : `whatsapp:${params.to}`,
    from: params.from.startsWith('whatsapp:') ? params.from : `whatsapp:${params.from}`,
    contentSid: params.contentSid,
    ...(params.contentVariables && Object.keys(params.contentVariables).length > 0
      ? { contentVariables: JSON.stringify(params.contentVariables) }
      : {}),
  })
  return msg.sid
}

export async function sendFreeform(params: {
  to: string
  from: string
  body: string
}): Promise<string> {
  const msg = await twilioClient.messages.create({
    to: params.to.startsWith('whatsapp:') ? params.to : `whatsapp:${params.to}`,
    from: params.from.startsWith('whatsapp:') ? params.from : `whatsapp:${params.from}`,
    body: params.body,
  })
  return msg.sid
}
