export type VehicleStatus = 'OPERATIONAL' | 'IN_SERVICE' | 'OUT_OF_SERVICE' | 'HIGH_RISK'
export type RiskCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

export interface Vehicle {
  id: string
  fleetId: string
  registration: string
  vin: string
  manufacturer: string
  model: string
  variant: string
  year: number
  category: string
  engineType: string
  powerKw: number
  fuelType: string
  displacementL: number
  payloadKg: number
  bodyType: string
  imageUrl: string | null
  km: number
  engineHours: number
  avgDailyKm: number
  avgDailyHours: number
  status: VehicleStatus
  location: string
  purchaseDate: string | null
  purchasePrice: number | null
  driverId: string | null
  driverName: string
  notes: string
  heavyLoads: boolean
  demandingTerrain: boolean
  longHaul: boolean
  urbanStopGo: boolean
  archived: boolean
}

export interface VehicleListItem extends Vehicle {
  driverLabel: string | null
  topRisk: { score: number; category: RiskCategory; component: string } | null
}

export interface VehicleDetail extends Vehicle {
  driver: { id: string; name: string } | null
}

export interface Reading {
  id: string
  recordedAt: string
  km: number
  engineHours: number
  source: 'MANUAL' | 'TRIP' | 'SERVICE'
}

export interface ReadingsResponse {
  readings: Reading[]
  summary: { distanceKm: number; hours: number; days: number; avgDailyKm: number | null; avgDailyHours: number | null } | null
}

export const vehicleTitle = (v: Pick<Vehicle, 'manufacturer' | 'model' | 'variant'>) => [v.manufacturer, v.model, v.variant].filter(Boolean).join(' ')

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type FaultStatus = 'OPEN' | 'UNDER_INSPECTION' | 'RESOLVED'
export type DocStatus = 'GREEN' | 'YELLOW' | 'RED' | 'EXPIRED'

export interface VehicleRef {
  fleetId: string
  registration: string
  manufacturer: string
  model: string
}

export interface MaintenanceRecord {
  id: string
  vehicleId: string
  vehicle: VehicleRef
  date: string
  km: number
  engineHours: number
  category: string
  component: string | null
  routine: boolean
  description: string
  parts: string
  laborCost: number
  partsCost: number
  totalCost: number
  provider: string
  notes: string
}

export interface FaultReport {
  id: string
  vehicleId: string
  vehicle: VehicleRef
  date: string
  km: number
  engineHours: number
  component: string | null
  symptoms: string
  severity: Severity
  status: FaultStatus
  reportedBy: string
  notes: string
}

export interface VehicleDocument {
  id: string
  vehicleId: string
  vehicle: VehicleRef
  type: string
  number: string
  issueDate: string
  expiryDate: string
  fileName: string | null
  notes: string
  status: DocStatus
  daysLeft: number
}

export interface Trip {
  id: string
  vehicleId: string
  vehicle: VehicleRef
  origin: string
  destination: string
  departure: string
  arrival: string
  distanceKm: number
  hours: number
  driverName: string
  loadKg: number | null
  notes: string
}

export interface MaintenanceSummary {
  count: number
  total: number
  routine: number
  repairs: number
  byCategory: { category: string; cost: number }[]
  byMonth: { month: string; cost: number }[]
}

export interface Factor {
  code: string
  label: string
  detail: string
  points: number
  sourceType: string | null
  sourceId: string | null
}

export interface Estimate {
  available: boolean
  reason?: string
  repairCost: number | null
  preventiveCost: number | null
  riskFactor: number
  avoidedRepair: number | null
  savings: number | null
}

export type PredictionStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'SCHEDULED' | 'RESOLVED'

export interface Prediction {
  id: string
  vehicleId: string
  vehicle: { fleetId: string; registration: string; manufacturer: string; model: string; variant: string; km: number }
  component: string
  label: string
  score: number
  category: RiskCategory
  timeframe: string
  action: string
  missing: string[]
  status: PredictionStatus
  factors: Factor[]
  explanation: { summary: string; inspect: string[]; urgency: string; ifIgnored: string; source: 'RULES' | 'LLM' } | null
  explanationSource: 'RULES' | 'LLM' | null
  calculatedAt: string
  estimate: Estimate
}

export interface VehicleReport {
  predictions: Prediction[]
  overall: { category: RiskCategory; critical: number; high: number; moderate: number; potentialSavings: number; actionableWithoutCosts: number }
  vehicleMissing: string[]
  calculatedAt: string | null
}

export interface CostRow {
  component: string
  label: string
  repairCost: number | null
  preventiveCost: number | null
  intervalKm: number | null
  intervalMonths: number | null
  defaultIntervalKm: number | null
  defaultIntervalMonths: number | null
}

export interface AppNotification {
  id: string
  kind: 'DOCUMENT' | 'PREDICTION' | 'SYSTEM'
  title: string
  body: string
  vehicleId: string | null
  channel: string
  read: boolean
  createdAt: string
}

export interface NotificationsResponse {
  items: AppNotification[]
  unread: number
  inAppEnabled: boolean
  emailConfigured?: boolean
}

export interface CompanyInfo {
  id: string
  name: string
  country: string
  vatId: string
  isDemo: boolean
  notifyEmail: boolean
  notifyInApp: boolean
  notifyThresholds: number[]
}

export interface UserRow {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'MANAGER' | 'MECHANIC' | 'DRIVER'
  active: boolean
  createdAt: string
}
