import { Router } from 'express'
import { getDb } from '../db.js'
import { requireAuth } from '../middleware/require-auth.js'

export const profileRouter = Router()

profileRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const database = await getDb()
    const result = await database.query<{ user_id: string; name: string; email: string }>(
      'SELECT user_id, name, email FROM users WHERE user_id = $1',
      [req.user?.userId],
    )
    const user = result.rows[0]

    if (!user) {
      res.status(404).json({ error: 'User account not found.' })
      return
    }

    res.json({ user })
  } catch (error) {
    next(error)
  }
})

profileRouter.patch('/', requireAuth, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name) {
      res.status(400).json({ error: 'Name is required.' })
      return
    }

    const database = await getDb()
    const result = await database.query<{ user_id: string; name: string; email: string }>(
      `UPDATE users SET name = $1 WHERE user_id = $2
       RETURNING user_id, name, email`,
      [name, req.user?.userId],
    )
    const user = result.rows[0]

    if (!user) {
      res.status(404).json({ error: 'User account not found.' })
      return
    }

    res.json({ user })
  } catch (error) {
    next(error)
  }
})
