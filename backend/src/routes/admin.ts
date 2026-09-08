import { Router } from 'express'
import { getDb } from '../db.js'
import { requireAdmin } from '../middleware/require-auth.js'

export const adminRouter = Router()

adminRouter.get('/users', requireAdmin, async (_req, res, next) => {
  try {
    const database = await getDb()
    const result = await database.query<{
      user_id: string
      name: string
      email: string
      role: string
      created_at: string
    }>('SELECT user_id, name, email, role, created_at FROM users ORDER BY created_at DESC')
    res.json({ users: result.rows })
  } catch (error) {
    next(error)
  }
})

adminRouter.get('/audit', requireAdmin, async (_req, res, next) => {
  try {
    const database = await getDb()
    const result = await database.query(
      `SELECT audit_id, event_type, details, ip_address, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 100`,
    )
    res.json({ entries: result.rows })
  } catch (error) {
    next(error)
  }
})

adminRouter.get('/detections', requireAdmin, async (_req, res, next) => {
  try {
    const database = await getDb()
    const result = await database.query(
      `SELECT d.detection_id, d.original_name, d.classification, d.confidence_score,
              d.risk_score, d.created_at, u.name AS user_name, u.email AS user_email
       FROM detection_logs d JOIN users u ON u.user_id = d.user_id
       ORDER BY d.created_at DESC LIMIT 100`,
    )
    res.json({ detections: result.rows })
  } catch (error) {
    next(error)
  }
})

adminRouter.get('/metrics', requireAdmin, async (_req, res, next) => {
  try {
    const database = await getDb()
    const summary = await database.query<{
      users: string
      detections: string
      alerts: string
      average_risk: string | null
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM users) AS users,
         (SELECT COUNT(*)::text FROM detection_logs) AS detections,
         (SELECT COUNT(*)::text FROM alert_logs) AS alerts,
         (SELECT ROUND(AVG(risk_score))::text FROM detection_logs) AS average_risk`,
    )
    const classifications = await database.query<{ classification: string; total: string }>(
      `SELECT classification, COUNT(*)::text AS total
       FROM detection_logs GROUP BY classification ORDER BY total DESC`,
    )
    const metrics = summary.rows[0]
    res.json({
      users: Number(metrics?.users ?? 0),
      detections: Number(metrics?.detections ?? 0),
      alerts: Number(metrics?.alerts ?? 0),
      averageRisk: Number(metrics?.average_risk ?? 0),
      classifications: classifications.rows.map((entry) => ({
        classification: entry.classification,
        total: Number(entry.total),
      })),
    })
  } catch (error) {
    next(error)
  }
})

adminRouter.get('/report', requireAdmin, async (_req, res, next) => {
  try {
    const database = await getDb()
    const result = await database.query<{
      created_at: string
      user_email: string
      classification: string
      confidence_score: number
      risk_score: number
      original_name: string
    }>(
      `SELECT d.created_at, u.email AS user_email, d.classification,
              d.confidence_score, d.risk_score, d.original_name
       FROM detection_logs d JOIN users u ON u.user_id = d.user_id
       ORDER BY d.created_at DESC`,
    )
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
    const lines = [
      ['created_at', 'user_email', 'classification', 'confidence_score', 'risk_score', 'original_name'].join(','),
      ...result.rows.map((entry) => [
        escapeCsv(entry.created_at),
        escapeCsv(entry.user_email),
        escapeCsv(entry.classification),
        entry.confidence_score,
        entry.risk_score,
        escapeCsv(entry.original_name),
      ].join(',')),
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="voiceshield-detection-report.csv"')
    res.send(lines.join('\n'))
  } catch (error) {
    next(error)
  }
})
