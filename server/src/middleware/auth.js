import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { verifyAccessToken } from '../services/tokenService.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing access token' })
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length))
    const user = await User.findById(payload.sub)
    if (!user) return res.status(401).json({ error: 'user not found' })

    req.user = user
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'access token expired' })
    }
    return res.status(401).json({ error: 'invalid access token' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    next()
  }
}

// loadResource(req) -> doc with a userId/instructorId field, or null. Admins bypass the check.
export function requireOwnership(loadResource, ownerField = 'userId') {
  return async (req, res, next) => {
    if (req.user.role === 'admin') return next()

    const resource = await loadResource(req)
    if (!resource) return res.status(404).json({ error: 'not found' })

    if (String(resource[ownerField]) !== String(req.user._id)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    req.resource = resource
    next()
  }
}
