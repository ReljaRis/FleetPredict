import { z } from 'zod'

const text = (max = 120) => z.string().trim().max(max)
const int = (label: string, min = 0, max = 99_999_999) =>
  z.coerce.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} cannot be below ${min}.`).max(max, `${label} is too large.`)

export const VEHICLE_STATUS = ['OPERATIONAL', 'IN_SERVICE', 'OUT_OF_SERVICE', 'HIGH_RISK'] as const
export const CATEGORIES = ['Tractor unit', 'Rigid 4x2', 'Rigid 6x2', 'Rigid 6x4', 'Rigid 8x4', 'Light truck'] as const
export const FUELS = ['Diesel', 'LNG', 'CNG', 'HVO', 'Electric'] as const

export const vehicleInput = z.object({
  fleetId: text(20).min(1, 'Enter the fleet ID.'),
  registration: text(20).min(2, 'Enter the registration number.'),
  vin: text(17).regex(/^[A-Za-z0-9]{11,17}$/, 'A VIN has 11 to 17 letters and digits.'),
  manufacturer: text().min(1, 'Choose or enter a manufacturer.'),
  model: text().min(1, 'Choose or enter a model.'),
  variant: text(40).default(''),
  year: int('Year', 1990, new Date().getFullYear() + 1),
  category: z.enum(CATEGORIES),
  engineType: text(120).default(''),
  powerKw: int('Power', 0, 2000).default(0),
  fuelType: z.enum(FUELS).default('Diesel'),
  displacementL: z.coerce.number().min(0).max(30).default(0),
  payloadKg: int('Payload', 0, 200_000).default(0),
  bodyType: text(120).default(''),
  imageUrl: z.string().trim().url('Enter a full image address starting with https://').max(500).nullable().optional().or(z.literal('').transform(() => null)),
  km: int('Odometer'),
  engineHours: int('Engine hours'),
  avgDailyKm: int('Average daily km', 0, 3000).default(0),
  avgDailyHours: z.coerce.number().min(0, 'Cannot be negative.').max(24, 'A day has 24 hours.').default(0),
  status: z.enum(VEHICLE_STATUS).default('OPERATIONAL'),
  location: text(120).default(''),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.').nullable().optional().or(z.literal('').transform(() => null)),
  purchasePrice: int('Purchase price').nullable().optional().or(z.literal('').transform(() => null)),
  driverId: z.string().nullable().optional().or(z.literal('').transform(() => null)),
  driverName: text(120).default(''),
  notes: text(2000).default(''),
  heavyLoads: z.boolean().default(false),
  demandingTerrain: z.boolean().default(false),
  longHaul: z.boolean().default(false),
  urbanStopGo: z.boolean().default(false),
})
export type VehicleInput = z.infer<typeof vehicleInput>

export const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(VEHICLE_STATUS).optional(),
  risk: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).optional(),
  archived: z.enum(['true', 'false', 'all']).default('false'),
  sort: z.enum(['fleetId', 'km', 'engineHours', 'risk', 'manufacturer', 'year', 'status']).default('fleetId'),
  dir: z.enum(['asc', 'desc']).default('asc'),
})

export const readingInput = z.object({
  recordedAt: z.coerce.date({ error: "Enter a valid date and time." }),
  km: int('Odometer'),
  engineHours: int('Engine hours'),
})

export const readingsQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
