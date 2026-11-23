import { Router } from 'express'
import { ctx, requireAuth } from '../../middleware/auth.js'
import { handler } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { can } from '../auth/permissions.js'
import { forbidden } from '../../lib/errors.js'

const router = Router()
router.use(requireAuth)

/** Active drivers of the caller's company, for assigning a driver to a vehicle. */
router.get(
  '/drivers',
  handler(async (req, res) => {
    const a = ctx(req)
    if (!can(a.role, 'fleet:read-all')) throw forbidden()
    const rows = await prisma.user.findMany({ where: { companyId: a.companyId, role: 'DRIVER', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    res.json(rows)
  }),
)

export default router
