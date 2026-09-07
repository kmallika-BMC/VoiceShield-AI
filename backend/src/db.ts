import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

let db: PGlite | null = null

export async function getDb(): Promise<PGlite> {
  if (db) {
    return db
  }

  const dataDir = path.isAbsolute(config.databasePath)
    ? config.databasePath
    : path.resolve(config.backendRoot, config.databasePath)

  fs.mkdirSync(path.dirname(dataDir), { recursive: true })

  db = await PGlite.create(dataDir)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `)

  return db
}

export async function pingDatabase(): Promise<boolean> {
  const client = await getDb()
  const result = await client.query<{ ok: number }>('SELECT 1 AS ok')
  return result.rows[0]?.ok === 1
}
