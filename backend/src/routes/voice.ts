import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/require-auth.js'
import { config } from '../config.js'
import { getFingerprintAuditLog, registerFingerprint, verifyFingerprint } from '../blockchain/registry.js'

const allowedTypes = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, allowedTypes.has(file.mimetype)),
})

export const voiceRouter = Router()

voiceRouter.post('/samples', requireAuth, upload.array('samples', 5), async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[]
    if (files.length < 3 || files.length > 5) {
      res.status(400).json({ error: 'Upload between 3 and 5 voice samples.' })
      return
    }

    const sampleDirectory = path.resolve(config.backendRoot, 'data', 'voice-samples', req.user!.userId)
    fs.mkdirSync(sampleDirectory, { recursive: true })
    const database = await getDb()
    const samples: Array<{ sample_id: string; original_name: string; fingerprint_hash: string }> = []
    const sampleHashes: string[] = []

    for (const file of files) {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${path.basename(file.originalname)}`
      const filePath = path.join(sampleDirectory, safeName)
      fs.writeFileSync(filePath, file.buffer)
      const fingerprintHash = createHash('sha256').update(file.buffer).digest('hex')
      sampleHashes.push(fingerprintHash)
      const result = await database.query<{ sample_id: string; original_name: string }>(
        `INSERT INTO voice_samples (user_id, original_name, mime_type, file_path, fingerprint_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING sample_id, original_name`,
        [req.user!.userId, file.originalname, file.mimetype, filePath, fingerprintHash],
      )
      samples.push({ ...result.rows[0], fingerprint_hash: fingerprintHash })
    }

    const enrollmentFingerprint = createHash('sha256')
      .update(sampleHashes.sort().join(':'))
      .digest('hex')
    await database.query(
      `INSERT INTO voice_enrollments (user_id, fingerprint_hash, sample_count)
       VALUES ($1, $2, $3)`,
      [req.user!.userId, enrollmentFingerprint, samples.length],
    )

    res.status(201).json({ samples, fingerprint: enrollmentFingerprint })
  } catch (error) {
    next(error)
  }
})

voiceRouter.post('/fingerprint/register', requireAuth, async (req, res, next) => {
  try {
    const fingerprint = typeof req.body?.fingerprint === 'string' ? req.body.fingerprint.trim().toLowerCase() : ''
    if (!fingerprint) {
      res.status(400).json({ error: 'Fingerprint is required.' })
      return
    }
    const result = await registerFingerprint(fingerprint, req.user!.userId)
    res.status(201).json(result)
  } catch (error) {
    next(error)
  }
})

voiceRouter.post('/fingerprint/verify', requireAuth, async (req, res, next) => {
  try {
    const fingerprint = typeof req.body?.fingerprint === 'string' ? req.body.fingerprint.trim().toLowerCase() : ''
    if (!fingerprint) {
      res.status(400).json({ error: 'Fingerprint is required.' })
      return
    }
    res.status(200).json(await verifyFingerprint(fingerprint, req.user!.userId))
  } catch (error) {
    next(error)
  }
})

voiceRouter.get('/fingerprint/audit', requireAuth, async (req, res, next) => {
  try {
    res.status(200).json({ entries: await getFingerprintAuditLog(req.user!.userId) })
  } catch (error) {
    next(error)
  }
})
