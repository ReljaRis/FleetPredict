import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { generatePredictionNotifications } from '../notifications/notifications.service.js'
import { WEIGHTS, type Weights } from './config.js'
import { explainDeterministic } from './explain.js'
import { loadKnownIssues, type KnownIssuesByEngine } from './known-issues.js'
import { scoreVehicle } from './score.js'
import { COMPONENT_KEYS, type ComponentAssumption, type ComponentKey, type EngineFault, type EngineMaintenance, type EngineVehicle, type VehicleResult } from './types.js'

const num = (d: unknown) => (d === null || d === undefined ? null : Number(d))

/** Company overrides of engine weights. Unknown keys and non-numeric values are ignored. */
async function loadWeights(companyId: string): Promise<Partial<Weights>> {
  const rows = await prisma.thresholdOverride.findMany({ where: { companyId } })
  const out: Record<string, number> = {}
  for (const r of rows) if (typeof (WEIGHTS as unknown as Record<string, unknown>)[r.key] === 'number') out[r.key] = r.value
  return out as Partial<Weights>
}

async function loadAssumptions(companyId: string): Promise<Partial<Record<ComponentKey, ComponentAssumption>>> {
  const rows = await prisma.componentCost.findMany({ where: { companyId } })
  const out: Partial<Record<ComponentKey, ComponentAssumption>> = {}
  for (const r of rows) out[r.component as ComponentKey] = { repairCost: num(r.repairCost), preventiveCost: num(r.preventiveCost), intervalKm: r.intervalKm, intervalMonths: r.intervalMonths }
  return out
}

interface Loaded {
  vehicles: EngineVehicle[]
  maintenance: Map<string, EngineMaintenance[]>
  faults: Map<string, EngineFault[]>
  known: KnownIssuesByEngine
}

const issuesOf = (l: Loaded, v: EngineVehicle) => (v.engineCode ? Object.fromEntries(l.known.get(v.engineCode) ?? []) : undefined)

async function load(companyId: string, vehicleId?: string): Promise<Loaded> {
  const where = { companyId, ...(vehicleId ? { id: vehicleId } : {}), archived: false }
  const vs = await prisma.vehicle.findMany({ where })
  const ids = vs.map((v) => v.id)
  const [known, ms, fs] = await Promise.all([
    loadKnownIssues(vs.flatMap((v) => (v.engineCode ? [v.engineCode] : []))).catch((err) => {
      console.error('Known issues could not be loaded:', err)
      return new Map() as KnownIssuesByEngine
    }),
    prisma.maintenanceRecord.findMany({ where: { companyId, vehicleId: { in: ids } } }),
    prisma.faultReport.findMany({ where: { companyId, vehicleId: { in: ids } } }),
  ])
  const group = <T extends { vehicleId: string }, U>(rows: T[], map: (r: T) => U) => {
    const m = new Map<string, U[]>()
    for (const r of rows) m.set(r.vehicleId, [...(m.get(r.vehicleId) ?? []), map(r)])
    return m
  }
  return {
    known,
    vehicles: vs.map((v) => ({ id: v.id, year: v.year, km: v.km, engineHours: v.engineHours, avgDailyKm: v.avgDailyKm, avgDailyHours: Number(v.avgDailyHours), heavyLoads: v.heavyLoads, demandingTerrain: v.demandingTerrain, longHaul: v.longHaul, urbanStopGo: v.urbanStopGo, purchaseDate: v.purchaseDate, engineCode: v.engineCode })),
    maintenance: group(ms, (m): EngineMaintenance => ({ id: m.id, date: m.date, km: m.km, engineHours: m.engineHours, category: m.category, component: m.component as ComponentKey | null, routine: m.routine, description: m.description })),
    faults: group(fs, (f): EngineFault => ({ id: f.id, date: f.date, km: f.km, component: f.component as ComponentKey | null, severity: f.severity, status: f.status, symptoms: f.symptoms })),
  }
}

/** Live result for one vehicle, without writing anything. */
export async function computeVehicle(companyId: string, vehicleId: string): Promise<VehicleResult | null> {
  const [data, assumptions, weights] = await Promise.all([load(companyId, vehicleId), loadAssumptions(companyId), loadWeights(companyId)])
  const v = data.vehicles[0]
  if (!v) return null
  return scoreVehicle({ vehicle: v, maintenance: data.maintenance.get(v.id) ?? [], faults: data.faults.get(v.id) ?? [], assumptions, weights, knownIssues: issuesOf(data, v) })
}

// Refreshes for the same company run one after another, so two writes in quick succession cannot collide.
const chains = new Map<string, Promise<unknown>>()

/**
 * Recalculates and stores predictions for the company's active vehicles (or one vehicle).
 * A prediction keeps the status users gave it (acknowledged, scheduled) across recalculations.
 */
export function refreshPredictions(companyId: string, vehicleId?: string): Promise<void> {
  const run = async () => {
    const [data, assumptions, weights] = await Promise.all([load(companyId, vehicleId), loadAssumptions(companyId), loadWeights(companyId)])
    if (!data.vehicles.length) return
    const ids = data.vehicles.map((v) => v.id)
    const now = new Date()

    const preds: Prisma.PredictionCreateManyInput[] = []
    const factors: Prisma.PredictionFactorCreateManyInput[] = []
    const results = new Map<string, VehicleResult>()
    for (const v of data.vehicles) results.set(v.id, scoreVehicle({ vehicle: v, maintenance: data.maintenance.get(v.id) ?? [], faults: data.faults.get(v.id) ?? [], assumptions, weights, knownIssues: issuesOf(data, v), now }))

    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.prediction.findMany({ where: { companyId, vehicleId: { in: ids } }, select: { vehicleId: true, component: true, status: true, inputs: true, explanation: true, explanationSource: true } })
        const prev = new Map(existing.map((e) => [`${e.vehicleId}:${e.component}`, e]))
        for (const [vid, res] of results) {
          for (const c of res.components) {
            const id = randomUUID()
            const hash = createHash('sha256').update(JSON.stringify({ s: c.score, f: c.factors.map((f) => [f.code, f.points, f.detail]), i: c.inputs, m: c.missing })).digest('hex').slice(0, 16)
            // An AI-written explanation is kept while the facts behind it are unchanged; otherwise it is rewritten from the rules.
            const old = prev.get(`${vid}:${c.component}`)
            const keepAi = old?.explanationSource === 'LLM' && (old.inputs as { hash?: string } | null)?.hash === hash && old.explanation
            const ex = keepAi ? (old!.explanation as unknown as ReturnType<typeof explainDeterministic>) : explainDeterministic(c)
            preds.push({
              id, companyId, vehicleId: vid, component: c.component, score: c.score, category: c.category, timeframe: c.timeframe, action: c.action,
              inputs: { ...c.inputs, hash } as Prisma.InputJsonValue, missing: c.missing, repairCost: c.repairCost, preventiveCost: c.preventiveCost,
              status: old?.status ?? 'ACTIVE', explanation: ex as unknown as Prisma.InputJsonValue, explanationSource: keepAi ? 'LLM' : 'RULES', calculatedAt: now,
            })
            for (const f of c.factors) factors.push({ predictionId: id, code: f.code, label: f.label, detail: f.detail, points: f.points, sourceType: f.sourceType ?? null, sourceId: f.sourceId ?? null })
          }
        }
        await tx.prediction.deleteMany({ where: { companyId, vehicleId: { in: ids } } })
        await tx.prediction.createMany({ data: preds })
        if (factors.length) await tx.predictionFactor.createMany({ data: factors })
      },
      { timeout: 60_000, maxWait: 20_000 },
    )
    await generatePredictionNotifications(companyId).catch((err) => console.error('Prediction notifications failed:', err))
  }
  const key = companyId
  const next = (chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(run)
  chains.set(key, next)
  return next
}

export { COMPONENT_KEYS }
