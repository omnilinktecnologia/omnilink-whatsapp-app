import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

router.get('/overview', async (_req, res) => {
  const [contacts, journeys, campaigns, templates, executions, messages, recentCampaigns] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('journeys').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase.from('templates').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),
    supabase.from('journey_executions').select('status, started_at, completed_at'),
    supabase.from('messages').select('direction, status, created_at'),
    supabase
      .from('campaigns')
      .select('id, name, status, total_contacts, sent_count, delivered_count, read_count, replied_count, error_count, started_at, completed_at')
      .in('status', ['running', 'completed'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const outbound = (messages.data ?? []).filter((m: any) => m.direction === 'outbound')
  const inbound = (messages.data ?? []).filter((m: any) => m.direction === 'inbound')
  const delivered = outbound.filter((m: any) => ['delivered', 'read'].includes(m.status))
  const read = outbound.filter((m: any) => m.status === 'read')
  const failed = outbound.filter((m: any) => m.status === 'failed')

  const execData = executions.data ?? []
  const execByStatus = execData.reduce((acc: Record<string, number>, e: any) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})

  // Daily message volume (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const recentMessages = (messages.data ?? []).filter((m: any) => m.created_at >= thirtyDaysAgo)
  const dailyVolume: Record<string, { sent: number; received: number }> = {}
  for (const m of recentMessages as any[]) {
    const day = m.created_at?.slice(0, 10)
    if (!day) continue
    if (!dailyVolume[day]) dailyVolume[day] = { sent: 0, received: 0 }
    if (m.direction === 'outbound') dailyVolume[day].sent++
    else dailyVolume[day].received++
  }

  // Campaign performance
  const campaignPerformance = (recentCampaigns.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    total: c.total_contacts,
    sent: c.sent_count,
    delivered: c.delivered_count,
    read: c.read_count,
    replied: c.replied_count,
    errors: c.error_count,
    delivery_rate: c.sent_count > 0 ? ((c.delivered_count / c.sent_count) * 100).toFixed(1) : '0',
    read_rate: c.sent_count > 0 ? ((c.read_count / c.sent_count) * 100).toFixed(1) : '0',
    response_rate: c.sent_count > 0 ? ((c.replied_count / c.sent_count) * 100).toFixed(1) : '0',
  }))

  res.json({
    totals: {
      contacts: contacts.count ?? 0,
      journeys: journeys.count ?? 0,
      campaigns: campaigns.count ?? 0,
      approved_templates: templates.count ?? 0,
    },
    messages: {
      sent: outbound.length,
      received: inbound.length,
      delivered: delivered.length,
      read: read.length,
      failed: failed.length,
    },
    rates: {
      delivery: outbound.length > 0 ? +((delivered.length / outbound.length) * 100).toFixed(1) : 0,
      read: outbound.length > 0 ? +((read.length / outbound.length) * 100).toFixed(1) : 0,
      response: outbound.length > 0 ? +((inbound.length / outbound.length) * 100).toFixed(1) : 0,
    },
    executions: execByStatus,
    daily_volume: dailyVolume,
    campaign_performance: campaignPerformance,
  })
})

export default router
