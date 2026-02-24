import 'dotenv/config'

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  twilioAccountSid: required('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: required('TWILIO_AUTH_TOKEN'),
  workerId: process.env.WORKER_ID ?? `worker-${process.pid}`,
  pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? '3000', 10),
  concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10),
}
