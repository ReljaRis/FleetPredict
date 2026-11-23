export const COMPONENT_KEYS = ['ENGINE', 'COOLING', 'BRAKES', 'TRANSMISSION', 'CLUTCH', 'TURBO', 'SUSPENSION', 'ELECTRICAL', 'FUEL', 'TIRES'] as const
export type ComponentKey = (typeof COMPONENT_KEYS)[number]
export type RiskCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

/** Only plain data goes in. The engine never touches the database, the network or the LLM. */
export interface EngineVehicle {
  id: string
  year: number
  km: number
  engineHours: number
  avgDailyKm: number
  avgDailyHours: number
  heavyLoads: boolean
  demandingTerrain: boolean
  longHaul: boolean
  urbanStopGo: boolean
  purchaseDate: Date | null
}

export interface EngineMaintenance {
  id: string
  date: Date
  km: number
  engineHours: number
  category: string
  component: ComponentKey | null
  routine: boolean
  description: string
}

export interface EngineFault {
  id: string
  date: Date
  km: number
  component: ComponentKey | null
  severity: Severity
  status: 'OPEN' | 'UNDER_INSPECTION' | 'RESOLVED'
  symptoms: string
}

/** Company-entered assumptions for one component. Null means "not provided". */
export interface ComponentAssumption {
  repairCost: number | null
  preventiveCost: number | null
  intervalKm: number | null
  intervalMonths: number | null
}

export interface Factor {
  code: string
  label: string
  detail: string
  points: number
  sourceType?: 'maintenance' | 'fault'
  sourceId?: string
}

export interface ComponentResult {
  component: ComponentKey
  score: number
  category: RiskCategory
  timeframe: string
  action: string
  factors: Factor[]
  /** Data that was not available and limits the result. */
  missing: string[]
  /** Exactly what the engine read, so a result can be reproduced and audited. */
  inputs: Record<string, unknown>
  repairCost: number | null
  preventiveCost: number | null
}

export interface VehicleResult {
  components: ComponentResult[]
  /** Problems with the vehicle data as a whole, for example faults without a component. */
  vehicleMissing: string[]
}
