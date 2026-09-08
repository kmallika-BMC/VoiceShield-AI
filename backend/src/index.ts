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

const app = express()

app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/profile', profileRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/detection', detectionRouter)

app.get('/api/health', async (_req, res) => {
  const databaseConnected = await pingDatabase()

  if (!databaseConnected) {
    res.status(503).json({ status: 'error', database: 'disconnected' })
    return
  }

  res.status(200).json({ status: 'ok', database: 'connected' })
})

app.listen(config.port, () => {
  console.log(`VoiceShield API listening on port ${config.port}`)
})
