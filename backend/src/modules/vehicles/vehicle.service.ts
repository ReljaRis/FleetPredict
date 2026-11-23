import type { Prisma, Vehicle } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { conflict, notFound, badRequest } from '../../lib/errors.js'
import type { AuthContext } from '../../middleware/auth.js'
import { can } from '../auth/permissions.js'
import type { VehicleInput } from './vehicle.schemas.js'

const RISK_RANK = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 } as const

/**
 * Every query is scoped by the company id from the session. Drivers additionally only see
 * the vehicle assigned to them.
 */
export function scope(a: AuthContext): Prisma.VehicleWhereInput {
  return { companyId: a.companyId, ...(can(a.role, 'fleet:read-all') ? {} : { driverId: a.userId }) }
}

export async function findOwned(a: AuthContext, id: string) {
  const v = await prisma.vehicle.findFirst({ where: { id, ...scope(a) } })
  if (!v) throw notFound('That vehicle does not exist in your company.')
  return v
}

export const num = (d: unknown) => (d === null || d === undefined ? null : Number(d))

export function serialize(v: Vehicle) {
  return {
    ...v,
    displacementL: Number(v.displacementL),
    avgDailyHours: Number(v.avgDailyHours),
    purchaseDate: v.purchaseDate ? v.purchaseDate.toISOString().slice(0, 10) : null,
  }
}

type ListOpts = {
  q?: string
  status?: string
  risk?: string
  archived: 'true' | 'false' | 'all'
  sort: string
  dir: 'asc' | 'desc'
}

export async function listVehicles(a: AuthContext, o: ListOpts) {
  const where: Prisma.VehicleWhereInput = { ...scope(a) }
  if (o.archived !== 'all') where.archived = o.archived === 'true'
  if (o.status) where.status = o.status as Vehicle['status']
  if (o.q) {
    const contains = { contains: o.q, mode: 'insensitive' as const }
    where.OR = [{ fleetId: contains }, { registration: contains }, { vin: contains }, { manufacturer: contains }, { model: contains }, { variant: contains }, { location: contains }, { driverName: contains }]
  }
  const rows = await prisma.vehicle.findMany({
    where,
    include: { driver: { select: { name: true } }, predictions: { where: { status: { not: 'RESOLVED' } }, orderBy: { score: 'desc' }, take: 1 } },
  })
  let items = rows.map((v) => {
    const top = v.predictions[0]
    const { predictions: _p, driver, ...rest } = v
    return { ...serialize(rest as Vehicle), driverLabel: driver?.name ?? (v.driverName || null), topRisk: top ? { score: top.score, category: top.category, component: top.component } : null }
  })
  if (o.risk) items = items.filter((v) => v.topRisk?.category === o.risk)

  const dir = o.dir === 'asc' ? 1 : -1
  const cmp: Record<string, (x: (typeof items)[number], y: (typeof items)[number]) => number> = {
    fleetId: (x, y) => x.fleetId.localeCompare(y.fleetId, undefined, { numeric: true }),
    km: (x, y) => x.km - y.km,
    engineHours: (x, y) => x.engineHours - y.engineHours,
    year: (x, y) => x.year - y.year,
    manufacturer: (x, y) => `${x.manufacturer} ${x.model}`.localeCompare(`${y.manufacturer} ${y.model}`),
    status: (x, y) => x.status.localeCompare(y.status),
    // Vehicles with no prediction yet sort below every scored vehicle.
    risk: (x, y) => (x.topRisk?.score ?? -1) - (y.topRisk?.score ?? -1) || RISK_RANK[(x.topRisk?.category ?? 'LOW') as keyof typeof RISK_RANK] - RISK_RANK[(y.topRisk?.category ?? 'LOW') as keyof typeof RISK_RANK],
  }
  items.sort((x, y) => dir * cmp[o.sort](x, y))
  return items
}

function data(i: VehicleInput) {
  const { purchaseDate, driverId, imageUrl, purchasePrice, ...rest } = i
  return { ...rest, imageUrl: imageUrl ?? null, purchasePrice: purchasePrice ?? null, purchaseDate: purchaseDate ? new Date(purchaseDate) : null, driverId: driverId ?? null }
}

async function checkDriver(a: AuthContext, driverId: string | null | undefined) {
  if (!driverId) return
  const u = await prisma.user.findFirst({ where: { id: driverId, companyId: a.companyId, active: true } })
  if (!u) throw badRequest('Some fields need attention.', { driverId: 'Choose a driver from your company.' })
}

export async function createVehicle(a: AuthContext, input: VehicleInput) {
  await checkDriver(a, input.driverId)
  if (await prisma.vehicle.findUnique({ where: { companyId_fleetId: { companyId: a.companyId, fleetId: input.fleetId } } })) {
    throw conflict('That fleet ID is already used.', { fleetId: 'Another vehicle already has this fleet ID.' })
  }
  return prisma.$transaction(async (tx) => {
    const v = await tx.vehicle.create({ data: { companyId: a.companyId, ...data(input) } })
    await tx.vehicleReading.create({ data: { companyId: a.companyId, vehicleId: v.id, recordedAt: new Date(), km: v.km, engineHours: v.engineHours, source: 'MANUAL' } })
    return v
  })
}

export async function updateVehicle(a: AuthContext, id: string, input: VehicleInput) {
  const current = await findOwned(a, id)
  await checkDriver(a, input.driverId)
  if (input.fleetId !== current.fleetId && (await prisma.vehicle.findUnique({ where: { companyId_fleetId: { companyId: a.companyId, fleetId: input.fleetId } } }))) {
    throw conflict('That fleet ID is already used.', { fleetId: 'Another vehicle already has this fleet ID.' })
  }
  const moved = input.km !== current.km || input.engineHours !== current.engineHours
  if (moved) await assertReadingFits(id, new Date(), input.km, input.engineHours)
  return prisma.$transaction(async (tx) => {
    const v = await tx.vehicle.update({ where: { id }, data: data(input) })
    // A changed odometer is a new reading, so the history stays consistent with the vehicle record.
    if (moved) await tx.vehicleReading.create({ data: { companyId: a.companyId, vehicleId: id, recordedAt: new Date(), km: input.km, engineHours: input.engineHours, source: 'MANUAL' } })
    return v
  })
}

export async function setArchived(a: AuthContext, id: string, archived: boolean) {
  await findOwned(a, id)
  return prisma.vehicle.update({ where: { id }, data: { archived } })
}

/**
 * A reading must sit between its neighbours in time: odometer and engine hours never go down.
 */
export async function assertReadingFits(vehicleId: string, at: Date, km: number, hours: number, ignoreId?: string) {
  const notSelf = ignoreId ? { id: { not: ignoreId } } : {}
  const prev = await prisma.vehicleReading.findFirst({ where: { vehicleId, recordedAt: { lte: at }, ...notSelf }, orderBy: { recordedAt: 'desc' } })
  const next = await prisma.vehicleReading.findFirst({ where: { vehicleId, recordedAt: { gt: at }, ...notSelf }, orderBy: { recordedAt: 'asc' } })
  const errors: Record<string, string> = {}
  if (prev && km < prev.km) errors.km = `Lower than the previous reading (${prev.km.toLocaleString('en-GB')} km).`
  if (next && km > next.km) errors.km = `Higher than a later reading (${next.km.toLocaleString('en-GB')} km).`
  if (prev && hours < prev.engineHours) errors.engineHours = `Lower than the previous reading (${prev.engineHours.toLocaleString('en-GB')} h).`
  if (next && hours > next.engineHours) errors.engineHours = `Higher than a later reading (${next.engineHours.toLocaleString('en-GB')} h).`
  if (Object.keys(errors).length) throw badRequest('That reading does not fit the history.', errors)
}

export async function addReading(a: AuthContext, vehicleId: string, i: { recordedAt: Date; km: number; engineHours: number }) {
  await findOwned(a, vehicleId)
  if (i.recordedAt.getTime() > Date.now() + 5 * 60_000) throw badRequest('Some fields need attention.', { recordedAt: 'A reading cannot be dated in the future.' })
  await assertReadingFits(vehicleId, i.recordedAt, i.km, i.engineHours)
  return prisma.$transaction(async (tx) => {
    const r = await tx.vehicleReading.create({ data: { companyId: a.companyId, vehicleId, ...i, source: 'MANUAL' } })
    await syncVehicleToLatest(tx, vehicleId)
    return r
  })
}

/** The vehicle's current odometer and hours always equal its newest reading. */
export async function syncVehicleToLatest(tx: Prisma.TransactionClient, vehicleId: string) {
  const latest = await tx.vehicleReading.findFirst({ where: { vehicleId }, orderBy: { recordedAt: 'desc' } })
  if (latest) await tx.vehicle.update({ where: { id: vehicleId }, data: { km: latest.km, engineHours: latest.engineHours } })
}

export async function readingsWithSummary(a: AuthContext, vehicleId: string, from?: Date, to?: Date) {
  await findOwned(a, vehicleId)
  const where: Prisma.VehicleReadingWhereInput = { vehicleId, recordedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
  const readings = await prisma.vehicleReading.findMany({ where, orderBy: { recordedAt: 'asc' } })
  let summary: { distanceKm: number; hours: number; days: number; avgDailyKm: number | null; avgDailyHours: number | null } | null = null
  if (readings.length >= 2) {
    const first = readings[0]
    const last = readings[readings.length - 1]
    const days = Math.max(1, (last.recordedAt.getTime() - first.recordedAt.getTime()) / 86_400_000)
    const distanceKm = last.km - first.km
    const hours = last.engineHours - first.engineHours
    summary = { distanceKm, hours, days: Math.round(days), avgDailyKm: Math.round(distanceKm / days), avgDailyHours: Math.round((hours / days) * 10) / 10 }
  }
  return { readings, summary }
}
