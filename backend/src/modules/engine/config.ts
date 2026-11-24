import type { ComponentKey, RiskCategory, Severity } from './types.js'

/**
 * Every number the scoring uses lives here. A company can override the weights through the
 * ThresholdOverride table (key = a property name of WEIGHTS) and the intervals through its
 * component cost assumptions. Nothing in this file depends on the database.
 */
export interface Weights {
  intervalStart: number; intervalFull: number; intervalMax: number; noHistoryMax: number
  faultLow: number; faultMedium: number; faultHigh: number; faultCritical: number; faultUnderInspection: number; faultExtra: number; faultExtraCap: number
  resolvedFaultPoints: number; resolvedFaultCap: number; resolvedFaultDays: number
  repeatSymptomDays: number; repeatSymptomPoints: number; repeatSymptomExtra: number; repeatSymptomCap: number
  repeatWindowKm: number; repeatTwo: number; repeatThreeOrMore: number
  ageSteps: [number, number][]; mileageSteps: [number, number][]
  knownIssueBase: number; knownIssueExtra: number; knownIssueCap: number
  highDailyKm: number; highDailyHours: number; usagePoints: number
  moderateFrom: number; highFrom: number; criticalFrom: number
}

export const WEIGHTS: Weights = {
  // Service interval: how much of the interval is used up. Points rise linearly between the two ratios.
  intervalStart: 0.6,
  intervalFull: 1.5,
  intervalMax: 35,
  // A component with no service record at all: capped, because the real state is unknown.
  noHistoryMax: 12,
  // Open fault points by severity. Under inspection counts at 80 percent.
  faultLow: 6,
  faultMedium: 16,
  faultHigh: 32,
  faultCritical: 72,
  faultUnderInspection: 0.8,
  faultExtra: 5,
  faultExtraCap: 10,
  resolvedFaultPoints: 4,
  resolvedFaultCap: 8,
  resolvedFaultDays: 90,
  // The same symptom reported again on the same component (any status) inside this window.
  repeatSymptomDays: 120,
  repeatSymptomPoints: 8,
  repeatSymptomExtra: 4,
  repeatSymptomCap: 12,
  // Repeated non-routine repairs on the same component inside a window of kilometres.
  repeatWindowKm: 150_000,
  repeatTwo: 8,
  repeatThreeOrMore: 15,
  // Vehicle age (years) and total mileage steps, scaled by each component's wear factor.
  ageSteps: [[10, 8], [7, 5], [4, 3]],
  mileageSteps: [[800_000, 7], [500_000, 4], [300_000, 2]],
  // Documented problems of this engine model (reference catalogue). The cap stays below the moderate threshold:
  // it raises priority together with other evidence but never raises an alert alone.
  knownIssueBase: 5,
  knownIssueExtra: 2,
  knownIssueCap: 10,
  highDailyKm: 450,
  highDailyHours: 8,
  usagePoints: 3,
  // Category thresholds (lower bounds).
  moderateFrom: 25,
  highFrom: 50,
  criticalFrom: 75,
}

export interface ComponentConfig {
  label: string
  /** Default service interval. A company can override both values. Null means the interval does not apply. */
  intervalKm: number | null
  intervalMonths: number | null
  wear: { age: number; mileage: number }
  conditions: { heavyLoads: number; demandingTerrain: number; longHaul: number; urbanStopGo: number }
  usage: 'km' | 'hours' | null
  inspect: string
  consequence: string
}

export const COMPONENTS: Record<ComponentKey, ComponentConfig> = {
  ENGINE: { label: 'Engine', intervalKm: 45_000, intervalMonths: 12, wear: { age: 0.8, mileage: 1 }, conditions: { heavyLoads: 6, demandingTerrain: 4, longHaul: 3, urbanStopGo: 2 }, usage: 'hours', inspect: 'oil condition and level, oil pressure, blow-by, injectors and filters', consequence: 'Continued wear can lead to internal engine damage and an unplanned breakdown.' },
  COOLING: { label: 'Cooling system', intervalKm: 80_000, intervalMonths: 36, wear: { age: 0.8, mileage: 0.8 }, conditions: { heavyLoads: 10, demandingTerrain: 8, longHaul: 3, urbanStopGo: 2 }, usage: 'hours', inspect: 'radiator, coolant circulation, thermostat, water pump, hoses and fan clutch', consequence: 'Overheating can damage the cylinder head and gasket, which is one of the most expensive engine repairs.' },
  BRAKES: { label: 'Braking system', intervalKm: 120_000, intervalMonths: 18, wear: { age: 1, mileage: 1 }, conditions: { heavyLoads: 8, demandingTerrain: 8, longHaul: 0, urbanStopGo: 6 }, usage: 'km', inspect: 'pad and disc thickness, calipers, brake lines, air dryer and brake balance', consequence: 'Reduced braking performance is a safety risk and can fail a roadside or technical inspection.' },
  TRANSMISSION: { label: 'Transmission', intervalKm: 150_000, intervalMonths: 48, wear: { age: 0.8, mileage: 1 }, conditions: { heavyLoads: 6, demandingTerrain: 5, longHaul: 0, urbanStopGo: 5 }, usage: null, inspect: 'gearbox oil level and condition, shift actuator, leaks and synchronisers', consequence: 'Gearbox wear tends to progress and can end in a transmission replacement.' },
  CLUTCH: { label: 'Clutch', intervalKm: 300_000, intervalMonths: 60, wear: { age: 0.6, mileage: 1 }, conditions: { heavyLoads: 8, demandingTerrain: 5, longHaul: 0, urbanStopGo: 8 }, usage: null, inspect: 'clutch wear, release bearing, slave cylinder and slip under load', consequence: 'A slipping clutch can leave the truck unable to pull away and may damage the flywheel.' },
  TURBO: { label: 'Turbocharger', intervalKm: 400_000, intervalMonths: 96, wear: { age: 0.6, mileage: 1 }, conditions: { heavyLoads: 5, demandingTerrain: 3, longHaul: 2, urbanStopGo: 0 }, usage: null, inspect: 'boost pressure, shaft play, oil feed and intake hoses', consequence: 'A failing turbocharger can send oil or debris into the engine and cause consequential damage.' },
  SUSPENSION: { label: 'Suspension', intervalKm: 200_000, intervalMonths: 48, wear: { age: 1, mileage: 1 }, conditions: { heavyLoads: 8, demandingTerrain: 8, longHaul: 0, urbanStopGo: 2 }, usage: null, inspect: 'air bellows, leaf springs, bushings, shock absorbers and levelling valves', consequence: 'Worn suspension affects stability and braking and speeds up tyre wear.' },
  ELECTRICAL: { label: 'Electrical system', intervalKm: null, intervalMonths: 36, wear: { age: 0.5, mileage: 0.4 }, conditions: { heavyLoads: 0, demandingTerrain: 3, longHaul: 2, urbanStopGo: 4 }, usage: null, inspect: 'batteries, alternator output, starter, wiring and connectors', consequence: 'Electrical faults often show up as a truck that will not start or loses power on the road.' },
  FUEL: { label: 'Fuel system', intervalKm: 60_000, intervalMonths: 24, wear: { age: 0.6, mileage: 0.8 }, conditions: { heavyLoads: 2, demandingTerrain: 2, longHaul: 3, urbanStopGo: 0 }, usage: null, inspect: 'fuel filters, water separator, injectors and low-pressure circuit', consequence: 'Contaminated or restricted fuel can damage injectors and the high-pressure pump.' },
  TIRES: { label: 'Tyres', intervalKm: 120_000, intervalMonths: 36, wear: { age: 0.5, mileage: 0.8 }, conditions: { heavyLoads: 7, demandingTerrain: 5, longHaul: 4, urbanStopGo: 2 }, usage: 'km', inspect: 'tread depth, uneven wear, pressures, sidewalls and alignment', consequence: 'Worn or damaged tyres risk a blow-out and a roadside stop.' },
}

/** Which component a maintenance category counts toward when the record has no explicit component. */
export const CATEGORY_TO_COMPONENT: Record<string, ComponentKey | null> = {
  REGULAR_SERVICE: null, OIL_FILTER: 'ENGINE', ENGINE_REPAIR: 'ENGINE', COOLING: 'COOLING', BRAKES: 'BRAKES', TRANSMISSION: 'TRANSMISSION', CLUTCH: 'CLUTCH',
  TURBO: 'TURBO', SUSPENSION: 'SUSPENSION', ELECTRICAL: 'ELECTRICAL', FUEL: 'FUEL', TIRES: 'TIRES', OTHER: null,
}

export function categoryOf(score: number, w: Pick<Weights, 'moderateFrom' | 'highFrom' | 'criticalFrom'> = WEIGHTS): RiskCategory {
  if (score >= w.criticalFrom) return 'CRITICAL'
  if (score >= w.highFrom) return 'HIGH'
  if (score >= w.moderateFrom) return 'MODERATE'
  return 'LOW'
}

export const TIMEFRAME: Record<RiskCategory, string> = {
  CRITICAL: 'Before the next trip',
  HIGH: 'Within 7 days',
  MODERATE: 'At the next scheduled service',
  LOW: 'No action needed now',
}

export function faultPoints(s: Severity, w: Weights): number {
  return { LOW: w.faultLow, MEDIUM: w.faultMedium, HIGH: w.faultHigh, CRITICAL: w.faultCritical }[s]
}
