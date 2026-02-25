import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config'

import sendersRouter from './routes/senders'
import contactsRouter from './routes/contacts'
import listsRouter from './routes/lists'
import templatesRouter from './routes/templates'
import journeysRouter from './routes/journeys'
import campaignsRouter from './routes/campaigns'
import executionsRouter from './routes/executions'
import aiRouter from './routes/ai'
import adminRouter from './routes/admin'
import flowResponsesRouter from './routes/flow-responses'
import analyticsRouter from './routes/analytics'
import twilioWebhook from './webhooks/twilio'

const app = express()

// Trust proxy headers from ngrok / reverse proxies (needed for correct URL in Twilio signature validation)
app.set('trust proxy', true)

app.use(helmet())
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))  // Required for Twilio form-encoded webhooks

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// API routes (auth validated per-route as needed)
app.use('/api/senders', sendersRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/lists', listsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/journeys', journeysRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/executions', executionsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/admin', adminRouter)
app.use('/api/flow-responses', flowResponsesRouter)
app.use('/api/analytics', analyticsRouter)

// Twilio webhooks (no auth — validated by signature)
app.use('/webhooks/twilio', twilioWebhook)

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: err.message ?? 'Internal server error' })
})

app.listen(config.port, () => {
  console.log(`[API] Listening on port ${config.port} (${config.nodeEnv})`)
})

export default app
