import type { NextFunction, Request, Response } from 'express'

type RateLimitEntry = { count: number; resetAt: number }

const requests = new Map<string, RateLimitEntry>()
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000

export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production' && !isSecureRequest(req)) {
    res.status(426).json({ error: 'HTTPS is required for this service.' })
    return
  }
  next()
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now()
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  const entry = requests.get(key)

  if (!entry || entry.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs })
    next()
    return
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    res.setHeader('Retry-After', retryAfter)
    res.status(429).json({ error: 'Too many requests. Please try again later.' })
    return
  }

  entry.count += 1
  next()
}

function isSecureRequest(req: Request): boolean {
  const forwardedProtocol = req.header('x-forwarded-proto')?.split(',')[0]?.trim()
  return req.secure || forwardedProtocol === 'https'
}
