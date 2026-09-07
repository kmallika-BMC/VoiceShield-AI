import { Router } from 'express'
import { hashPassword } from '../auth/password.js'
import { getDb } from '../db.js'

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
