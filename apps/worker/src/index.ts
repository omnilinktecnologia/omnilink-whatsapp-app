import 'dotenv/config'
import { supabase } from './lib/supabase'
import { config } from './config'
import { handleAdvanceExecution } from './jobs/advance-execution'
import { handleLaunchCampaign } from './jobs/launch-campaign'
import { handleTimeout } from './jobs/handle-timeout'
import { handleProcessInbound } from './jobs/process-inbound'

console.log(`[worker] Starting ${config.workerId}`)
console.log(`[worker] Poll interval: ${config.pollIntervalMs}ms | Concurrency: ${config.concurrency}`)

let isRunning = false

async function processBatch(): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    const { data: jobs, error } = await supabase.rpc('claim_jobs', {
      p_worker_id: config.workerId,
      p_limit: config.concurrency,
    })

    if (error) {
      console.error('[worker] Error claiming jobs:', error.message)
      return
    }

    if (!jobs || jobs.length === 0) return

    console.log(`[worker] Claimed ${jobs.length} job(s)`)

    await Promise.allSettled(
      jobs.map(async (job: any) => {
        try {
          await processJob(job)
          await supabase
            .from('jobs')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', job.id)
        } catch (err: any) {
          console.error(`[worker] Job ${job.id} (${job.type}) failed:`, err.message)
          const failed = job.attempts >= job.max_attempts
          await supabase
            .from('jobs')
            .update({
              status: failed ? 'failed' : 'pending',
              locked_at: null,
              locked_by: null,
              error: err.message,
              run_at: failed
                ? new Date().toISOString()
                : new Date(Date.now() + exponentialBackoff(job.attempts) * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
        }
      })
    )
  } finally {
    isRunning = false
  }
}

async function processJob(job: { id: string; type: string; payload: unknown }): Promise<void> {
  const p = job.payload as any
  switch (job.type) {
    case 'advance_execution':
      await handleAdvanceExecution(p)
      break
    case 'launch_campaign':
      await handleLaunchCampaign(p)
      break
    case 'handle_timeout':
      await handleTimeout(p)
      break
    case 'process_inbound':
      await handleProcessInbound(p)
      break
    default:
      console.warn(`[worker] Unknown job type: ${job.type}`)
  }
}

function exponentialBackoff(attempts: number): number {
  return Math.min(30, Math.pow(2, attempts))
}

// Poll loop
setInterval(processBatch, config.pollIntervalMs)

// Start immediately
processBatch()

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[worker] SIGTERM received, shutting down...')
  process.exit(0)
})
process.on('SIGINT', () => {
  console.log('[worker] SIGINT received, shutting down...')
  process.exit(0)
})
