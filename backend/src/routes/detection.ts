import { Router } from 'express'
import multer from 'multer'
import { isVoiceModelLoaded, loadVoiceModel, predictVoice } from '../ai/voice-model.js'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/require-auth.js'

const allowedTypes = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, allowedTypes.has(file.mimetype)),
})

export const detectionRouter = Router()
loadVoiceModel()

function analyzeAudioBuffer(buffer: Buffer) {
  const samples = Array.from(buffer, (value) => Math.abs(value - 128) / 128)
  const mean = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1)
  const variance =
    samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(samples.length, 1)
  const zeroCrossingRate =
    samples.slice(1).reduce((count, value, index) => {
      return count + (value >= 0.5 !== samples[index] >= 0.5 ? 1 : 0)
    }, 0) / Math.max(samples.length - 1, 1)
  return predictVoice({
    zeroCrossingRate,
    dynamicRange: Math.min(Math.sqrt(variance) * 3, 1),
    spectralVariation: Math.min(variance * 8, 1),
  })
}

detectionRouter.post('/predict', requireAuth, upload.single('audio'), async (req, res, next) => {
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Upload a WAV, MP3, or M4A audio file.' })
    return
  }

  try {
    const result = analyzeAudioBuffer(file.buffer)
    const database = await getDb()
    await database.query(
      `INSERT INTO detection_logs
       (user_id, original_name, mime_type, classification, confidence_score, risk_score, reasons)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        req.user?.userId,
        file.originalname,
        file.mimetype,
        result.classification,
        result.confidenceScore,
        result.riskScore,
        JSON.stringify(result.reasons),
      ],
    )
    res.json({ modelLoaded: isVoiceModelLoaded(), prediction: result.classification, ...result })
  } catch (error) {
    next(error)
  }
})

detectionRouter.post('/live', requireAuth, upload.single('audio'), async (req, res, next) => {
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'A live audio chunk is required.' })
    return
  }

  try {
    const result = analyzeAudioBuffer(file.buffer)
    res.json({
      modelLoaded: isVoiceModelLoaded(),
      prediction: result.classification,
      ...result,
    })
  } catch (error) {
    next(error)
  }
})

detectionRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const requestedPage = Number.parseInt(String(req.query.page ?? '1'), 10)
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const pageSize = 10
    const classification =
      typeof req.query.classification === 'string' && req.query.classification !== 'All'
        ? req.query.classification
        : ''
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : ''
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : ''
    const validClassifications = new Set(['Genuine', 'Suspicious', 'AI Generated'])
    const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value)

    if (
      (classification && !validClassifications.has(classification)) ||
      !validDate(dateFrom) ||
      !validDate(dateTo) ||
      (dateFrom && dateTo && dateFrom > dateTo)
    ) {
      res.status(400).json({ error: 'Invalid history filters.' })
      return
    }

    const database = await getDb()
    const filters = ['user_id = $1']
    const values: unknown[] = [req.user?.userId]
    if (classification) {
      values.push(classification)
      filters.push(`classification = $${values.length}`)
    }
    if (dateFrom) {
      values.push(dateFrom)
      filters.push(`created_at::date >= $${values.length}::date`)
    }
    if (dateTo) {
      values.push(dateTo)
      filters.push(`created_at::date <= $${values.length}::date`)
    }
    const whereClause = filters.join(' AND ')
    const count = await database.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM detection_logs WHERE ${whereClause}`,
      values,
    )
    const total = Number(count.rows[0]?.total ?? 0)
    values.push(pageSize, (page - 1) * pageSize)
    const result = await database.query(
      `SELECT detection_id, original_name, classification, confidence_score, risk_score, reasons, created_at
       FROM detection_logs WHERE ${whereClause}
       ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    )
    res.json({
      entries: result.rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      filters: { classification: classification || 'All', dateFrom, dateTo },
    })
  } catch (error) {
    next(error)
  }
})

detectionRouter.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const database = await getDb()
    const result = await database.query<{
      total: string
      genuine: string
      suspicious: string
      ai_generated: string
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE classification = 'Genuine')::text AS genuine,
         COUNT(*) FILTER (WHERE classification = 'Suspicious')::text AS suspicious,
         COUNT(*) FILTER (WHERE classification = 'AI Generated')::text AS ai_generated
       FROM detection_logs
       WHERE user_id = $1`,
      [req.user?.userId],
    )
    const stats = result.rows[0]
    const trend = await database.query<{ day: string; average_risk: string; detections: string }>(
      `SELECT created_at::date::text AS day,
              ROUND(AVG(risk_score))::text AS average_risk,
              COUNT(*)::text AS detections
       FROM detection_logs
       WHERE user_id = $1
       GROUP BY created_at::date
       ORDER BY day DESC
       LIMIT 14`,
      [req.user?.userId],
    )
    res.json({
      total: Number(stats?.total ?? 0),
      classifications: {
        Genuine: Number(stats?.genuine ?? 0),
        Suspicious: Number(stats?.suspicious ?? 0),
        'AI Generated': Number(stats?.ai_generated ?? 0),
      },
      riskTrend: trend.rows.reverse().map((entry) => ({
        day: entry.day,
        averageRisk: Number(entry.average_risk),
        detections: Number(entry.detections),
      })),
    })
  } catch (error) {
    next(error)
  }
})
