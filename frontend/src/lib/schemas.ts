import type { Field, Values } from '../components/FormDrawer'
import { CATEGORY_LABEL, COMPONENT_LABEL, DOC_TYPES, FAULT_STATUS_LABEL, SEVERITY_LABEL, toDateInput, toDateTimeInput } from './format'
import type { FaultReport, MaintenanceRecord, Vehicle, VehicleDocument } from './types'

type VehicleOpt = Pick<Vehicle, 'id' | 'fleetId' | 'registration'>

export const vehicleOptions = (vs: VehicleOpt[]) => vs.map((v) => ({ value: v.id, label: `${v.fleetId} · ${v.registration}` }))
const componentOptions = [{ value: '', label: 'Unknown' }, ...Object.entries(COMPONENT_LABEL).map(([value, label]) => ({ value, label }))]
const s = (n: number | null | undefined) => (n == null ? '' : String(n))

export const maintenanceFields = (vs: VehicleOpt[]): Field[] => [
  { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, options: vehicleOptions(vs), span: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'category', label: 'Category', type: 'select', required: true, options: [{ value: '', label: 'Choose…' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))] },
  { name: 'km', label: 'Odometer at service (km)', type: 'number', required: true },
  { name: 'engineHours', label: 'Engine hours at service', type: 'number', required: true },
  { name: 'component', label: 'Component', type: 'select', options: componentOptions },
  { name: 'provider', label: 'Workshop or mechanic', type: 'text', required: true },
  { name: 'description', label: 'Work performed', type: 'textarea', required: true },
  { name: 'parts', label: 'Parts replaced', type: 'text', span: true },
  { name: 'laborCost', label: 'Labour (€)', type: 'number', required: true },
  { name: 'partsCost', label: 'Parts (€)', type: 'number', required: true },
  { name: 'routine', label: 'Scheduled work (not a repair)', type: 'checkbox', span: true },
  { name: 'notes', label: 'Notes', type: 'textarea' },
]
export function maintenanceValues(m?: MaintenanceRecord, v?: Pick<Vehicle, 'id' | 'km' | 'engineHours'>): Values {
  if (m) return { vehicleId: m.vehicleId, date: m.date, category: m.category, km: s(m.km), engineHours: s(m.engineHours), component: m.component ?? '', provider: m.provider, description: m.description, parts: m.parts, laborCost: s(m.laborCost), partsCost: s(m.partsCost), routine: m.routine, notes: m.notes }
  return { vehicleId: v?.id ?? '', date: toDateInput(), category: '', km: s(v?.km), engineHours: s(v?.engineHours), component: '', provider: '', description: '', parts: '', laborCost: '', partsCost: '', routine: false, notes: '' }
}

export const faultFields = (vs: VehicleOpt[]): Field[] => [
  { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, options: vehicleOptions(vs), span: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'severity', label: 'Severity', type: 'select', required: true, options: Object.entries(SEVERITY_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'km', label: 'Odometer (km)', type: 'number', required: true },
  { name: 'engineHours', label: 'Engine hours', type: 'number', required: true },
  { name: 'component', label: 'Affected component', type: 'select', options: componentOptions },
  { name: 'status', label: 'Status', type: 'select', required: true, options: Object.entries(FAULT_STATUS_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'symptoms', label: 'Symptoms', type: 'textarea', required: true, hint: 'What was noticed, when, and under what load.' },
  { name: 'reportedBy', label: 'Reported by', type: 'text', required: true },
  { name: 'notes', label: 'Notes', type: 'text' },
]
export function faultValues(f?: FaultReport, v?: Pick<Vehicle, 'id' | 'km' | 'engineHours'>, reporter = ''): Values {
  if (f) return { vehicleId: f.vehicleId, date: f.date, severity: f.severity, km: s(f.km), engineHours: s(f.engineHours), component: f.component ?? '', status: f.status, symptoms: f.symptoms, reportedBy: f.reportedBy, notes: f.notes }
  return { vehicleId: v?.id ?? '', date: toDateInput(), severity: 'MEDIUM', km: s(v?.km), engineHours: s(v?.engineHours), component: '', status: 'OPEN', symptoms: '', reportedBy: reporter, notes: '' }
}

export const documentFields = (vs: VehicleOpt[]): Field[] => [
  { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, options: vehicleOptions(vs), span: true },
  { name: 'type', label: 'Document type', type: 'select', required: true, options: [{ value: '', label: 'Choose…' }, ...DOC_TYPES.map((x) => ({ value: x, label: x }))] },
  { name: 'number', label: 'Document number', type: 'text', required: true },
  { name: 'issueDate', label: 'Issue date', type: 'date', required: true },
  { name: 'expiryDate', label: 'Expiry date', type: 'date', required: true },
  { name: 'fileName', label: 'Attached file name', type: 'text', span: true, hint: 'File upload is not part of this version. Only the name is kept for reference.' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
]
export function documentValues(d?: VehicleDocument, vehicleId = ''): Values {
  if (d) return { vehicleId: d.vehicleId, type: d.type, number: d.number, issueDate: d.issueDate, expiryDate: d.expiryDate, fileName: d.fileName ?? '', notes: d.notes }
  return { vehicleId, type: '', number: '', issueDate: toDateInput(), expiryDate: '', fileName: '', notes: '' }
}

export const tripFields = (vs: VehicleOpt[]): Field[] => [
  { name: 'vehicleId', label: 'Vehicle', type: 'select', required: true, options: vehicleOptions(vs), span: true },
  { name: 'origin', label: 'From', type: 'text', required: true },
  { name: 'destination', label: 'To', type: 'text', required: true },
  { name: 'departure', label: 'Departure', type: 'datetime', required: true },
  { name: 'arrival', label: 'Arrival', type: 'datetime', required: true },
  { name: 'distanceKm', label: 'Distance (km)', type: 'number', required: true },
  { name: 'hours', label: 'Engine hours', type: 'number', required: true },
  { name: 'driverName', label: 'Driver', type: 'text', required: true },
  { name: 'loadKg', label: 'Load (kg)', type: 'number' },
  { name: 'notes', label: 'Route notes', type: 'textarea' },
]
export function tripValues(v?: Pick<Vehicle, 'id'> & { driverName?: string; driverLabel?: string | null }): Values {
  return { vehicleId: v?.id ?? '', origin: '', destination: '', departure: toDateTimeInput(new Date(Date.now() - 9 * 3_600_000)), arrival: toDateTimeInput(new Date(Date.now() - 60_000)), distanceKm: '', hours: '', driverName: v?.driverLabel ?? v?.driverName ?? '', loadKg: '', notes: '' }
}
