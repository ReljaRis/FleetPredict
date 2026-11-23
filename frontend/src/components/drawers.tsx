import { api } from '../lib/api'
import { FormDrawer } from './FormDrawer'
import { documentFields, documentValues, faultFields, faultValues, maintenanceFields, maintenanceValues, tripFields, tripValues } from '../lib/schemas'
import type { FaultReport, MaintenanceRecord, Trip, Vehicle, VehicleDocument } from '../lib/types'

type V = Pick<Vehicle, 'id' | 'fleetId' | 'registration' | 'km' | 'engineHours'> & { driverName?: string; driverLabel?: string | null }

interface Base<T> {
  open: boolean
  onClose: () => void
  vehicles: V[]
  /** Vehicle preselected for a new record. */
  vehicle?: V
  record?: T | null
  onSaved: () => void
}

/** The record's own vehicle must be selectable even if it was archived since. */
function withRecordVehicle(vehicles: V[], r?: { vehicleId: string; vehicle: { fleetId: string; registration: string } } | null): V[] {
  if (!r || vehicles.some((v) => v.id === r.vehicleId)) return vehicles
  return [...vehicles, { id: r.vehicleId, fleetId: r.vehicle.fleetId, registration: r.vehicle.registration, km: 0, engineHours: 0 }]
}

export function ServiceDrawer({ open, onClose, vehicles, vehicle, record, onSaved }: Base<MaintenanceRecord>) {
  const list = withRecordVehicle(vehicles, record)
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={record ? 'Edit maintenance record' : 'Log maintenance'}
      sub={record ? `${record.vehicle.fleetId} · ${record.vehicle.registration}` : vehicle ? `${vehicle.fleetId} · ${vehicle.registration}` : undefined}
      fields={maintenanceFields(list)}
      initial={maintenanceValues(record ?? undefined, vehicle)}
      submitLabel={record ? 'Save changes' : 'Save record'}
      successText={record ? 'Maintenance record updated.' : 'Maintenance record saved.'}
      onSubmit={(v) => api(record ? `/maintenance/${record.id}` : '/maintenance', { method: record ? 'PUT' : 'POST', body: v })}
      onDone={onSaved}
      danger={record ? { label: 'Delete record', run: () => api(`/maintenance/${record.id}`, { method: 'DELETE' }), successText: 'Maintenance record deleted.' } : undefined}
    />
  )
}

export function FaultDrawer({ open, onClose, vehicles, vehicle, record, onSaved, reporter }: Base<FaultReport> & { reporter: string }) {
  const list = withRecordVehicle(vehicles, record)
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={record ? 'Edit fault report' : 'Report a fault'}
      sub={record ? `${record.vehicle.fleetId} · ${record.vehicle.registration}` : vehicle ? `${vehicle.fleetId} · ${vehicle.registration}` : undefined}
      fields={faultFields(list)}
      initial={faultValues(record ?? undefined, vehicle, reporter)}
      submitLabel={record ? 'Save changes' : 'Submit report'}
      successText={record ? 'Fault report updated.' : 'Fault reported.'}
      onSubmit={(v) => api(record ? `/faults/${record.id}` : '/faults', { method: record ? 'PUT' : 'POST', body: v })}
      onDone={onSaved}
    />
  )
}

export function DocumentDrawer({ open, onClose, vehicles, vehicle, record, onSaved }: Base<VehicleDocument>) {
  const list = withRecordVehicle(vehicles, record)
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={record ? 'Edit document' : 'Add document'}
      sub={record ? `${record.vehicle.fleetId} · ${record.vehicle.registration}` : vehicle ? `${vehicle.fleetId} · ${vehicle.registration}` : undefined}
      fields={documentFields(list)}
      initial={documentValues(record ?? undefined, vehicle?.id)}
      submitLabel={record ? 'Save changes' : 'Save document'}
      successText={record ? 'Document updated.' : 'Document added.'}
      onSubmit={(v) => api(record ? `/documents/${record.id}` : '/documents', { method: record ? 'PUT' : 'POST', body: v })}
      onDone={onSaved}
      danger={record ? { label: 'Delete document', run: () => api(`/documents/${record.id}`, { method: 'DELETE' }), successText: 'Document deleted.' } : undefined}
    />
  )
}

export function TripDrawer({ open, onClose, vehicles, vehicle, onSaved }: Omit<Base<Trip>, 'record'>) {
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Add trip"
      sub={vehicle ? `${vehicle.fleetId} · ${vehicle.registration}` : 'A trip that ends after the latest reading also moves the odometer and engine hours.'}
      fields={tripFields(vehicles)}
      initial={tripValues(vehicle)}
      submitLabel="Save trip"
      successText="Trip saved."
      onSubmit={(v) => api('/trips', { body: v })}
      onDone={onSaved}
    />
  )
}
