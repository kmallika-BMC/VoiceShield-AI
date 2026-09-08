import { Router } from 'express'
import multer from 'multer'
import { isVoiceModelLoaded, loadVoiceModel, predictVoice } from '../ai/voice-model.js'
import { requireAuth } from '../middleware/require-auth.js'

const allowedTypes = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, allowedTypes.has(file.mimetype)),
})

export const detectionRouter = Router()
loadVoiceModel()

detectionRouter.post('/predict', requireAuth, upload.single('audio'), (req, res) => {
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Upload a WAV, MP3, or M4A audio file.' })
    return
  }

  const samples = Array.from(file.buffer, (value) => Math.abs(value - 128) / 128)
  const mean = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1)
  const variance =
    samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(samples.length, 1)
  const zeroCrossingRate =
    samples.slice(1).reduce((count, value, index) => {
      return count + (value >= 0.5 !== samples[index] >= 0.5 ? 1 : 0)
    }, 0) / Math.max(samples.length - 1, 1)
  const result = predictVoice({
    zeroCrossingRate,
    dynamicRange: Math.min(Math.sqrt(variance) * 3, 1),
    spectralVariation: Math.min(variance * 8, 1),
  })

  res.json({ modelLoaded: isVoiceModelLoaded(), prediction: result.classification, ...result })
})
