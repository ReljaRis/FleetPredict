import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { notFound } from '../../lib/errors.js'
import { COMPONENTS, dateOnly, int, isoDay, optionalComponent, text } from '../../lib/validation.js'
import { findOwned, scope } from '../vehicles/vehicle.service.js'
import { assertWithinOdometer } from '../maintenance/maintenance.module.js'

const SEVERITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const STATUS = ['OPEN', 'UNDER_INSPECTION', 'RESOLVED'] as const

const input = z.object({
  vehicleId: z.string().min(1, 'Choose a vehicle.'),
  date: dateOnly(),
  km: int('Odometer'),
  engineHours: int('Engine hours'),
  component: optionalComponent,
  symptoms: text(3000).min(5, 'Describe what was noticed.'),
  severity: z.enum(SEVERITY, { error: 'Choose a severity.' }),
  status: z.enum(STATUS).default('OPEN'),
  reportedBy: text(120).min(1, 'Enter who reported it.'),
  notes: text(2000).default(''),
})

const listQuery = z.object({
  vehicleId: z.string().optional(),
  status: z.enum(STATUS).optional(),
  severity: z.enum(SEVERITY).optional(),
  component: z.enum(COMPONENTS).optional(),
  q: z.string().trim().max(80).optional(),
})

const include = { vehicle: { select: { fleetId: true, registration: true, manufacturer: true, model: true } } } as const
const ser = (f: Prisma.FaultReportGetPayload<{ include: typeof include }>) => ({ ...f, date: isoDay(f.date) })

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const q = parse(listQuery, req.query)
    const w: Prisma.FaultReportWhereInput = { companyId: a.companyId, vehicle: { is: scope(a) } }
    if (q.vehicleId) w.vehicleId = q.vehicleId
    if (q.status) w.status = q.status
    if (q.severity) w.severity = q.severity
    if (q.component) w.component = q.component
    if (q.q) w.OR = [{ symptoms: { contains: q.q, mode: 'insensitive' } }, { notes: { contains: q.q, mode: 'insensitive' } }, { reportedBy: { contains: q.q, mode: 'insensitive' } }]
    res.json((await prisma.faultReport.findMany({ where: w, include, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] })).map(ser))
  }),
)

router.post(
  '/',
  requirePermission('fault:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const i = parse(input, req.body)
    const v = await findOwned(a, i.vehicleId)
    assertWithinOdometer(v, i.km, i.engineHours)
    res.status(201).json(ser(await prisma.faultReport.create({ data: { companyId: a.companyId, ...i }, include })))
  }),
)

router.put(
  '/:id',
  requirePermission('fault:update'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    if (!(await prisma.faultReport.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } }))) throw notFound()
    const i = parse(input, req.body)
    const v = await findOwned(a, i.vehicleId)
    assertWithinOdometer(v, i.km, i.engineHours)
    res.json(ser(await prisma.faultReport.update({ where: { id }, data: i, include })))
  }),
)

router.patch(
  '/:id/status',
  requirePermission('fault:update'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    const { status } = parse(z.object({ status: z.enum(STATUS) }), req.body)
    if (!(await prisma.faultReport.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } }))) throw notFound()
    res.json(ser(await prisma.faultReport.update({ where: { id }, data: { status }, include })))
  }),
)

export default router
