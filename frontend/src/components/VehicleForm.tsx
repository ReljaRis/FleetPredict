import { cloneElement, isValidElement, useEffect, useId, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import { Button, Drawer, useToast } from './ui'
import { STATUS_LABEL } from '../lib/format'
import type { Vehicle } from '../lib/types'

interface Named { id: number; name: string }
interface Generation { id: number; name: string; yearFrom: number | null; yearTo: number | null; emission: string | null }
interface Engine { family: string | null; code: string | null; displacementL: number | null; cylinders: number | null; powerKw: number | null; emission: string | null }
type Values = Record<string, string | boolean>

const OTHER = '__other'
const CATEGORIES = ['Tractor unit', 'Rigid 4x2', 'Rigid 6x2', 'Rigid 6x4', 'Rigid 8x4', 'Light truck']
const FUELS = ['Diesel', 'LNG', 'CNG', 'HVO', 'Electric']
const input = 'mt-1.5 h-10 w-full rounded-md border bg-white px-3 text-[15px] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-amber'

const EMPTY: Values = {
  fleetId: '', registration: '', vin: '', manufacturer: '', model: '', variant: '', year: String(new Date().getFullYear()), category: 'Tractor unit',
  engineType: '', engineCode: '', powerKw: '', displacementL: '', fuelType: 'Diesel', payloadKg: '', bodyType: '', km: '', engineHours: '', avgDailyKm: '', avgDailyHours: '',
  status: 'OPERATIONAL', location: '', purchaseDate: '', purchasePrice: '', driverId: '', driverName: '', notes: '',
  heavyLoads: false, demandingTerrain: false, longHaul: false, urbanStopGo: false,
}

function fromVehicle(v: Vehicle): Values {
  const s = (n: number | null) => (n == null ? '' : String(n))
  return {
    fleetId: v.fleetId, registration: v.registration, vin: v.vin, manufacturer: v.manufacturer, model: v.model, variant: v.variant, year: s(v.year), category: v.category,
    engineType: v.engineType, engineCode: v.engineCode ?? '', powerKw: v.powerKw ? s(v.powerKw) : '', displacementL: v.displacementL ? s(v.displacementL) : '', fuelType: v.fuelType, payloadKg: v.payloadKg ? s(v.payloadKg) : '',
    bodyType: v.bodyType, km: s(v.km), engineHours: s(v.engineHours), avgDailyKm: v.avgDailyKm ? s(v.avgDailyKm) : '', avgDailyHours: v.avgDailyHours ? s(v.avgDailyHours) : '',
    status: v.status, location: v.location, purchaseDate: v.purchaseDate ?? '', purchasePrice: s(v.purchasePrice), driverId: v.driverId ?? '', driverName: v.driverName, notes: v.notes,
    heavyLoads: v.heavyLoads, demandingTerrain: v.demandingTerrain, longHaul: v.longHaul, urbanStopGo: v.urbanStopGo,
  }
}

// The label holds only the caption and points at the control by id. If the control sat inside the label,
// a click on the caption or on the empty space of the label would focus it again and it could not be left in one click.
function Field({ label, error, hint, span, required, children }: { label: string; error?: string; hint?: string; span?: boolean; required?: boolean; children: ReactNode }) {
  const id = useId()
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="inline-block text-sm font-medium text-ink">
        {label} {required && <span className="text-critical" aria-hidden="true">*</span>}
      </label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
      {hint && !error && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      {error && <p className="mt-1 text-sm text-critical">{error}</p>}
    </div>
  )
}

export function VehicleForm({ open, onClose, vehicle, onSaved }: { open: boolean; onClose: () => void; vehicle?: Vehicle | null; onSaved: (v: Vehicle) => void }) {
  const toast = useToast()
  const editing = !!vehicle
  const [v, setV] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [makeSel, setMakeSel] = useState('')
  const [modelSel, setModelSel] = useState('')
  const [engineSel, setEngineSel] = useState('')

  const makes = useApi<Named[]>(open ? '/catalog/makes' : null)
  const drivers = useApi<{ id: string; name: string }[]>(open ? '/users/drivers' : null)
  const models = useApi<Named[]>(open && makeSel && makeSel !== OTHER ? `/catalog/makes/${makeSel}/models` : null)
  const generations = useApi<Generation[]>(open && modelSel && modelSel !== OTHER ? `/catalog/models/${modelSel}/generations` : null)

  const year = Number(v.year)
  const generation = useMemo(() => generations.data?.find((g) => g.yearFrom != null && year >= g.yearFrom && year <= (g.yearTo ?? 9999)) ?? null, [generations.data, year])
  const engines = useApi<Engine[]>(open && generation ? `/catalog/generations/${generation.id}/engines` : null)

  // Reset whenever the drawer opens.
  useEffect(() => {
    if (!open) return
    setV(vehicle ? fromVehicle(vehicle) : EMPTY)
    setErrors({})
    setFormError(null)
    setMakeSel('')
    setModelSel('')
    setEngineSel('')
  }, [open, vehicle])

  // When editing, match the saved manufacturer and model back to the catalogue if they exist there.
  useEffect(() => {
    if (!open || !vehicle || !makes.data || makeSel) return
    const m = makes.data.find((x) => x.name === vehicle.manufacturer)
    setMakeSel(m ? String(m.id) : OTHER)
  }, [open, vehicle, makes.data, makeSel])
  useEffect(() => {
    if (!open || !vehicle || !models.data || modelSel) return
    const m = models.data.find((x) => x.name === vehicle.model)
    setModelSel(m ? String(m.id) : OTHER)
  }, [open, vehicle, models.data, modelSel])

  const set = (name: string, value: string | boolean) => {
    setV((x) => ({ ...x, [name]: value }))
    if (errors[name]) setErrors((e) => ({ ...e, [name]: '' }))
    setFormError(null)
  }
  const text = (name: string, extra: { type?: string; placeholder?: string; inputMode?: 'numeric' | 'decimal' } = {}) => (
    <input
      value={String(v[name])}
      onChange={(e) => set(name, e.target.value)}
      type={extra.type ?? 'text'}
      inputMode={extra.inputMode}
      placeholder={extra.placeholder}
      className={`${input} ${errors[name] ? 'border-critical' : 'border-line'}`}
    />
  )
  const select = (name: string, options: { value: string; label: string }[]) => (
    <select value={String(v[name])} onChange={(e) => set(name, e.target.value)} className={`${input} border-line`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )

  function pickMake(id: string) {
    setMakeSel(id)
    setModelSel('')
    setEngineSel('')
    set('engineCode', '')
    set('model', '')
    if (id === OTHER || id === '') set('manufacturer', '')
    else set('manufacturer', makes.data?.find((m) => String(m.id) === id)?.name ?? '')
  }
  function pickModel(id: string) {
    setModelSel(id)
    setEngineSel('')
    set('engineCode', '')
    if (id === OTHER || id === '') set('model', '')
    else set('model', models.data?.find((m) => String(m.id) === id)?.name ?? '')
  }
  function pickEngine(i: string) {
    setEngineSel(i)
    const e = engines.data?.[Number(i)]
    if (!e) return
    const bits = [e.family ?? e.code, e.displacementL ? `${e.displacementL} L` : null, e.cylinders ? `${e.cylinders}-cyl` : null, e.emission].filter(Boolean)
    setV((x) => ({ ...x, engineType: bits.join(', '), engineCode: e.code ?? '', powerKw: e.powerKw ? String(e.powerKw) : x.powerKw, displacementL: e.displacementL ? String(e.displacementL) : x.displacementL }))
  }

  async function submit() {
    const e: Record<string, string> = {}
    const req: [string, string][] = [['fleetId', 'Enter the fleet ID.'], ['registration', 'Enter the registration number.'], ['vin', 'Enter the VIN.'], ['manufacturer', 'Choose or enter a manufacturer.'], ['model', 'Choose or enter a model.'], ['km', 'Enter the odometer reading.'], ['engineHours', 'Enter the engine hours.'], ['year', 'Enter the production year.']]
    for (const [k, m] of req) if (!String(v[k]).trim()) e[k] = m
    setErrors(e)
    setFormError(null)
    if (Object.keys(e).length) return setFormError('Some fields need attention.')
    setBusy(true)
    const body = { ...v, purchaseDate: v.purchaseDate || null, purchasePrice: v.purchasePrice === '' ? null : v.purchasePrice, driverId: v.driverId || null, imageUrl: null }
    try {
      const saved = await api<Vehicle>(editing ? `/vehicles/${vehicle!.id}` : '/vehicles', { method: editing ? 'PUT' : 'POST', body })
      toast(editing ? 'Vehicle updated.' : 'Vehicle added.')
      onSaved(saved)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {})
        setFormError(err.fields && Object.keys(err.fields).length ? 'Some fields need attention.' : err.message)
      } else setFormError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const engineList = engines.data ?? []
  const E = (k: string) => errors[k]

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${vehicle!.fleetId}` : 'Add vehicle'}
      sub={editing ? vehicle!.registration : 'Pick make, model and engine from the catalogue, or type your own.'}
      footer={
        <>
          {formError && <p role="alert" className="mr-auto text-sm text-critical">{formError}</p>}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {editing ? 'Save changes' : 'Add vehicle'}
          </Button>
        </>
      }
    >
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <Field label="Fleet ID" required error={E('fleetId')}>{text('fleetId', { placeholder: '#123' })}</Field>
        <Field label="Registration" required error={E('registration')}>{text('registration', { placeholder: 'ZG 0000-AA' })}</Field>
        <Field label="VIN" required span error={E('vin')} hint="11 to 17 letters and digits.">{text('vin')}</Field>

        <Field label="Manufacturer" required error={makeSel === OTHER ? undefined : E('manufacturer')}>
          <select value={makeSel} onChange={(e) => pickMake(e.target.value)} className={`${input} ${E('manufacturer') ? 'border-critical' : 'border-line'}`} disabled={makes.loading}>
            <option value="">{makes.loading ? 'Loading catalogue…' : 'Choose…'}</option>
            {makes.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value={OTHER}>Other (type it)</option>
          </select>
        </Field>
        <Field label="Model" required error={makeSel === OTHER ? undefined : E('model')}>
          <select value={modelSel} onChange={(e) => pickModel(e.target.value)} className={`${input} ${E('model') ? 'border-critical' : 'border-line'}`} disabled={!makeSel || makeSel === OTHER || models.loading}>
            <option value="">{!makeSel ? 'Choose a manufacturer first' : models.loading ? 'Loading…' : 'Choose…'}</option>
            {models.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value={OTHER}>Other (type it)</option>
          </select>
        </Field>
        {makeSel === OTHER && <Field label="Manufacturer name" required error={E('manufacturer')}>{text('manufacturer')}</Field>}
        {(makeSel === OTHER || modelSel === OTHER) && <Field label="Model name" required error={E('model')}>{text('model')}</Field>}
        <Field label="Variant" hint="Power class or trim, for example 1845.">{text('variant')}</Field>
        <Field label="Production year" required error={E('year')} hint={generation ? `Catalogue generation: ${generation.name} (${generation.yearFrom}–${generation.yearTo ?? 'present'})` : undefined}>{text('year', { inputMode: 'numeric' })}</Field>

        {engineList.length > 0 && (
          <Field label="Engine from catalogue" span hint="Fills engine type, power and displacement. Choosing an engine also lets the predictions use its documented problems.">
            <select value={engineSel} onChange={(e) => pickEngine(e.target.value)} className={`${input} border-line`}>
              <option value="">Choose…</option>
              {engineList.map((e, i) => (
                <option key={i} value={i}>
                  {[e.code ?? e.family, e.powerKw ? `${e.powerKw} kW` : null, e.displacementL ? `${e.displacementL} L` : null, e.emission].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Category">{select('category', CATEGORIES.map((c) => ({ value: c, label: c })))}</Field>
        <Field label="Fuel">{select('fuelType', FUELS.map((c) => ({ value: c, label: c })))}</Field>
        <Field label="Engine type" span error={E('engineType')}>{text('engineType', { placeholder: '12.8 L inline-6 diesel, Euro 6' })}</Field>
        <Field label="Power (kW)" error={E('powerKw')}>{text('powerKw', { inputMode: 'numeric' })}</Field>
        <Field label="Displacement (L)" error={E('displacementL')}>{text('displacementL', { inputMode: 'decimal' })}</Field>
        <Field label="Payload (kg)" error={E('payloadKg')}>{text('payloadKg', { inputMode: 'numeric' })}</Field>
        <Field label="Body / superstructure">{text('bodyType')}</Field>

        <Field label="Odometer (km)" required error={E('km')}>{text('km', { inputMode: 'numeric' })}</Field>
        <Field label="Engine hours" required error={E('engineHours')}>{text('engineHours', { inputMode: 'numeric' })}</Field>
        <Field label="Average km per day" error={E('avgDailyKm')}>{text('avgDailyKm', { inputMode: 'numeric' })}</Field>
        <Field label="Average hours per day" error={E('avgDailyHours')}>{text('avgDailyHours', { inputMode: 'decimal' })}</Field>
        <Field label="Status">{select('status', Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })))}</Field>
        <Field label="Current location">{text('location')}</Field>
        <Field label="Purchase date" error={E('purchaseDate')}>{text('purchaseDate', { type: 'date' })}</Field>
        <Field label="Purchase price (€)" error={E('purchasePrice')}>{text('purchasePrice', { inputMode: 'numeric' })}</Field>

        <Field label="Assigned driver (app user)" error={E('driverId')}>
          <select value={String(v.driverId)} onChange={(e) => set('driverId', e.target.value)} className={`${input} border-line`}>
            <option value="">None</option>
            {drivers.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Driver name (not an app user)">{text('driverName')}</Field>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-ink">Operating conditions</legend>
          <p className="mt-0.5 text-xs text-ink-3">These raise the maintenance priority the prediction engine assigns.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([['heavyLoads', 'Frequent heavy loads'], ['demandingTerrain', 'Demanding terrain'], ['longHaul', 'Long-haul duty'], ['urbanStopGo', 'Urban stop-and-go']] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" checked={!!v[k]} onChange={(e) => set(k, e.target.checked)} className="size-4 accent-night" /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Notes" span>
          <textarea value={String(v.notes)} onChange={(e) => set('notes', e.target.value)} rows={3} className={`${input} h-auto border-line py-2`} />
        </Field>
      </div>
    </Drawer>
  )
}
