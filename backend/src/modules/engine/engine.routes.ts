import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { notFound } from '../../lib/errors.js'
import { COMPONENTS } from './config.js'
import { estimate } from './finance.js'
import { computeVehicle, refreshPredictions } from './engine.service.js'
import { COMPONENT_KEYS, type RiskCategory } from './types.js'
import { findOwned, scope } from '../vehicles/vehicle.service.js'
import { int } from '../../lib/validation.js'
import { explainWithLlm, llmConfigured, llmModel } from './llm.provider.js'
import { HttpError } from '../../lib/errors.js'
import type { PredictionFacts } from './llm.js'

const include = { factors: { orderBy: { points: 'desc' as const } }, vehicle: { select: { fleetId: true, registration: true, manufacturer: true, model: true, variant: true, km: true, year: true, engineHours: true } } }
type Row = Prisma.PredictionGetPayload<{ include: typeof include }>

const present = (p: Row) => ({
  id: p.id,
  vehicleId: p.vehicleId,
  vehicle: p.vehicle,
  component: p.component,
  label: COMPONENTS[p.component].label,
  score: p.score,
  category: p.category,
  timeframe: p.timeframe,
  action: p.action,
  missing: p.missing,
  status: p.status,
  factors: p.factors.map((f) => ({ code: f.code, label: f.label, detail: f.detail, points: f.points, sourceType: f.sourceType, sourceId: f.sourceId })),
  explanation: p.explanation,
  explanationSource: p.explanationSource,
  calculatedAt: p.calculatedAt,
  estimate: estimate(p.score, p.repairCost === null ? null : Number(p.repairCost), p.preventiveCost === null ? null : Number(p.preventiveCost)),
})

const ORDER: Record<RiskCategory, number> = { CRITICAL: 3, HIGH: 2, MODERATE: 1, LOW: 0 }

const listQuery = z.object({
  vehicleId: z.string().optional(),
  category: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).optional(),
  component: z.enum(COMPONENT_KEYS).optional(),
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'SCHEDULED', 'RESOLVED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Hide low-risk rows by default: the page is a to-do list. */
  includeLow: z.enum(['true', 'false']).default('false'),
})

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const q = parse(listQuery, req.query)
    const w: Prisma.PredictionWhereInput = { companyId: a.companyId, vehicle: { is: { ...scope(a), archived: false } } }
    if (q.vehicleId) w.vehicleId = q.vehicleId
    if (q.category) w.category = q.category
    else if (q.includeLow === 'false') w.category = { not: 'LOW' }
    if (q.component) w.component = q.component
    if (q.status) w.status = q.status
    if (q.from || q.to) w.calculatedAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) }
    const rows = (await prisma.prediction.findMany({ where: w, include })).map(present)
    rows.sort((x, y) => y.score - x.score || ORDER[y.category] - ORDER[x.category])
    const totals = rows.filter((r) => (r.category === 'HIGH' || r.category === 'CRITICAL') && r.estimate.available && (r.estimate.savings ?? 0) > 0).reduce((s, r) => s + (r.estimate.savings ?? 0), 0)
    res.json({ predictions: rows, potentialSavings: Math.round(totals) })
  }),
)

/** Everything the AI report page needs for one vehicle. */
router.get(
  '/vehicle/:vehicleId',
  handler(async (req, res) => {
    const a = ctx(req)
    const vehicleId = String(req.params.vehicleId)
    await findOwned(a, vehicleId)
    let rows = await prisma.prediction.findMany({ where: { companyId: a.companyId, vehicleId }, include })
    if (!rows.length) {
      await refreshPredictions(a.companyId, vehicleId)
      rows = await prisma.prediction.findMany({ where: { companyId: a.companyId, vehicleId }, include })
    }
    const live = await computeVehicle(a.companyId, vehicleId)
    const preds = rows.map(present).sort((x, y) => y.score - x.score)
    const worst = preds[0]?.category ?? 'LOW'
    const actionable = preds.filter((p) => p.category === 'HIGH' || p.category === 'CRITICAL')
    const savings = actionable.filter((p) => p.estimate.available && (p.estimate.savings ?? 0) > 0).reduce((s, p) => s + (p.estimate.savings ?? 0), 0)
    res.json({
      predictions: preds,
      overall: { category: worst, critical: preds.filter((p) => p.category === 'CRITICAL').length, high: preds.filter((p) => p.category === 'HIGH').length, moderate: preds.filter((p) => p.category === 'MODERATE').length, potentialSavings: Math.round(savings), actionableWithoutCosts: actionable.filter((p) => !p.estimate.available).length },
      vehicleMissing: live?.vehicleMissing ?? [],
      calculatedAt: preds[0] ? preds[0].calculatedAt : null,
    })
  }),
)

/* ---------- LLM explanation layer ---------- */
// The free tier of most providers is small, so each company gets a modest hourly allowance.
const EXPLAIN_LIMIT = 30
const used = new Map<string, number[]>()
function takeAllowance(companyId: string) {
  const now = Date.now()
  const recent = (used.get(companyId) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= EXPLAIN_LIMIT) throw new HttpError(429, `You have used ${EXPLAIN_LIMIT} AI explanations this hour. Try again later.`)
  recent.push(now)
  used.set(companyId, recent)
}

router.get('/llm/status', (_req, res) => {
  res.json({ configured: llmConfigured(), model: llmConfigured() ? llmModel() : null })
})

router.post(
  '/:id/explain',
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    const p = await prisma.prediction.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } }, include })
    if (!p) throw notFound()
    if (!llmConfigured()) throw new HttpError(503, 'The AI explanation layer is not configured on this server.')
    takeAllowance(a.companyId)
    // Only the calculated facts leave the server: no company, user or contact details.
    const facts: PredictionFacts = {
      vehicle: { fleetId: p.vehicle.fleetId, make: p.vehicle.manufacturer, model: p.vehicle.model, variant: p.vehicle.variant, year: p.vehicle.year, km: p.vehicle.km, engineHours: p.vehicle.engineHours },
      component: p.component, componentLabel: COMPONENTS[p.component].label, score: p.score, category: p.category, timeframe: p.timeframe,
      factors: p.factors.map((f) => ({ label: f.label, detail: f.detail, points: f.points })), missing: p.missing,
    }
    const out = await explainWithLlm(facts)
    // A failed attempt must never replace an AI explanation that is already stored.
    if (out.explanation.source !== 'LLM' && p.explanationSource === 'LLM') return res.json({ prediction: present(p), note: out.note ?? null })
    const saved = await prisma.prediction.update({ where: { id }, data: { explanation: out.explanation as unknown as Prisma.InputJsonValue, explanationSource: out.explanation.source }, include })
    res.json({ prediction: present(saved), note: out.note ?? null })
  }),
)

router.patch(
  '/:id/status',
  requirePermission('prediction:act'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    const { status } = parse(z.object({ status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'SCHEDULED', 'RESOLVED']) }), req.body)
    const p = await prisma.prediction.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } })
    if (!p) throw notFound()
    res.json(present(await prisma.prediction.update({ where: { id }, data: { status }, include })))
  }),
)

router.post(
  '/recalculate',
  requirePermission('prediction:act'),
  handler(async (req, res) => {
    await refreshPredictions(ctx(req).companyId)
    res.json({ ok: true })
  }),
)

export default router

/* ---------- Cost assumptions ---------- */
export const costsRouter = Router()
costsRouter.use(requireAuth)

const costRow = z.object({
  component: z.enum(COMPONENT_KEYS),
  repairCost: z.union([z.literal('').transform(() => null), z.null(), z.coerce.number().min(0, 'Cannot be negative.').max(1_000_000, 'Too large.')]).transform((v) => v ?? null),
  preventiveCost: z.union([z.literal('').transform(() => null), z.null(), z.coerce.number().min(0, 'Cannot be negative.').max(1_000_000, 'Too large.')]).transform((v) => v ?? null),
  intervalKm: z.union([z.literal('').transform(() => null), z.null(), int('Interval km', 1000, 2_000_000)]).transform((v) => v ?? null),
  intervalMonths: z.union([z.literal('').transform(() => null), z.null(), int('Interval months', 1, 240)]).transform((v) => v ?? null),
})

costsRouter.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const rows = await prisma.componentCost.findMany({ where: { companyId: a.companyId } })
    const by = new Map(rows.map((r) => [r.component, r]))
    res.json(
      COMPONENT_KEYS.map((k) => {
        const r = by.get(k)
        return {
          component: k,
          label: COMPONENTS[k].label,
          repairCost: r?.repairCost == null ? null : Number(r.repairCost),
          preventiveCost: r?.preventiveCost == null ? null : Number(r.preventiveCost),
          intervalKm: r?.intervalKm ?? null,
          intervalMonths: r?.intervalMonths ?? null,
          defaultIntervalKm: COMPONENTS[k].intervalKm,
          defaultIntervalMonths: COMPONENTS[k].intervalMonths,
        }
      }),
    )
  }),
)

costsRouter.put(
  '/',
  requirePermission('costs:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const { rows } = parse(z.object({ rows: z.array(costRow).min(1).max(COMPONENT_KEYS.length) }), req.body)
    await prisma.$transaction(
      rows.map((r) =>
        prisma.componentCost.upsert({
          where: { companyId_component: { companyId: a.companyId, component: r.component } },
          create: { companyId: a.companyId, ...r },
          update: { repairCost: r.repairCost, preventiveCost: r.preventiveCost, intervalKm: r.intervalKm, intervalMonths: r.intervalMonths },
        }),
      ),
    )
    res.json({ ok: true })
  }),
)
