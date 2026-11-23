import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import { can, type Permission } from '../modules/auth/permissions.js'

export const COOKIE = 'fp_session'

export interface AuthContext {
  userId: string
  companyId: string
  role: Role
  name: string
  email: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

/**
 * Authenticates the session cookie and loads the user fresh from the database on every request,
 * so a deactivated user or changed role takes effect immediately. The company id used for every
 * query comes from here, never from the request body or URL.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[COOKIE]
    if (!token) throw unauthorized()
    let payload: jwt.JwtPayload
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload
    } catch {
      throw unauthorized('Your session has ended. Sign in again.')
    }
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } })
    if (!user || !user.active) throw unauthorized('Your session has ended. Sign in again.')
    req.auth = { userId: user.id, companyId: user.companyId, role: user.role, name: user.name, email: user.email }
    next()
  } catch (e) {
    next(e)
  }
}

export const requirePermission =
  (p: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized())
    if (!can(req.auth.role, p)) return next(forbidden(`The ${req.auth.role.toLowerCase()} role cannot do this.`))
    next()
  }

/** Typed accessor for handlers that sit behind requireAuth. */
export function ctx(req: Express.Request): AuthContext {
  if (!req.auth) throw unauthorized()
  return req.auth
}
