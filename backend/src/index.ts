import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { pingDatabase } from './db.js'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { profileRouter } from './routes/profile.js'
import { voiceRouter } from './routes/voice.js'
import { analysisRouter } from './routes/analysis.js'
import { detectionRouter } from './routes/detection.js'
import { adminRouter } from './routes/admin.js'
import { enforceHttps, rateLimit } from './middleware/security.js'
import { validateJsonBody } from './middleware/validation.js'

export const app = express()

app.set('trust proxy', 1)
app.use(cors({ origin: config.corsOrigin }))
app.use(enforceHttps)
app.use('/api', rateLimit)
app.use(express.json({ limit: '1mb' }))
app.use(validateJsonBody)
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/profile', profileRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/detection', detectionRouter)
app.use('/api/admin', adminRouter)

app.get('/api/health', async (_req, res) => {
  const databaseConnected = await pingDatabase()

  if (!databaseConnected) {
    res.status(503).json({ status: 'error', database: 'disconnected' })
    return
  }

  res.status(200).json({ status: 'ok', database: 'connected' })
})

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Invalid JSON payload.' })
    return
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request payload is too large.' })
    return
  }
  next(error)
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`VoiceShield API listening on port ${config.port}`)
  })
}
