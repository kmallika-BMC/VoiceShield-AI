import { Router } from 'express'
import { randomBytes, randomInt, createHash } from 'node:crypto'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { createAccessToken } from '../auth/jwt.js'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/require-auth.js'

const MINIMUM_PASSWORD_LENGTH = 8

export const authRouter = Router()

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
    }>('SELECT user_id, name, email, password_hash FROM users WHERE email = $1', [email])
    const user = result.rows[0]

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    res.json({
      token: createAccessToken({ userId: user.user_id, email: user.email }),
      user: { user_id: user.user_id, name: user.name, email: user.email },
    })

    authRouter.post('/otp/request', requireAuth, async (req, res, next) => {
      try {
        const code = String(randomInt(100000, 1000000))
        const codeHash = createHash('sha256').update(code).digest('hex')
        const database = await getDb()
        await database.query(
          `INSERT INTO otp_challenges (user_id, code_hash, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
          [req.user!.userId, codeHash],
        )
        res.json({
          message: 'A one-time passcode was delivered.',
          expiresInSeconds: 600,
          developmentCode: process.env.NODE_ENV === 'production' ? undefined : code,
        })
      } catch (error) {
        next(error)
      }
    })

    authRouter.post('/otp/verify', requireAuth, async (req, res, next) => {
      try {
        const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
        const database = await getDb()
        const result = await database.query<{ challenge_id: string }>(
          `SELECT challenge_id FROM otp_challenges
           WHERE user_id = $1 AND code_hash = $2 AND expires_at > NOW() AND verified_at IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [req.user!.userId, createHash('sha256').update(code).digest('hex')],
        )
        const challenge = result.rows[0]
        if (!challenge) {
          res.status(400).json({ error: 'Invalid or expired one-time passcode.' })
          return
        }
        await database.query('UPDATE otp_challenges SET verified_at = NOW() WHERE challenge_id = $1', [challenge.challenge_id])
        res.json({ verified: true })
      } catch (error) {
        next(error)
      }
    })

    authRouter.post('/email/request', requireAuth, async (req, res, next) => {
      try {
        const token = randomBytes(32).toString('hex')
        const tokenHash = createHash('sha256').update(token).digest('hex')
        const database = await getDb()
        await database.query(
          `INSERT INTO email_verifications (user_id, token_hash, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
          [req.user!.userId, tokenHash],
        )
        res.json({
          message: 'A verification email was sent.',
          expiresInSeconds: 86400,
          developmentToken: process.env.NODE_ENV === 'production' ? undefined : token,
        })
      } catch (error) {
        next(error)
      }
    })

    authRouter.post('/email/verify', requireAuth, async (req, res, next) => {
      try {
        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
        const database = await getDb()
        const result = await database.query<{ verification_id: string }>(
          `SELECT verification_id FROM email_verifications
           WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW() AND verified_at IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [req.user!.userId, createHash('sha256').update(token).digest('hex')],
        )
        const verification = result.rows[0]
        if (!verification) {
          res.status(400).json({ error: 'Invalid or expired verification token.' })
          return
        }
        await database.query('UPDATE email_verifications SET verified_at = NOW() WHERE verification_id = $1', [verification.verification_id])
        res.json({ verified: true })
      } catch (error) {
        next(error)
      }
    })
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
