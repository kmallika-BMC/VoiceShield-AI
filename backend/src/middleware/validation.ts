import type { NextFunction, Request, Response } from 'express'

export function validateJsonBody(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.is('application/json')) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' })
      return
    }
  }
  next()
}
