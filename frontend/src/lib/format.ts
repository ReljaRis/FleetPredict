export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('en-GB'))
export const fmtKm = (n: number | null | undefined) => (n == null ? '—' : `${fmtNum(n)} km`)
export const fmtH = (n: number | null | undefined) => (n == null ? '—' : `${fmtNum(n)} h`)
export const fmtEur = (n: number | null | undefined) => (n == null ? '—' : `€${Math.round(n).toLocaleString('en-GB')}`)

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  const x = typeof d === 'string' ? new Date(d) : d
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ago(d: string, now = new Date()) {
  const days = Math.round((now.getTime() - new Date(d).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 45) return `${days} days ago`
  const months = Math.round(days / 30.4)
  if (months < 18) return `${months} months ago`
  return `${Math.round(days / 365)} years ago`
}

/** Value for <input type="datetime-local"> in the user's own time zone. */
/** Rounded up to the next full minute: the field has minute precision, and rounding down could place a new reading before one saved seconds ago. */
export function toDateTimeInput(d: Date = new Date(Math.ceil(Date.now() / 60000) * 60000)) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export const STATUS_LABEL: Record<string, string> = {
  OPERATIONAL: 'Operational',
  IN_SERVICE: 'In service',
  OUT_OF_SERVICE: 'Out of service',
  HIGH_RISK: 'High risk',
}

export const COMPONENT_LABEL: Record<string, string> = {
  ENGINE: 'Engine',
  COOLING: 'Cooling system',
  BRAKES: 'Braking system',
  TRANSMISSION: 'Transmission',
  CLUTCH: 'Clutch',
  TURBO: 'Turbocharger',
  SUSPENSION: 'Suspension',
  ELECTRICAL: 'Electrical system',
  FUEL: 'Fuel system',
  TIRES: 'Tyres',
}

export const CATEGORY_LABEL: Record<string, string> = {
  REGULAR_SERVICE: 'Regular service', OIL_FILTER: 'Oil and filter', ENGINE_REPAIR: 'Engine repair', COOLING: 'Cooling system', BRAKES: 'Brakes',
  TRANSMISSION: 'Transmission', CLUTCH: 'Clutch', TURBO: 'Turbocharger', SUSPENSION: 'Suspension', ELECTRICAL: 'Electrical system', FUEL: 'Fuel system', TIRES: 'Tyres', OTHER: 'Other',
}
export const SEVERITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' }
export const FAULT_STATUS_LABEL: Record<string, string> = { OPEN: 'Open', UNDER_INSPECTION: 'Under inspection', RESOLVED: 'Resolved' }
export const DOC_TYPES = ['Vehicle registration', 'Insurance', 'ADR certificate', 'CEMT permit', 'Tachograph inspection', 'Technical inspection', 'Other']

export function fmtDateTime(d: string) {
  const x = new Date(d)
  return `${fmtDate(x)}, ${x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}
export const toDateInput = (d: string | Date = new Date()) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10))

export const PRED_STATUS_LABEL: Record<string, string> = { ACTIVE: 'Active', ACKNOWLEDGED: 'Acknowledged', SCHEDULED: 'Inspection scheduled', RESOLVED: 'Resolved' }
export const SCORE_NOTE = 'Scores rank maintenance priority from this truck’s records. They are not failure probabilities.'
