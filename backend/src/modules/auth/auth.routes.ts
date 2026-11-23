import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { COOKIE, ctx, requireAuth } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { isProd } from '../../config/env.js'
import { authenticate, changePassword, profile, registerCompany, SESSION_DAYS, signToken } from './auth.service.js'
import { prisma } from '../../lib/prisma.js'

const router = Router()

// Slows down password guessing and mass sign-up from one address.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Wait a few minutes and try again.' } },
})

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254)

const registerSchema = z.object({
  company: z.string().trim().min(2, 'Enter the company name.').max(120),
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email,
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
})
const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.') })

function setSession(res: import('express').Response, userId: string) {
  res.cookie(COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

router.post(
  '/register',
  limiter,
  handler(async (req, res) => {
    const user = await registerCompany(parse(registerSchema, req.body))
    setSession(res, user.id)
    res.status(201).json(await profile(user.id))
  }),
)

router.post(
  '/login',
  limiter,
  handler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body)
    const user = await authenticate(email, password)
    setSession(res, user.id)
    res.json(await profile(user.id))
  }),
)

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' })
  res.status(204).end()
})

router.get(
  '/me',
  requireAuth,
  handler(async (req, res) => {
    res.json(await profile(ctx(req).userId))
  }),
)

router.put(
  '/profile',
  requireAuth,
  handler(async (req, res) => {
    const { name } = parse(z.object({ name: z.string().trim().min(2, 'Enter your name.').max(120) }), req.body)
    await prisma.user.update({ where: { id: ctx(req).userId }, data: { name } })
    res.json(await profile(ctx(req).userId))
  }),
)

router.post(
  '/password',
  requireAuth,
  limiter,
  handler(async (req, res) => {
    const i = parse(z.object({ currentPassword: z.string().min(1, 'Enter your current password.'), newPassword: z.string().min(8, 'Use at least 8 characters.').max(200) }), req.body)
    await changePassword(ctx(req).userId, i.currentPassword, i.newPassword)
    res.status(204).end()
  }),
)

export default router
