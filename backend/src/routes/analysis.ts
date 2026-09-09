import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { config } from '../config.js'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/require-auth.js'

const allowedTypes = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, allowedTypes.has(file.mimetype.split(';', 1)[0].trim().toLowerCase())),
})

export const analysisRouter = Router()

function preprocessAudio(input: Buffer) {
  const samples = Array.from(input, (value) => (value - 128) / 128)
  const reducedNoise = samples.map((sample, index) => {
    const previous = samples[index - 1] ?? sample
    const next = samples[index + 1] ?? sample
    return (previous + sample + next) / 3
  })
  const peak = reducedNoise.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 1)
  const normalized = Buffer.from(reducedNoise.map((sample) => Math.round((sample / peak) * 127 + 128)))
  const frameSize = 256
  const spectrogram: number[][] = []
  const mfcc: number[] = []

  for (let start = 0; start < normalized.length; start += frameSize) {
    const frame = normalized.subarray(start, start + frameSize)
    if (!frame.length) continue
    const energy = Array.from(frame, (value) => Math.abs(value - 128) / 128)
    const bands = Array.from({ length: 13 }, (_, band) => {
      const slice = energy.slice(
        Math.floor((band * energy.length) / 13),
        Math.floor(((band + 1) * energy.length) / 13),
      )
      return Math.log1p(slice.reduce((sum, value) => sum + value * value, 0) / Math.max(slice.length, 1))
    })
    mfcc.push(...bands)
    spectrogram.push(bands)
  }

  return { normalized, mfcc: mfcc.slice(0, 13), spectrogram: spectrogram.slice(0, 32) }
}

analysisRouter.post('/uploads', requireAuth, upload.single('audio'), async (req, res, next) => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Upload a WAV, MP3, M4A, WebM, or OGG audio file.' })
      return
    }

    const directory = path.resolve(config.backendRoot, 'data', 'analysis', req.user!.userId)
    fs.mkdirSync(directory, { recursive: true })
    const storedPath = path.join(directory, `${Date.now()}-${path.basename(file.originalname)}`)
    fs.writeFileSync(storedPath, file.buffer)
    const processed = preprocessAudio(file.buffer)
    const normalizedPath = path.join(directory, `${Date.now()}-normalized.raw`)
    fs.writeFileSync(normalizedPath, processed.normalized)

    const database = await getDb()
    const result = await database.query<{
      job_id: string
      original_name: string
      status: string
      normalized_path: string
      mfcc: number[]
      spectrogram: number[][]
    }>(
      `INSERT INTO analysis_jobs
       (user_id, original_name, mime_type, file_path, status, normalized_path, mfcc, spectrogram)
       VALUES ($1, $2, $3, $4, 'complete', $5, $6::jsonb, $7::jsonb)
       RETURNING job_id, original_name, status, normalized_path, mfcc, spectrogram`,
      [
        req.user!.userId,
        file.originalname,
        file.mimetype,
        storedPath,
        normalizedPath,
        JSON.stringify(processed.mfcc),
        JSON.stringify(processed.spectrogram),
      ],
    )

    res.status(202).json({ job: result.rows[0] })
  } catch (error) {
    next(error)
  }
})
