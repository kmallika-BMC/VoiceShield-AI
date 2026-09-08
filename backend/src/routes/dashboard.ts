import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import { getDb } from '../db.js'

export const dashboardRouter = Router()

dashboardRouter.get('/', requireAuth, async (req, res, next) => {
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
