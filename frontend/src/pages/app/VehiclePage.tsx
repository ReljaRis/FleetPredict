import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowLeft, Gauge, Pencil, TriangleAlert, Wrench } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Drawer, ErrorState, LoadingRows, RiskTag, StatusTag, useToast } from '../../components/ui'
import { ComponentList, ReportTab } from '../../components/report'
import { VehicleForm } from '../../components/VehicleForm'
import { FaultDrawer, ServiceDrawer } from '../../components/drawers'
import { DocumentsTab, TimelineTab, TripsSection } from '../../components/vehicleTabs'
import { api, ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../../lib/auth'
import { can } from '../../lib/permissions'
import { fmtDate, fmtEur, fmtH, fmtKm, fmtNum, toDateTimeInput, ago } from '../../lib/format'
import { vehicleTitle, type ReadingsResponse, type VehicleDetail, type VehicleReport } from '../../lib/types'

type Tab = 'overview' | 'report' | 'timeline' | 'operating' | 'documents'
const TABS: Tab[] = ['overview', 'report', 'timeline', 'operating', 'documents']
const PERIODS: [string, string, number | null][] = [['30d', '30 days', 30], ['90d', '90 days', 90], ['12m', '12 months', 365], ['all', 'All time', null]]

export default function VehiclePage() {
  const { id } = useParams()
  const { session } = useAuth()
  const toast = useToast()
  const role = session?.user.role
  const { data: v, loading, error, reload } = useApi<VehicleDetail>(`/vehicles/${id}`)
  const report = useApi<VehicleReport>(id ? `/predictions/vehicle/${id}` : null)
  const reloadAll = () => { reload(); report.reload() }
  const [search] = useSearchParams()
  const asked = search.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(asked && TABS.includes(asked) ? asked : 'overview')
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [quick, setQuick] = useState<'service' | 'fault' | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !v)
    return (
      <div>
        <Back />
        <div className="mt-6"><LoadingRows rows={6} /></div>
      </div>
    )
  if (error || !v)
    return (
      <div>
        <Back />
        <div className="mt-6"><ErrorState message={error ?? 'Vehicle not found.'} onRetry={reload} /></div>
      </div>
    )

  async function toggleArchive() {
    setBusy(true)
    try {
      await api(`/vehicles/${v!.id}/${v!.archived ? 'restore' : 'archive'}`, { method: 'POST' })
      toast(v!.archived ? 'Vehicle restored to the active fleet.' : 'Vehicle archived. Its history is kept.')
      setConfirmArchive(false)
      reloadAll()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Back />
      <header className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="num font-display text-5xl font-semibold leading-none tracking-tight">{v.fleetId}</h1>
            <p className="text-xl text-ink-2">{vehicleTitle(v)} <span className="text-ink-3">· {v.year}</span></p>
          </div>
          <p className="num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-3">
            <span>{v.registration}</span>
            <span>VIN {v.vin}</span>
            <span>{fmtKm(v.km)}</span>
            <span>{fmtH(v.engineHours)}</span>
          </p>
          <div className="mt-3 flex items-center gap-4">
            {v.archived ? <span className="rounded-sm bg-sunken px-1.5 py-0.5 text-sm font-medium text-ink-2">Archived</span> : <StatusTag status={v.status} />}
            {report.data && report.data.predictions[0] && report.data.predictions[0].category !== 'LOW' && (
              <button onClick={() => setTab('report')} className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
                <RiskTag category={report.data.predictions[0].category} score={report.data.predictions[0].score} />
                <span>{report.data.predictions[0].label}</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(role, 'fault:write') && (
            <Button onClick={() => setQuick('fault')}>
              <TriangleAlert className="size-4" /> Report fault
            </Button>
          )}
          {can(role, 'maintenance:write') && (
            <Button onClick={() => setQuick('service')}>
              <Wrench className="size-4" /> Log service
            </Button>
          )}
          {can(role, 'vehicle:write') && (
            <Button onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
          )}
          {can(role, 'vehicle:delete') &&
            (confirmArchive ? (
              <>
                <Button variant="danger" loading={busy} onClick={toggleArchive}>{v.archived ? 'Confirm restore' : 'Confirm archive'}</Button>
                <Button variant="ghost" onClick={() => setConfirmArchive(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmArchive(true)}>
                {v.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />} {v.archived ? 'Restore' : 'Archive'}
              </Button>
            ))}
        </div>
      </header>

      <div role="tablist" className="mt-8 flex overflow-x-auto border-b border-line">
        {([['overview', 'Overview'], ['report', 'AI report'], ['timeline', 'Service & faults'], ['operating', 'Operating data'], ['documents', 'Documents']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[15px] transition-colors ${tab === k ? 'border-night font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && <Overview v={v} report={report} onOpenReport={() => setTab('report')} />}
        {tab === 'report' && (report.loading && !report.data ? <LoadingRows rows={6} /> : report.error || !report.data ? <ErrorState message={report.error ?? 'The report is not available.'} onRetry={report.reload} /> : <ReportTab report={report.data} onChanged={report.reload} />)}
        {tab === 'timeline' && <TimelineTab v={v} onChanged={reloadAll} />}
        {tab === 'operating' && (
          <>
            <Operating v={v} canWrite={can(role, 'reading:write')} onChanged={reloadAll} />
            <TripsSection v={v} onChanged={reloadAll} />
          </>
        )}
        {tab === 'documents' && <DocumentsTab v={v} />}
      </div>

      <ServiceDrawer open={quick === 'service'} onClose={() => setQuick(null)} vehicles={[v]} vehicle={v} onSaved={() => { setTab('timeline'); reloadAll() }} />
      <FaultDrawer open={quick === 'fault'} onClose={() => setQuick(null)} vehicles={[v]} vehicle={v} onSaved={() => { setTab('timeline'); reloadAll() }} reporter={session?.user.name ?? ''} />
      <VehicleForm open={editing} onClose={() => setEditing(false)} vehicle={v} onSaved={reloadAll} />
    </div>
  )
}

function Back() {
  return (
    <Link to="/app/fleet" className="inline-flex items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink">
      <ArrowLeft className="size-4" /> Fleet
    </Link>
  )
}

function Overview({ v, report, onOpenReport }: { v: VehicleDetail; report: { data: VehicleReport | null; loading: boolean; error: string | null }; onOpenReport: () => void }) {
  const rows: [string, string][] = [
    ['Category', v.category],
    ['Body', v.bodyType || '—'],
    ['Engine', v.engineType || '—'],
    ['Power', v.powerKw ? `${v.powerKw} kW` : '—'],
    ['Displacement', v.displacementL ? `${v.displacementL} L` : '—'],
    ['Fuel', v.fuelType],
    ['Payload', v.payloadKg ? `${fmtNum(v.payloadKg)} kg` : '—'],
    ['Purchased', v.purchaseDate ? `${fmtDate(v.purchaseDate)}${v.purchasePrice ? ` · ${fmtEur(v.purchasePrice)}` : ''}` : '—'],
    ['Location', v.location || '—'],
    ['Driver', v.driver?.name ?? (v.driverName || 'Unassigned')],
  ]
  const conditions: [boolean, string][] = [[v.heavyLoads, 'Heavy loads'], [v.demandingTerrain, 'Demanding terrain'], [v.longHaul, 'Long haul'], [v.urbanStopGo, 'Urban stop-and-go']]
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className="lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">Component condition</h2>
          <button onClick={onOpenReport} className="text-sm font-medium underline underline-offset-4">Open AI report</button>
        </div>
        {report.data ? <ComponentList report={report.data} onOpen={onOpenReport} /> : report.loading ? <LoadingRows rows={4} /> : <p className="text-sm text-ink-3">The condition summary is not available.</p>}
        <p className="mt-2 text-xs text-ink-3">Scores rank maintenance priority from this truck’s records. They are not failure probabilities.</p>
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">Specification</h2>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-8 gap-y-2.5 border-y border-line py-4 text-[15px]">
          {rows.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className="min-w-0 text-ink">{val}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">Operating profile</h2>
        <p className="num text-[15px]">{fmtNum(v.avgDailyKm)} km and {v.avgDailyHours} h per day on average</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {conditions.map(([on, l]) => (
            <li key={l} className={`rounded-sm px-2 py-0.5 text-sm ${on ? 'bg-night text-white' : 'text-ink-3 line-through decoration-ink-3/40'}`}>{l}</li>
          ))}
        </ul>
        {v.notes && <p className="mt-4 text-[15px] text-ink-2">{v.notes}</p>}
        <p className="mt-6 text-sm text-ink-3">Mileage and engine hours are entered by hand. No telematics feed is connected.</p>
      </section>
    </div>
  )
}

function Operating({ v, canWrite, onChanged }: { v: VehicleDetail; canWrite: boolean; onChanged: () => void }) {
  const [period, setPeriod] = useState('12m')
  const [adding, setAdding] = useState(false)
  const days = PERIODS.find((p) => p[0] === period)![2]
  // Recomputed only when the period changes, so the request path is stable between renders.
  const path = useMemo(() => `/vehicles/${v.id}/readings${days ? `?from=${encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString())}` : ''}`, [v.id, days])
  const { data, loading, error, reload } = useApi<ReadingsResponse>(path)
  const chart = (data?.readings ?? []).map((r) => ({ date: r.recordedAt.slice(0, 10), km: r.km }))
  const s = data?.summary

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Mileage and engine hours</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Period" className="flex overflow-hidden rounded-md border border-line-strong bg-white text-sm">
            {PERIODS.map(([k, l]) => (
              <button key={k} aria-pressed={period === k} onClick={() => setPeriod(k)} className={`px-3 py-2 transition-colors ${period === k ? 'bg-night text-white' : 'hover:bg-sunken'}`}>{l}</button>
            ))}
          </div>
          {canWrite && (
            <Button variant="primary" size="sm" className="h-9" onClick={() => setAdding(true)}>
              <Gauge className="size-4" /> Add reading
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6">
        {loading && !data ? (
          <LoadingRows rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div>
              {chart.length < 2 ? (
                <p className="border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-3">At least two readings in this period are needed to draw a trend.</p>
              ) : (
                <div className="h-72 bg-white py-3 pr-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid stroke="#dcd9d1" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#5f636a' }} tickLine={false} axisLine={{ stroke: '#dcd9d1' }} minTickGap={36} />
                      <YAxis tick={{ fontSize: 12, fill: '#5f636a' }} tickLine={false} axisLine={false} width={68} domain={['dataMin', 'dataMax']} tickFormatter={(x) => fmtNum(x as number)} />
                      <Tooltip formatter={(x) => [fmtKm(x as number), 'Odometer']} contentStyle={{ fontSize: 13, borderRadius: 6, border: '1px solid #dcd9d1' }} />
                      <Line type="monotone" dataKey="km" stroke="#16181b" strokeWidth={2} dot={{ r: 2.5, fill: '#f2a33a', stroke: '#16181b' }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {s ? (
                <dl className="num mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4 text-[15px] sm:grid-cols-4">
                  {[['Distance', fmtKm(s.distanceKm)], ['Engine hours', fmtH(s.hours)], ['Avg per day', fmtKm(s.avgDailyKm)], ['Hours per day', s.avgDailyHours != null ? `${s.avgDailyHours} h` : '—']].map(([k, val]) => (
                    <div key={k}>
                      <dt className="text-sm text-ink-3">{k}</dt>
                      <dd className="mt-0.5 font-display text-2xl font-semibold">{val}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-5 text-sm text-ink-3">Period totals appear once there are two readings in the selected period.</p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-2">Readings</h3>
              {data && data.readings.length === 0 ? (
                <p className="text-sm text-ink-3">No readings in this period.</p>
              ) : (
                <table className="num w-full text-sm">
                  <thead className="text-left text-ink-3"><tr><th className="py-1.5 font-medium">Date</th><th className="py-1.5 text-right font-medium">Odometer</th><th className="py-1.5 text-right font-medium">Hours</th></tr></thead>
                  <tbody className="divide-y divide-line border-t border-line">
                    {[...(data?.readings ?? [])].reverse().map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 text-ink-2">{fmtDate(r.recordedAt)}</td>
                        <td className="py-2 text-right">{fmtKm(r.km)}</td>
                        <td className="py-2 text-right text-ink-3">{fmtNum(r.engineHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data && data.readings.length > 0 && <p className="mt-3 text-xs text-ink-3">Latest reading {ago(data.readings[data.readings.length - 1].recordedAt)}.</p>}
            </div>
          </div>
        )}
      </div>

      <ReadingForm open={adding} onClose={() => setAdding(false)} v={v} onSaved={() => { reload(); onChanged() }} />
    </div>
  )
}

function ReadingForm({ open, onClose, v, onSaved }: { open: boolean; onClose: () => void; v: VehicleDetail; onSaved: () => void }) {
  const toast = useToast()
  const [at, setAt] = useState(toDateTimeInput())
  const [km, setKm] = useState(String(v.km))
  const [hours, setHours] = useState(String(v.engineHours))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Fresh defaults each time the drawer opens.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAt(toDateTimeInput()); setKm(String(v.km)); setHours(String(v.engineHours)); setErrors({}); setFormError(null)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!at) errs.recordedAt = 'Enter the date and time.'
    if (km.trim() === '') errs.km = 'Enter the odometer reading.'
    if (hours.trim() === '') errs.engineHours = 'Enter the engine hours.'
    setErrors(errs)
    setFormError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await api(`/vehicles/${v.id}/readings`, { body: { recordedAt: new Date(at).toISOString(), km, engineHours: hours } })
      toast('Reading saved.')
      onSaved()
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {})
        setFormError(err.fields ? err.message : err.message)
      } else setFormError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const f = (name: string, label: string, value: string, set: (x: string) => void, type = 'text') => (
    <div>
      <label htmlFor={`r-${name}`} className="block text-sm font-medium">{label}</label>
      <input id={`r-${name}`} type={type} inputMode={type === 'text' ? 'numeric' : undefined} value={value} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[name]} className={`mt-1.5 h-10 w-full rounded-md border bg-white px-3 text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber ${errors[name] ? 'border-critical' : 'border-line'}`} />
      {errors[name] && <p className="mt-1 text-sm text-critical">{errors[name]}</p>}
    </div>
  )

  return (
    <Drawer open={open} onClose={onClose} title="Add reading" sub={`${v.fleetId} · ${v.registration}`}
      footer={<>
        {formError && <p role="alert" className="mr-auto text-sm text-critical">{formError}</p>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} onClick={submit as unknown as () => void}>Save reading</Button>
      </>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-3">Odometer and engine hours cannot be lower than an earlier reading.</p>
        {f('recordedAt', 'Date and time', at, setAt, 'datetime-local')}
        {f('km', 'Odometer (km)', km, setKm)}
        {f('engineHours', 'Engine hours', hours, setHours)}
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  )
}
