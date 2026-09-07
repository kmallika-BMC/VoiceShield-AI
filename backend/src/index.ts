import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { pingDatabase } from './db.js'
import { authRouter } from './routes/auth.js'

const app = express()

app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())
app.use('/api/auth', authRouter)

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
