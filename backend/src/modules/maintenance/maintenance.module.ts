import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { CATEGORIES, COMPONENTS, dateOnly, int, isoDay, money, optionalComponent, text } from '../../lib/validation.js'
import { findOwned, scope } from '../vehicles/vehicle.service.js'
import type { AuthContext } from '../../middleware/auth.js'

const input = z.object({
  vehicleId: z.string().min(1, 'Choose a vehicle.'),
  date: dateOnly(),
  km: int('Odometer'),
  engineHours: int('Engine hours'),
  category: z.enum(CATEGORIES, { error: 'Choose a category.' }),
  component: optionalComponent,
  routine: z.boolean().default(false),
  description: text(2000).min(3, 'Describe the work performed.'),
  parts: text(500).default(''),
  laborCost: money('Labour cost').default(0),
  partsCost: money('Parts cost').default(0),
  provider: text(120).min(1, 'Enter the workshop or mechanic.'),
  notes: text(2000).default(''),
})

const listQuery = z.object({
  vehicleId: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
  component: z.enum(COMPONENTS).optional(),
  q: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

/** A service at kilometre X cannot be recorded on a vehicle whose odometer is below X: add a reading first. */
export function assertWithinOdometer(v: { km: number; engineHours: number }, km: number, hours: number) {
  const fields: Record<string, string> = {}
  if (km > v.km) fields.km = `Higher than the vehicle's current odometer (${v.km.toLocaleString('en-GB')} km). Add a newer reading first.`
  if (hours > v.engineHours) fields.engineHours = `Higher than the vehicle's current engine hours (${v.engineHours.toLocaleString('en-GB')} h). Add a newer reading first.`
  if (Object.keys(fields).length) throw badRequest('That does not fit the vehicle history.', fields)
}

const ser = (m: Prisma.MaintenanceRecordGetPayload<{ include: { vehicle: { select: { fleetId: true; registration: true; manufacturer: true; model: true } } } }>) => ({
  ...m,
  date: isoDay(m.date),
  laborCost: Number(m.laborCost),
  partsCost: Number(m.partsCost),
  totalCost: Number(m.laborCost) + Number(m.partsCost),
})

const include = { vehicle: { select: { fleetId: true, registration: true, manufacturer: true, model: true } } } as const

function where(a: AuthContext, q: z.infer<typeof listQuery>): Prisma.MaintenanceRecordWhereInput {
  const w: Prisma.MaintenanceRecordWhereInput = { companyId: a.companyId, vehicle: { is: scope(a) } }
  if (q.vehicleId) w.vehicleId = q.vehicleId
  if (q.category) w.category = q.category
  if (q.component) w.component = q.component
  if (q.from || q.to) w.date = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) }
  if (q.q) {
    const c = { contains: q.q, mode: 'insensitive' as const }
    w.OR = [{ description: c }, { provider: c }, { parts: c }, { notes: c }]
  }
  return w
}

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const rows = await prisma.maintenanceRecord.findMany({ where: where(a, parse(listQuery, req.query)), include, orderBy: [{ date: 'desc' }, { km: 'desc' }] })
    res.json(rows.map(ser))
  }),
)

/** Cost overview for the same filters: totals, by category, by component and by month. */
router.get(
  '/summary',
  handler(async (req, res) => {
    const a = ctx(req)
    const rows = await prisma.maintenanceRecord.findMany({ where: where(a, parse(listQuery, req.query)), select: { date: true, category: true, component: true, laborCost: true, partsCost: true, routine: true } })
    const byCategory: Record<string, number> = {}
    const byMonth: Record<string, number> = {}
    let total = 0
    let repairs = 0
    for (const r of rows) {
      const c = Number(r.laborCost) + Number(r.partsCost)
      total += c
      if (!r.routine) repairs += c
      byCategory[r.category] = (byCategory[r.category] ?? 0) + c
      const m = isoDay(r.date).slice(0, 7)
      byMonth[m] = (byMonth[m] ?? 0) + c
    }
    res.json({
      count: rows.length,
      total,
      routine: total - repairs,
      repairs,
      byCategory: Object.entries(byCategory).map(([category, cost]) => ({ category, cost })).sort((x, y) => y.cost - x.cost),
      byMonth: Object.entries(byMonth).map(([month, cost]) => ({ month, cost })).sort((x, y) => x.month.localeCompare(y.month)),
    })
  }),
)

router.post(
  '/',
  requirePermission('maintenance:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const i = parse(input, req.body)
    const v = await findOwned(a, i.vehicleId)
    assertWithinOdometer(v, i.km, i.engineHours)
    const row = await prisma.maintenanceRecord.create({ data: { companyId: a.companyId, ...i }, include })
    res.status(201).json(ser(row))
  }),
)

router.put(
  '/:id',
  requirePermission('maintenance:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    const existing = await prisma.maintenanceRecord.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } })
    if (!existing) throw notFound()
    const i = parse(input, req.body)
    const v = await findOwned(a, i.vehicleId)
    assertWithinOdometer(v, i.km, i.engineHours)
    res.json(ser(await prisma.maintenanceRecord.update({ where: { id }, data: i, include })))
  }),
)

router.delete(
  '/:id',
  requirePermission('maintenance:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    const existing = await prisma.maintenanceRecord.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } })
    if (!existing) throw notFound()
    await prisma.maintenanceRecord.delete({ where: { id } })
    res.status(204).end()
  }),
)

export default router
