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
    CREATE TABLE IF NOT EXISTS voice_samples (
      sample_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE voice_samples ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT;
    CREATE TABLE IF NOT EXISTS voice_enrollments (
      enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      fingerprint_hash TEXT NOT NULL,
      sample_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      normalized_path TEXT,
      mfcc JSONB,
      spectrogram JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS normalized_path TEXT;
    ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS mfcc JSONB;
    ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS spectrogram JSONB;
  `)

  return db
}

export async function pingDatabase(): Promise<boolean> {
  const client = await getDb()
  const result = await client.query<{ ok: number }>('SELECT 1 AS ok')
  return result.rows[0]?.ok === 1
}
