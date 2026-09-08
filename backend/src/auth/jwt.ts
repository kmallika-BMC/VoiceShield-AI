import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export type AuthenticatedUser = {
  userId: string
  email: string
}

export function createAccessToken(user: AuthenticatedUser): string {
  return jwt.sign({ email: user.email }, config.jwtSecret, {
    subject: user.userId,
    expiresIn: '1h',
  })
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  const payload = jwt.verify(token, config.jwtSecret)

  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string'
  ) {
    throw new Error('Invalid access token payload')
  }

  return { userId: payload.sub, email: payload.email }
}
