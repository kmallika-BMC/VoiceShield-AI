import { getDb } from '../db.js'

async function verifyDatabase() {
  const db = await getDb()
  const email = `phase1-verify-${Date.now()}@voiceshield.test`

  const inserted = await db.query<{ user_id: string; email: string }>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING user_id, email`,
    ['Phase 1 Test User', email, 'hashed-placeholder'],
  )

  const retrieved = await db.query<{ user_id: string; email: string }>(
    'SELECT user_id, email FROM users WHERE email = $1',
    [email],
  )

  const row = retrieved.rows[0]
  if (!row || row.email !== email || row.user_id !== inserted.rows[0]?.user_id) {
    throw new Error('Database insert/retrieve verification failed')
  }

  await db.query('DELETE FROM users WHERE email = $1', [email])
  console.log('Database verification passed: connected, inserted, and retrieved test data.')
}

verifyDatabase().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
