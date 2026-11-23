import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { int, text } from '../../lib/validation.js'
import { findOwned, scope, syncVehicleToLatest } from '../vehicles/vehicle.service.js'

const input = z.object({
  vehicleId: z.string().min(1, 'Choose a vehicle.'),
  origin: text(120).min(1, 'Enter the starting location.'),
  destination: text(120).min(1, 'Enter the destination.'),
  departure: z.coerce.date({ error: 'Enter a valid departure.' }),
  arrival: z.coerce.date({ error: 'Enter a valid arrival.' }),
  distanceKm: int('Distance', 1, 5000),
  hours: z.coerce.number({ error: 'Hours must be a number.' }).min(0.1, 'Enter the engine hours.').max(72, 'That is more than 72 hours.'),
  driverName: text(120).min(1, 'Enter the driver.'),
  loadKg: z.union([z.literal('').transform(() => null), z.null(), z.coerce.number().int().min(0).max(200_000)]).optional().transform((v) => v ?? null),
  notes: text(2000).default(''),
})

const listQuery = z.object({
  vehicleId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(80).optional(),
})

const include = { vehicle: { select: { fleetId: true, registration: true, manufacturer: true, model: true } } } as const
const ser = (t: Prisma.TripGetPayload<{ include: typeof include }>) => ({ ...t, hours: Number(t.hours) })

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const q = parse(listQuery, req.query)
    const w: Prisma.TripWhereInput = { companyId: a.companyId, vehicle: { is: scope(a) } }
    if (q.vehicleId) w.vehicleId = q.vehicleId
    if (q.from || q.to) w.departure = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) }
    if (q.q) w.OR = [{ origin: { contains: q.q, mode: 'insensitive' } }, { destination: { contains: q.q, mode: 'insensitive' } }, { driverName: { contains: q.q, mode: 'insensitive' } }, { notes: { contains: q.q, mode: 'insensitive' } }]
    const trips = (await prisma.trip.findMany({ where: w, include, orderBy: { departure: 'desc' } })).map(ser)
    const summary = trips.reduce((s, t) => ({ trips: s.trips + 1, distanceKm: s.distanceKm + t.distanceKm, hours: Math.round((s.hours + t.hours) * 10) / 10 }), { trips: 0, distanceKm: 0, hours: 0 })
    res.json({ trips, summary })
  }),
)

router.post(
  '/',
  requirePermission('trip:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const i = parse(input, req.body)
    await findOwned(a, i.vehicleId)
    const fields: Record<string, string> = {}
    if (i.arrival <= i.departure) fields.arrival = 'Arrival must be after departure.'
    else if (i.arrival.getTime() > Date.now() + 5 * 60_000) fields.arrival = 'A trip cannot end in the future.'
    else if (i.hours > (i.arrival.getTime() - i.departure.getTime()) / 3_600_000 + 0.05) fields.hours = 'Engine hours cannot exceed the time between departure and arrival.'
    if (Object.keys(fields).length) throw badRequest('Some fields need attention.', fields)

    const trip = await prisma.$transaction(async (tx) => {
      const t = await tx.trip.create({ data: { companyId: a.companyId, ...i }, include })
      // A trip that ended after the newest reading moves the odometer and engine hours forward.
      // A historical trip (older than the newest reading) is only recorded, so readings stay consistent.
      const latest = await tx.vehicleReading.findFirst({ where: { vehicleId: i.vehicleId }, orderBy: { recordedAt: 'desc' } })
      if (!latest || i.arrival > latest.recordedAt) {
        await tx.vehicleReading.create({
          data: { companyId: a.companyId, vehicleId: i.vehicleId, recordedAt: i.arrival, km: (latest?.km ?? 0) + i.distanceKm, engineHours: Math.round((latest?.engineHours ?? 0) + i.hours), source: 'TRIP' },
        })
        await syncVehicleToLatest(tx, i.vehicleId)
      }
      return t
    })
    res.status(201).json(ser(trip))
  }),
)

router.delete(
  '/:id',
  requirePermission('trip:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    if (!(await prisma.trip.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } }))) throw notFound()
    // Deleting a trip does not rewrite odometer history; correct it with a manual reading if needed.
    await prisma.trip.delete({ where: { id } })
    res.status(204).end()
  }),
)

export default router
