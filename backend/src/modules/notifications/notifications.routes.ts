import { Router } from 'express'
import { z } from 'zod'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { can } from '../auth/permissions.js'
import { emailConfigured, runForCompany } from './notifications.service.js'

const router = Router()
router.use(requireAuth)

/**
 * Notifications are company-wide and mention every vehicle, so only roles that may see the whole fleet receive them.
 * A company can also switch in-app notifications off; the rows still exist as the record of what was already sent.
 */
router.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const company = await prisma.company.findUniqueOrThrow({ where: { id: a.companyId }, select: { notifyInApp: true } })
    if (!company.notifyInApp || !can(a.role, 'fleet:read-all')) return res.json({ items: [], unread: 0, inAppEnabled: company.notifyInApp })
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { companyId: a.companyId }, orderBy: { createdAt: 'desc' }, take: 60 }),
      prisma.notification.count({ where: { companyId: a.companyId, read: false } }),
    ])
    res.json({ items, unread, inAppEnabled: true, emailConfigured: emailConfigured() })
  }),
)

router.post(
  '/read',
  handler(async (req, res) => {
    const a = ctx(req)
    const { ids } = parse(z.object({ ids: z.array(z.string()).max(200).optional() }), req.body ?? {})
    const r = await prisma.notification.updateMany({ where: { companyId: a.companyId, read: false, ...(ids ? { id: { in: ids } } : {}) }, data: { read: true } })
    res.json({ updated: r.count })
  }),
)

/** Runs the same check as the daily job, for the signed-in company. */
router.post(
  '/run',
  requirePermission('document:write'),
  handler(async (req, res) => {
    res.json(await runForCompany(ctx(req).companyId))
  }),
)

export default router
