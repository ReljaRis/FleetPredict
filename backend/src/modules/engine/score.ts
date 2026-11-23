import { CATEGORY_TO_COMPONENT, COMPONENTS, TIMEFRAME, WEIGHTS, categoryOf, faultPoints, type Weights } from './config.js'
import { COMPONENT_KEYS, type ComponentAssumption, type ComponentKey, type ComponentResult, type EngineFault, type EngineMaintenance, type EngineVehicle, type Factor, type VehicleResult } from './types.js'

const MONTH = 30.4375 * 86_400_000
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB')
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export interface ScoreInput {
  vehicle: EngineVehicle
  maintenance: EngineMaintenance[]
  faults: EngineFault[]
  /** Company assumptions by component. Missing entries are treated as "not provided". */
  assumptions?: Partial<Record<ComponentKey, ComponentAssumption>>
  weights?: Partial<Weights>
  now?: Date
}

/** The component a record is about: its explicit component, otherwise the one its category implies. */
const componentOf = (m: EngineMaintenance): ComponentKey | null => m.component ?? CATEGORY_TO_COMPONENT[m.category] ?? null

/**
 * Deterministic, explainable scoring. Every point of the result comes from a named factor that points
 * at a record or at a rule, and the factors always sum to the score (before the 0 to 100 clamp).
 * The result is a maintenance priority, not a probability that the component will fail.
 */
export function scoreVehicle(input: ScoreInput): VehicleResult {
  const w: Weights = { ...WEIGHTS, ...input.weights }
  const now = input.now ?? new Date()
  const v = input.vehicle

  const vehicleMissing: string[] = []
  const unassigned = input.faults.filter((f) => f.status !== 'RESOLVED' && !f.component).length
  if (unassigned > 0) vehicleMissing.push(`${unassigned} open fault report${unassigned > 1 ? 's have' : ' has'} no affected component, so ${unassigned > 1 ? 'they do' : 'it does'} not influence any component score.`)
  if (v.avgDailyKm === 0) vehicleMissing.push('Average daily mileage is not set, so usage-based reasoning is limited.')

  const components = COMPONENT_KEYS.map((key) => scoreComponent(key, input, w, now, v))
  return { components, vehicleMissing }
}

function scoreComponent(key: ComponentKey, input: ScoreInput, w: Weights, now: Date, v: EngineVehicle): ComponentResult {
  const cfg = COMPONENTS[key]
  const a = input.assumptions?.[key]
  const intervalKm = a?.intervalKm ?? cfg.intervalKm
  const intervalMonths = a?.intervalMonths ?? cfg.intervalMonths
  const factors: Factor[] = []
  const missing: string[] = []
  const add = (f: Factor) => f.points > 0 && factors.push({ ...f, points: Math.round(f.points) })

  // 1. Service interval ------------------------------------------------------------------------
  const records = input.maintenance.filter((m) => componentOf(m) === key).sort((x, y) => y.date.getTime() - x.date.getTime() || y.km - x.km)
  const last = records[0]
  const ramp = (ratio: number) => clamp((ratio - w.intervalStart) / (w.intervalFull - w.intervalStart), 0, 1)
  let kmSince: number | null = null
  let monthsSince: number | null = null
  if (last) {
    kmSince = Math.max(0, v.km - last.km)
    monthsSince = Math.max(0, (now.getTime() - last.date.getTime()) / MONTH)
    const kmRatio = intervalKm ? kmSince / intervalKm : 0
    const monthRatio = intervalMonths ? monthsSince / intervalMonths : 0
    const ratio = Math.max(kmRatio, monthRatio)
    const byKm = kmRatio >= monthRatio
    const detail = byKm
      ? `Last ${cfg.label.toLowerCase()} work was ${fmt(kmSince)} km ago, against a ${fmt(intervalKm!)} km interval (${Math.round(kmRatio * 100)}% used).`
      : `Last ${cfg.label.toLowerCase()} work was ${Math.round(monthsSince)} months ago, against a ${intervalMonths}-month interval (${Math.round(monthRatio * 100)}% used).`
    if (intervalKm || intervalMonths) add({ code: 'INTERVAL', label: ratio >= 1 ? 'Service interval exceeded' : 'Service interval mostly used', detail, points: ramp(ratio) * w.intervalMax, sourceType: 'maintenance', sourceId: last.id })
  } else {
    missing.push(`No service record exists for the ${cfg.label.toLowerCase()}, so the time since its last service is unknown.`)
    const ageMonths = v.purchaseDate ? (now.getTime() - v.purchaseDate.getTime()) / MONTH : Math.max(0, now.getFullYear() - v.year) * 12
    const ratio = Math.max(intervalKm ? v.km / intervalKm : 0, intervalMonths ? ageMonths / intervalMonths : 0)
    add({ code: 'NO_HISTORY', label: 'No service record on file', detail: `Nothing is recorded for the ${cfg.label.toLowerCase()}, and the vehicle has covered ${fmt(v.km)} km.`, points: ramp(ratio) * w.noHistoryMax })
  }
  if (!intervalKm && !intervalMonths) missing.push(`No service interval is configured for the ${cfg.label.toLowerCase()}.`)

  // 2. Open and recently resolved faults ------------------------------------------------------------------
  const faults = input.faults.filter((f) => f.component === key)
  const open = faults.filter((f) => f.status !== 'RESOLVED').map((f) => ({ f, p: faultPoints(f.severity, w) * (f.status === 'UNDER_INSPECTION' ? w.faultUnderInspection : 1) })).sort((x, y) => y.p - x.p)
  if (open.length) {
    const top = open[0]
    const extra = Math.min(w.faultExtraCap, (open.length - 1) * w.faultExtra)
    add({
      code: 'OPEN_FAULT',
      label: `Open fault report (${top.f.severity.toLowerCase()})`,
      detail: `${top.f.status === 'UNDER_INSPECTION' ? 'Under inspection' : 'Open'} since ${top.f.date.toISOString().slice(0, 10)} at ${fmt(top.f.km)} km: ${top.f.symptoms.length > 140 ? top.f.symptoms.slice(0, 137) + '...' : top.f.symptoms}`,
      points: top.p + extra,
      sourceType: 'fault',
      sourceId: top.f.id,
    })
  }
  const inWindow = faults.filter((f) => now.getTime() - f.date.getTime() <= w.repeatSymptomDays * 86_400_000)
  const repeated = inWindow.length >= 2
  if (repeated) {
    add({ code: 'REPEAT_SYMPTOM', label: 'Symptom reported repeatedly', detail: `${inWindow.length} fault reports on the ${cfg.label.toLowerCase()} in the last ${w.repeatSymptomDays} days, so the problem is coming back.`, points: Math.min(w.repeatSymptomCap, w.repeatSymptomPoints + (inWindow.length - 2) * w.repeatSymptomExtra), sourceType: 'fault', sourceId: inWindow[0].id })
  }
  const recent = repeated ? [] : faults.filter((f) => f.status === 'RESOLVED' && now.getTime() - f.date.getTime() <= w.resolvedFaultDays * 86_400_000)
  if (recent.length) add({ code: 'RECENT_FAULT', label: 'Recently resolved fault', detail: `${recent.length} fault report${recent.length > 1 ? 's were' : ' was'} resolved in the last ${w.resolvedFaultDays} days, so the cause may still be developing.`, points: Math.min(w.resolvedFaultCap, recent.length * w.resolvedFaultPoints), sourceType: 'fault', sourceId: recent[0].id })

  // 3. Repeated repairs ---------------------------------------------------------------------------------
  const repairs = records.filter((m) => !m.routine && v.km - m.km <= w.repeatWindowKm)
  if (repairs.length >= 2) {
    add({
      code: 'REPEAT_REPAIR',
      label: 'Repeated repairs',
      detail: `${repairs.length} repairs on the ${cfg.label.toLowerCase()} within the last ${fmt(w.repeatWindowKm)} km.`,
      points: repairs.length >= 3 ? w.repeatThreeOrMore : w.repeatTwo,
      sourceType: 'maintenance',
      sourceId: repairs[0].id,
    })
  }

  // 4. Age and mileage ----------------------------------------------------------------------------------
  const ageYears = Math.max(0, now.getFullYear() - v.year)
  const ageStep = w.ageSteps.find(([y]) => ageYears >= y)
  if (ageStep) add({ code: 'AGE', label: 'Vehicle age', detail: `The vehicle is ${ageYears} years old (${v.year}).`, points: ageStep[1] * cfg.wear.age })
  const kmStep = w.mileageSteps.find(([k]) => v.km >= k)
  if (kmStep) add({ code: 'MILEAGE', label: 'High total mileage', detail: `The vehicle has covered ${fmt(v.km)} km in total.`, points: kmStep[1] * cfg.wear.mileage })

  // 5. Operating conditions -----------------------------------------------------------------------------
  const cond: [boolean, keyof typeof cfg.conditions, string][] = [
    [v.heavyLoads, 'heavyLoads', 'Frequent heavy loads'],
    [v.demandingTerrain, 'demandingTerrain', 'Demanding terrain'],
    [v.longHaul, 'longHaul', 'Long-haul duty'],
    [v.urbanStopGo, 'urbanStopGo', 'Urban stop-and-go duty'],
  ]
  for (const [on, k, label] of cond) if (on) add({ code: `COND_${k.toUpperCase()}`, label, detail: `${label} is marked for this vehicle and stresses the ${cfg.label.toLowerCase()}.`, points: cfg.conditions[k] })

  // 6. Usage intensity ----------------------------------------------------------------------------------
  if (cfg.usage === 'km' && v.avgDailyKm >= w.highDailyKm) add({ code: 'USAGE', label: 'High daily mileage', detail: `The vehicle averages ${fmt(v.avgDailyKm)} km per day.`, points: w.usagePoints })
  if (cfg.usage === 'hours' && v.avgDailyHours >= w.highDailyHours) add({ code: 'USAGE', label: 'Long daily operating hours', detail: `The engine averages ${v.avgDailyHours} hours per day.`, points: w.usagePoints })

  factors.sort((x, y) => y.points - x.points)
  const score = clamp(factors.reduce((s, f) => s + f.points, 0), 0, 100)
  const category = categoryOf(score, w)

  return {
    component: key,
    score,
    category,
    timeframe: TIMEFRAME[category],
    action: actionFor(key, category),
    factors,
    missing,
    inputs: {
      vehicle: { year: v.year, km: v.km, engineHours: v.engineHours, avgDailyKm: v.avgDailyKm, avgDailyHours: v.avgDailyHours, conditions: { heavyLoads: v.heavyLoads, demandingTerrain: v.demandingTerrain, longHaul: v.longHaul, urbanStopGo: v.urbanStopGo } },
      interval: { km: intervalKm, months: intervalMonths },
      lastService: last ? { id: last.id, date: last.date.toISOString().slice(0, 10), km: last.km, kmSince, monthsSince: monthsSince === null ? null : Math.round(monthsSince * 10) / 10 } : null,
      openFaults: open.map((o) => o.f.id),
      repairsInWindow: repairs.map((r) => r.id),
    },
    repairCost: a?.repairCost ?? null,
    preventiveCost: a?.preventiveCost ?? null,
  }
}

function actionFor(key: ComponentKey, category: ComponentResult['category']): string {
  const c = COMPONENTS[key]
  switch (category) {
    case 'CRITICAL':
      return `Inspect the ${c.label.toLowerCase()} as soon as possible, before the next trip: ${c.inspect}.`
    case 'HIGH':
      return `Schedule an inspection of the ${c.label.toLowerCase()} within 7 days: ${c.inspect}.`
    case 'MODERATE':
      return `Include the ${c.label.toLowerCase()} in the next scheduled service: ${c.inspect}.`
    default:
      return `No action needed now. Keep following the ${c.label.toLowerCase()} service interval.`
  }
}
