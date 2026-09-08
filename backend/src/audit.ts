import { getDb } from './db.js'

export async function recordAuditEvent(
  eventType: string,
  details: string,
  userId?: string,
  ipAddress?: string,
) {
  const database = await getDb()
  await database.query(
    `INSERT INTO audit_logs (user_id, event_type, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId ?? null, eventType, details, ipAddress ?? null],
  )
}
