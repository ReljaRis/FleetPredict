import { Router } from 'express'
import { z } from 'zod'
import { ctx, requireAuth } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { COMPONENTS } from '../engine/config.js'
import { estimate } from '../engine/finance.js'
import { daysLeft, docStatus } from '../documents/status.js'
import { isoDay } from '../../lib/validation.js'
import { scope } from '../vehicles/vehicle.service.js'

const query = z.object({ months: z.coerce.number().int().min(1).max(24).default(12) })
const RANK = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 } as const
type Cat = keyof typeof RANK

const router = Router()
router.use(requireAuth)

/** Everything on the control room page, computed from stored records. Nothing here is hard-coded. */
router.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const { months } = parse(query, req.query)
    const now = new Date()
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
    const vScope = { ...scope(a), archived: false }

    const [vehicles, openFaults, docs, maint, readings] = await Promise.all([
      prisma.vehicle.findMany({ where: vScope, include: { predictions: { where: { status: { not: 'RESOLVED' } }, include: { factors: { orderBy: { points: 'desc' }, take: 2 } } } } }),
      prisma.faultReport.findMany({ where: { companyId: a.companyId, status: { not: 'RESOLVED' }, vehicle: { is: vScope } }, include: { vehicle: { select: { fleetId: true, registration: true } } }, orderBy: [{ date: 'desc' }] }),
      prisma.document.findMany({ where: { companyId: a.companyId, vehicle: { is: vScope } }, include: { vehicle: { select: { fleetId: true, registration: true } } }, orderBy: { expiryDate: 'asc' } }),
      prisma.maintenanceRecord.findMany({ where: { companyId: a.companyId, date: { gte: since }, vehicle: { is: vScope } }, select: { date: true, category: true, laborCost: true, partsCost: true, routine: true } }),
      prisma.vehicleReading.findMany({ where: { companyId: a.companyId, recordedAt: { gte: new Date(since.getTime() - 40 * 86_400_000) }, vehicle: { is: vScope } }, select: { vehicleId: true, recordedAt: true, km: true }, orderBy: { recordedAt: 'asc' } }),
    ])

    // Fleet condition ----------------------------------------------------------------------------------
    const status = { operational: 0, inService: 0, outOfService: 0, highRiskStatus: 0 }
    for (const v of vehicles) {
      if (v.status === 'OPERATIONAL') status.operational++
      else if (v.status === 'IN_SERVICE') status.inService++
      else if (v.status === 'OUT_OF_SERVICE') status.outOfService++
      else status.highRiskStatus++
    }
    const worst = (v: (typeof vehicles)[number]): Cat => v.predictions.reduce<Cat>((w, p) => (RANK[p.category] > RANK[w] ? p.category : w), 'LOW')
    const riskDist: Record<Cat, number> = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 }
    for (const v of vehicles) riskDist[worst(v)]++
    const elevated = vehicles.filter((v) => RANK[worst(v)] >= RANK.HIGH).length

    // Predictions -------------------------------------------------------------------------------------------
    const allPreds = vehicles.flatMap((v) => v.predictions.map((p) => ({ p, v })))
    const present = ({ p, v }: (typeof allPreds)[number]) => {
      const e = estimate(p.score, p.repairCost === null ? null : Number(p.repairCost), p.preventiveCost === null ? null : Number(p.preventiveCost))
      return { id: p.id, vehicleId: v.id, fleetId: v.fleetId, registration: v.registration, vehicle: [v.manufacturer, v.model, v.variant].filter(Boolean).join(' '), component: p.component, label: COMPONENTS[p.component].label, score: p.score, category: p.category, timeframe: p.timeframe, action: p.action, status: p.status, why: p.factors.map((f) => f.label), savings: e.available ? e.savings : null }
    }
    const ranked = allPreds.filter((x) => x.p.category !== 'LOW').sort((x, y) => y.p.score - x.p.score)
    const needsAttention = ranked.filter((x) => RANK[x.p.category] >= RANK.HIGH).slice(0, 6).map(present)
    const upcoming = ranked.filter((x) => x.p.category === 'MODERATE').slice(0, 6).map(present)
    const potentialSavings = Math.round(
      allPreds.filter((x) => RANK[x.p.category] >= RANK.HIGH).reduce((s, x) => {
        const e = estimate(x.p.score, x.p.repairCost === null ? null : Number(x.p.repairCost), x.p.preventiveCost === null ? null : Number(x.p.preventiveCost))
        return s + (e.available && (e.savings ?? 0) > 0 ? e.savings! : 0)
      }, 0),
    )
    const highestRiskVehicles = [...vehicles]
      .map((v) => ({ v, top: [...v.predictions].sort((x, y) => y.score - x.score)[0] }))
      .filter((x) => x.top && x.top.category !== 'LOW')
      .sort((x, y) => y.top.score - x.top.score)
      .slice(0, 5)
      .map(({ v, top }) => ({ vehicleId: v.id, fleetId: v.fleetId, vehicle: [v.manufacturer, v.model, v.variant].filter(Boolean).join(' '), registration: v.registration, status: v.status, component: COMPONENTS[top.component].label, score: top.score, category: top.category }))

    // Documents ------------------------------------------------------------------------------------------------
    const docRows = docs.map((d) => ({ id: d.id, vehicleId: d.vehicleId, fleetId: d.vehicle.fleetId, type: d.type, expiryDate: isoDay(d.expiryDate), status: docStatus(d.expiryDate), daysLeft: daysLeft(d.expiryDate) }))
    const docCounts = { expired: docRows.filter((d) => d.status === 'EXPIRED').length, urgent: docRows.filter((d) => d.status === 'RED').length, dueSoon: docRows.filter((d) => d.status === 'YELLOW').length }
    const documentAlerts = docRows.filter((d) => d.status !== 'GREEN').slice(0, 7)

    // Costs ---------------------------------------------------------------------------------------------------
    const costByMonth = new Map<string, number>()
    const costByCategory = new Map<string, number>()
    let total = 0
    let routine = 0
    for (let i = 0; i < months; i++) costByMonth.set(isoDay(new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1))).slice(0, 7), 0)
    for (const m of maint) {
      const c = Number(m.laborCost) + Number(m.partsCost)
      total += c
      if (m.routine) routine += c
      const k = isoDay(m.date).slice(0, 7)
      costByMonth.set(k, (costByMonth.get(k) ?? 0) + c)
      costByCategory.set(m.category, (costByCategory.get(m.category) ?? 0) + c)
    }

    // Fleet mileage per month: the odometer difference between consecutive readings of each vehicle,
    // booked to the month of the later reading.
    const km = new Map<string, number>()
    for (const k of costByMonth.keys()) km.set(k, 0)
    const lastBy = new Map<string, number>()
    for (const r of readings) {
      const prev = lastBy.get(r.vehicleId)
      if (prev !== undefined && r.recordedAt >= since) {
        const k = isoDay(r.recordedAt).slice(0, 7)
        if (km.has(k)) km.set(k, (km.get(k) ?? 0) + Math.max(0, r.km - prev))
      }
      lastBy.set(r.vehicleId, r.km)
    }

    res.json({
      months,
      counts: {
        vehicles: vehicles.length,
        ...status,
        elevatedRisk: elevated,
        openFaults: openFaults.length,
        criticalFaults: openFaults.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH').length,
        documents: docCounts,
        maintenanceCost: Math.round(total),
        routineCost: Math.round(routine),
        potentialSavings,
      },
      riskDistribution: riskDist,
      needsAttention,
      upcoming,
      highestRiskVehicles,
      documentAlerts,
      recentFaults: openFaults.slice(0, 5).map((f) => ({ id: f.id, vehicleId: f.vehicleId, fleetId: f.vehicle.fleetId, component: f.component ? COMPONENTS[f.component].label : null, severity: f.severity, status: f.status, date: isoDay(f.date), symptoms: f.symptoms })),
      costByMonth: [...costByMonth].map(([month, cost]) => ({ month, cost: Math.round(cost) })),
      costByCategory: [...costByCategory].map(([category, cost]) => ({ category, cost: Math.round(cost) })).sort((x, y) => y.cost - x.cost).slice(0, 6),
      mileageByMonth: [...km].map(([month, distance]) => ({ month, km: Math.round(distance) })),
    })
  }),
)

export default router
