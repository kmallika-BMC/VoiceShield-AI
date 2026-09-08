import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken, type AuthenticatedUser } from '../auth/jwt.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : ''

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }

  try {
    req.user = verifyAccessToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token.' })
  }
}
