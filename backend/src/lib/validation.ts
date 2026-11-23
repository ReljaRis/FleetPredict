import { z } from 'zod'

export const text = (max = 120) => z.string().trim().max(max)

export const int = (label: string, min = 0, max = 99_999_999) =>
  z.coerce.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} cannot be below ${min}.`).max(max, `${label} is too large.`)

export const money = (label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`).max(10_000_000, `${label} is too large.`)

/** Calendar date as yyyy-mm-dd. Parsed to a UTC midnight Date so it round-trips into Postgres DATE without a time zone shift. */
export const dateOnly = (label = 'Date') =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `Enter a valid ${label.toLowerCase()}.`)
    .refine((s) => !Number.isNaN(Date.parse(s)), `Enter a valid ${label.toLowerCase()}.`)
    .transform((s) => new Date(`${s}T00:00:00.000Z`))

export const COMPONENTS = ['ENGINE', 'COOLING', 'BRAKES', 'TRANSMISSION', 'CLUTCH', 'TURBO', 'SUSPENSION', 'ELECTRICAL', 'FUEL', 'TIRES'] as const
export const CATEGORIES = ['REGULAR_SERVICE', 'OIL_FILTER', 'ENGINE_REPAIR', 'COOLING', 'BRAKES', 'TRANSMISSION', 'CLUTCH', 'TURBO', 'SUSPENSION', 'ELECTRICAL', 'FUEL', 'TIRES', 'OTHER'] as const

/** A component, or empty / null for "unknown". */
export const optionalComponent = z
  .union([z.enum(COMPONENTS), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null))

export const isoDay = (d: Date) => d.toISOString().slice(0, 10)
