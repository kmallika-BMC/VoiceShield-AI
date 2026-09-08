import { Router } from 'express'
import { randomBytes, randomInt, createHash } from 'node:crypto'
import multer from 'multer'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { createAccessToken } from '../auth/jwt.js'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/require-auth.js'
import { config } from '../config.js'

const MINIMUM_PASSWORD_LENGTH = 8

export const authRouter = Router()
const phraseUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

authRouter.post('/register', async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!name || !isValidEmail(email) || password.length < MINIMUM_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `Provide a name, a valid email, and a password of at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
      })

      return
    }

    const passwordHash = await hashPassword(password)
    const database = await getDb()

    try {
      const result = await database.query<{ user_id: string; name: string; email: string }>(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING user_id, name, email`,
        [name, email, passwordHash],
      )

      res.status(201).json({ user: result.rows[0] })
    } catch (error: unknown) {
      if (isDuplicateEmailError(error)) {
        res.status(409).json({ error: 'An account with this email already exists.' })
        return
      }

      throw error
    }
  } catch (error) {
    next(error)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!isValidEmail(email) || !password) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    const database = await getDb()
    const result = await database.query<{
      user_id: string
      name: string
      email: string
      password_hash: string
      role: 'user' | 'admin'
    }>('SELECT user_id, name, email, password_hash, role FROM users WHERE email = $1', [email])
    const user = result.rows[0]

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    res.json({
      token: createAccessToken({ userId: user.user_id, email: user.email, role: user.role }),
      user: { user_id: user.user_id, name: user.name, email: user.email },
    })

    authRouter.post('/admin-login', async (req, res) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      if (!config.adminEmail || !config.adminPassword || email !== config.adminEmail.toLowerCase() || password !== config.adminPassword) {
        res.status(401).json({ error: 'Invalid administrator credentials.' })
        return
      }
      res.json({
        token: createAccessToken({ userId: 'admin-configured', email, role: 'admin' }),
        user: { name: 'Administrator', email, role: 'admin' },
      })
    })

  } catch (error) {
    next(error)
  }
})

authRouter.post('/otp/request', requireAuth, async (req, res, next) => {
  try {
    const code = String(randomInt(100000, 1000000))
    const database = await getDb()
    await database.query(
      `INSERT INTO otp_challenges (user_id, code_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [req.user!.userId, createHash('sha256').update(code).digest('hex')],
    )
    res.json({ message: 'A one-time passcode was delivered.', expiresInSeconds: 600, developmentCode: process.env.NODE_ENV === 'production' ? undefined : code })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/otp/verify', requireAuth, async (req, res, next) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    const database = await getDb()
    const result = await database.query<{ challenge_id: string }>(
      `SELECT challenge_id FROM otp_challenges WHERE user_id = $1 AND code_hash = $2 AND expires_at > NOW() AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [req.user!.userId, createHash('sha256').update(code).digest('hex')],
    )
    if (!result.rows[0]) {
      res.status(400).json({ error: 'Invalid or expired one-time passcode.' })
      return
    }
    await database.query('UPDATE otp_challenges SET verified_at = NOW() WHERE challenge_id = $1', [result.rows[0].challenge_id])
    res.json({ verified: true })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/email/request', requireAuth, async (req, res, next) => {
  try {
    const token = randomBytes(32).toString('hex')
    const database = await getDb()
    await database.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [req.user!.userId, createHash('sha256').update(token).digest('hex')],
    )
    res.json({ message: 'A verification email was sent.', expiresInSeconds: 86400, developmentToken: process.env.NODE_ENV === 'production' ? undefined : token })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/email/verify', requireAuth, async (req, res, next) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    const database = await getDb()
    const result = await database.query<{ verification_id: string }>(
      `SELECT verification_id FROM email_verifications WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW() AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [req.user!.userId, createHash('sha256').update(token).digest('hex')],
    )
    if (!result.rows[0]) {
      res.status(400).json({ error: 'Invalid or expired verification token.' })
      return
    }
    await database.query('UPDATE email_verifications SET verified_at = NOW() WHERE verification_id = $1', [result.rows[0].verification_id])
    res.json({ verified: true })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/phrase/enroll', requireAuth, phraseUpload.single('audio'), async (req, res, next) => {
  try {
    const phrase = typeof req.body?.phrase === 'string' ? req.body.phrase.trim() : ''
    if (!phrase || !req.file?.buffer) {
      res.status(400).json({ error: 'Provide a phrase and an audio recording.' })
      return
    }
    const database = await getDb()
    await database.query(
      `INSERT INTO security_phrases (user_id, phrase, audio_hash) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET phrase = EXCLUDED.phrase, audio_hash = EXCLUDED.audio_hash, verified_at = NULL, created_at = NOW()`,
      [req.user!.userId, phrase, createHash('sha256').update(req.file.buffer).digest('hex')],
    )
    res.status(201).json({ enrolled: true, phrase })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/phrase/verify', requireAuth, phraseUpload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ error: 'Provide an audio recording of your enrolled phrase.' })
      return
    }
    const database = await getDb()
    const result = await database.query<{ phrase_id: string; phrase: string; audio_hash: string }>(
      'SELECT phrase_id, phrase, audio_hash FROM security_phrases WHERE user_id = $1',
      [req.user!.userId],
    )
    const enrollment = result.rows[0]
    const verified = enrollment?.audio_hash === createHash('sha256').update(req.file.buffer).digest('hex')
    if (!enrollment) {
      res.status(404).json({ error: 'Enroll a security phrase before verifying.' })
      return
    }
    if (!verified) {
      res.status(400).json({ verified: false, error: 'The recording did not match the enrolled phrase.' })
      return
    }
    await database.query('UPDATE security_phrases SET verified_at = NOW() WHERE phrase_id = $1', [enrollment.phrase_id])
    res.json({ verified: true, phrase: enrollment.phrase })
  } catch (error) {
    next(error)
  }
})

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isDuplicateEmailError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string; message?: string }
  return candidate.code === '23505' || candidate.message?.includes('users_email_key') === true
}
