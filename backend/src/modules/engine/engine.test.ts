import { describe, expect, it } from 'vitest'
import { categoryOf, WEIGHTS } from './config.js'
import { estimate } from './finance.js'
import { explainDeterministic } from './explain.js'
import { scoreVehicle } from './score.js'
import type { EngineFault, EngineMaintenance, EngineVehicle } from './types.js'

const now = new Date('2026-11-23T12:00:00Z')
const d = (s: string) => new Date(s + 'T00:00:00Z')

const truck104: EngineVehicle = { id: 'v104', year: 2020, km: 485_200, engineHours: 11_200, avgDailyKm: 210, avgDailyHours: 4.8, heavyLoads: true, demandingTerrain: true, longHaul: false, urbanStopGo: false, purchaseDate: d('2020-05-01') }
const m = (id: string, date: string, kmAgo: number, category: string, component: EngineMaintenance['component'], routine = false): EngineMaintenance => ({ id, date: d(date), km: truck104.km - kmAgo, engineHours: 0, category, component, routine, description: category })
const history104: EngineMaintenance[] = [
  m('oil', '2026-08-29', 18_000, 'OIL_FILTER', 'ENGINE', true),
  m('cool', '2025-03-01', 90_000, 'COOLING', 'COOLING'),
  m('brk', '2025-01-10', 52_000, 'BRAKES', 'BRAKES', true),
  m('tyr', '2024-06-01', 78_000, 'TIRES', 'TIRES', true),
]
const overheating: EngineFault = { id: 'f1', date: d('2026-11-17'), km: 483_800, component: 'COOLING', severity: 'HIGH', status: 'OPEN', symptoms: 'Coolant temperature climbed to 104 C under a heavy load.' }

const get = (r: ReturnType<typeof scoreVehicle>, k: string) => r.components.find((c) => c.component === k)!

describe('scoring ranges and categories', () => {
  it('always returns a score from 0 to 100 and a category that matches the thresholds', () => {
    const res = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now })
    expect(res.components).toHaveLength(10)
    for (const c of res.components) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(100)
      expect(c.category).toBe(categoryOf(c.score))
    }
  })
  it('maps boundary scores to the specified categories', () => {
    expect(categoryOf(0)).toBe('LOW')
    expect(categoryOf(24)).toBe('LOW')
    expect(categoryOf(25)).toBe('MODERATE')
    expect(categoryOf(49)).toBe('MODERATE')
    expect(categoryOf(50)).toBe('HIGH')
    expect(categoryOf(74)).toBe('HIGH')
    expect(categoryOf(75)).toBe('CRITICAL')
    expect(categoryOf(100)).toBe('CRITICAL')
  })
  it('never exceeds 100 even with every factor active', () => {
    const faults: EngineFault[] = Array.from({ length: 5 }, (_, i) => ({ ...overheating, id: 'x' + i, severity: 'CRITICAL' as const }))
    const reps = Array.from({ length: 5 }, (_, i) => m('r' + i, '2026-0' + (i + 1) + '-01', 5_000 * (i + 1), 'COOLING', 'COOLING'))
    const res = scoreVehicle({ vehicle: { ...truck104, longHaul: true, urbanStopGo: true, km: 900_000 }, maintenance: reps, faults, now })
    expect(get(res, 'COOLING').score).toBe(100)
  })
})

describe('explainability', () => {
  it('factor points add up to the score', () => {
    const res = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now })
    for (const c of res.components) expect(c.factors.reduce((s, f) => s + f.points, 0)).toBe(Math.min(100, c.score))
  })
  it('ranks the cooling system first for truck #104 and cites the open fault and the old cooling service', () => {
    const res = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now })
    const top = [...res.components].sort((a, b) => b.score - a.score)[0]
    expect(top.component).toBe('COOLING')
    expect(top.score).toBeGreaterThanOrEqual(WEIGHTS.highFrom)
    const codes = top.factors.map((f) => f.code)
    expect(codes).toContain('OPEN_FAULT')
    expect(codes).toContain('INTERVAL')
    expect(top.factors.find((f) => f.code === 'OPEN_FAULT')!.sourceId).toBe('f1')
    expect(top.factors.find((f) => f.code === 'INTERVAL')!.sourceId).toBe('cool')
  })
  it('is deterministic: the same input gives the same output', () => {
    const a = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now })
    const b = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('produces a readable explanation from the factors alone', () => {
    const res = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now })
    const c = get(res, 'COOLING')
    const e = explainDeterministic(c)
    expect(e.source).toBe('RULES')
    expect(e.summary).toContain(String(c.score))
    expect(e.inspect.length).toBeGreaterThan(2)
    expect(e.ifIgnored.toLowerCase()).not.toMatch(/will fail|certain/)
  })
})

describe('what raises and lowers a score', () => {
  it('a fresh service lowers the interval factor', () => {
    const fresh = [...history104.filter((x) => x.id !== 'cool'), m('cool2', '2026-10-01', 4_000, 'COOLING', 'COOLING')]
    const before = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [], now }), 'COOLING').score
    const after = get(scoreVehicle({ vehicle: truck104, maintenance: fresh, faults: [], now }), 'COOLING').score
    expect(after).toBeLessThan(before)
  })
  it('severity orders open-fault points', () => {
    const at = (s: EngineFault['severity']) => get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [{ ...overheating, severity: s }], now }), 'COOLING').score
    expect(at('LOW')).toBeLessThan(at('MEDIUM'))
    expect(at('MEDIUM')).toBeLessThan(at('HIGH'))
    expect(at('HIGH')).toBeLessThan(at('CRITICAL'))
  })
  it('a resolved fault counts for less than an open one', () => {
    const open = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now }), 'COOLING').score
    const resolved = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [{ ...overheating, status: 'RESOLVED' }], now }), 'COOLING').score
    expect(resolved).toBeLessThan(open)
  })
  it('the same symptom reported again adds a repeated-symptom factor and replaces the recently-resolved one', () => {
    const earlier: EngineFault = { ...overheating, id: 'f0', date: d('2026-10-28'), status: 'RESOLVED', severity: 'MEDIUM' }
    const res = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [earlier, overheating], now }), 'COOLING')
    expect(res.factors.some((f) => f.code === 'REPEAT_SYMPTOM')).toBe(true)
    expect(res.factors.some((f) => f.code === 'RECENT_FAULT')).toBe(false)
    const single = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now }), 'COOLING')
    expect(res.score).toBeGreaterThan(single.score)
  })
  it('a critical open fault lands in the critical band on its own merits', () => {
    const res = get(scoreVehicle({ vehicle: { ...truck104, heavyLoads: false, demandingTerrain: false }, maintenance: history104, faults: [{ ...overheating, severity: 'CRITICAL' }], now }), 'COOLING')
    expect(res.score).toBeGreaterThanOrEqual(75)
  })
  it('repeated repairs on one component add points', () => {
    const twice = [...history104, m('cool-b', '2025-09-01', 40_000, 'COOLING', 'COOLING')]
    const base = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [], now }), 'COOLING')
    const rep = get(scoreVehicle({ vehicle: truck104, maintenance: twice, faults: [], now }), 'COOLING')
    expect(rep.factors.some((f) => f.code === 'REPEAT_REPAIR')).toBe(true)
    expect(base.factors.some((f) => f.code === 'REPEAT_REPAIR')).toBe(false)
  })
  it('operating conditions only affect the components they stress', () => {
    const calm = { ...truck104, heavyLoads: false, demandingTerrain: false }
    const harsh = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [], now })
    const easy = scoreVehicle({ vehicle: calm, maintenance: history104, faults: [], now })
    expect(get(harsh, 'COOLING').score).toBeGreaterThan(get(easy, 'COOLING').score)
    expect(get(harsh, 'ELECTRICAL').score).toBeLessThanOrEqual(get(easy, 'ELECTRICAL').score + 3)
  })
  it('a company weight override changes the result without code changes', () => {
    const base = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now }), 'COOLING').score
    const lighter = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [overheating], now, weights: { faultHigh: 10 } }), 'COOLING').score
    expect(lighter).toBeLessThan(base)
  })
  it('a company interval override changes the interval factor', () => {
    const longer = get(scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [], now, assumptions: { COOLING: { repairCost: null, preventiveCost: null, intervalKm: 200_000, intervalMonths: 120 } } }), 'COOLING')
    expect(longer.factors.find((f) => f.code === 'INTERVAL')).toBeUndefined()
  })
})

describe('missing data is reported, not invented', () => {
  it('flags components with no service record and caps what that can add', () => {
    const res = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [], now })
    const clutch = get(res, 'CLUTCH')
    expect(clutch.missing.join(' ')).toMatch(/No service record/)
    const nh = clutch.factors.find((f) => f.code === 'NO_HISTORY')
    expect(nh?.points ?? 0).toBeLessThanOrEqual(WEIGHTS.noHistoryMax)
  })
  it('reports open faults without a component at vehicle level', () => {
    const res = scoreVehicle({ vehicle: truck104, maintenance: history104, faults: [{ ...overheating, component: null }], now })
    expect(res.vehicleMissing.join(' ')).toMatch(/no affected component/)
    expect(get(res, 'COOLING').factors.some((f) => f.code === 'OPEN_FAULT')).toBe(false)
  })
})

describe('financial estimate', () => {
  it('reproduces the documented example: 4000 x 0.65 - 350 = 2250', () => {
    const e = estimate(65, 4000, 350)
    expect(e.available).toBe(true)
    expect(e.avoidedRepair).toBe(2600)
    expect(e.savings).toBe(2250)
    expect(e.riskFactor).toBe(0.65)
  })
  it('shows no figure when a cost is missing and says which', () => {
    const a = estimate(80, null, 350)
    expect(a.available).toBe(false)
    expect(a.savings).toBeNull()
    expect(a.reason).toContain('repair cost')
    const b = estimate(80, 4000, null)
    expect(b.reason).toContain('preventive')
    const c = estimate(80, null, null)
    expect(c.reason).toContain('and')
  })
  it('can show that acting does not pay off', () => {
    expect(estimate(10, 1000, 600).savings).toBe(-500)
  })
})
