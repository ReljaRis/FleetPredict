import { Router } from 'express'
import { z } from 'zod'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { conflict, badRequest, notFound } from '../../lib/errors.js'
import { text } from '../../lib/validation.js'
import { hash } from '../auth/auth.service.js'
import { emailConfigured, generateDocumentNotifications } from '../notifications/notifications.service.js'

const router = Router()
router.use(requireAuth)

const publicCompany = (c: { id: string; name: string; country: string; vatId: string; isDemo: boolean; notifyEmail: boolean; notifyInApp: boolean; notifyThresholds: number[] }) => ({
  id: c.id, name: c.name, country: c.country, vatId: c.vatId, isDemo: c.isDemo, notifyEmail: c.notifyEmail, notifyInApp: c.notifyInApp, notifyThresholds: [...c.notifyThresholds].sort((a, b) => b - a),
})

router.get(
  '/',
  handler(async (req, res) => {
    const c = await prisma.company.findUniqueOrThrow({ where: { id: ctx(req).companyId } })
    res.json({ company: publicCompany(c), emailConfigured: emailConfigured() })
  }),
)

router.put(
  '/',
  requirePermission('company:write'),
  handler(async (req, res) => {
    const i = parse(z.object({ name: text(120).min(2, 'Enter the company name.'), country: text(80).default(''), vatId: text(40).default('') }), req.body)
    res.json({ company: publicCompany(await prisma.company.update({ where: { id: ctx(req).companyId }, data: i })) })
  }),
)

const THRESHOLDS = [90, 60, 30, 14, 7, 3, 1, 0]
router.put(
  '/notifications',
  requirePermission('document:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const i = parse(
      z.object({
        notifyEmail: z.boolean(),
        notifyInApp: z.boolean(),
        notifyThresholds: z.array(z.number().int().refine((n) => THRESHOLDS.includes(n), 'Choose from the listed options.')).min(1, 'Choose at least one reminder.').max(THRESHOLDS.length),
      }),
      req.body,
    )
    const c = await prisma.company.update({ where: { id: a.companyId }, data: { ...i, notifyThresholds: [...new Set(i.notifyThresholds)] } })
    await generateDocumentNotifications(a.companyId).catch((e) => console.error(e))
    res.json({ company: publicCompany(c) })
  }),
)

/* ---------- Users and roles (Owner only) ---------- */
const userRow = (u: { id: string; name: string; email: string; role: string; active: boolean; createdAt: Date }) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, createdAt: u.createdAt })

router.get(
  '/users',
  requirePermission('users:write'),
  handler(async (req, res) => {
    const rows = await prisma.user.findMany({ where: { companyId: ctx(req).companyId }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] })
    res.json(rows.map(userRow))
  }),
)

router.post(
  '/users',
  requirePermission('users:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const i = parse(
      z.object({
        name: text(120).min(2, 'Enter the name.'),
        email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
        role: z.enum(['MANAGER', 'MECHANIC', 'DRIVER'], { error: 'Choose a role.' }),
        password: z.string().min(8, 'Use at least 8 characters.').max(200),
      }),
      req.body,
    )
    if (await prisma.user.findUnique({ where: { email: i.email } })) throw conflict('An account with this email already exists.', { email: 'This email is already registered.' })
    const u = await prisma.user.create({ data: { companyId: a.companyId, name: i.name, email: i.email, role: i.role, passwordHash: await hash(i.password) } })
    res.status(201).json(userRow(u))
  }),
)

router.patch(
  '/users/:id',
  requirePermission('users:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    const i = parse(z.object({ role: z.enum(['MANAGER', 'MECHANIC', 'DRIVER']).optional(), active: z.boolean().optional(), name: text(120).min(2).optional() }), req.body)
    const target = await prisma.user.findFirst({ where: { id, companyId: a.companyId } })
    if (!target) throw notFound('That user does not exist in your company.')
    // Owners are not edited here, and nobody can lock themselves out or demote themselves.
    if (target.role === 'OWNER') throw badRequest('The owner account cannot be changed here.')
    if (target.id === a.userId) throw badRequest('You cannot change your own role or access.')
    res.json(userRow(await prisma.user.update({ where: { id }, data: i })))
  }),
)

export default router
