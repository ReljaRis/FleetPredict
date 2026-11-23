import { useState } from 'react'
import { Plus, TriangleAlert, Wrench } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Empty, ErrorState, FaultStatusTag, LoadingRows, SeverityTag, useToast } from '../../components/ui'
import { FaultDrawer, ServiceDrawer } from '../../components/drawers'
import { api, ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useVehicles } from '../../lib/useVehicles'
import { useAuth } from '../../lib/auth'
import { can } from '../../lib/permissions'
import { CATEGORY_LABEL, COMPONENT_LABEL, FAULT_STATUS_LABEL, fmtDate, fmtEur, fmtKm, SEVERITY_LABEL } from '../../lib/format'
import type { FaultReport, MaintenanceRecord, MaintenanceSummary } from '../../lib/types'

type Tab = 'service' | 'faults'
const PERIODS: [string, string, number | null][] = [['90', 'Last 90 days', 90], ['365', 'Last 12 months', 365], ['all', 'All time', null]]
const sel = 'h-10 rounded-md border border-line-strong bg-white px-2.5 text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber'

export default function MaintenancePage() {
  const { session } = useAuth()
  const role = session?.user.role
  const [tab, setTab] = useState<Tab>('service')
  const [vehicleId, setVehicleId] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [period, setPeriod] = useState('365')
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [svcDrawer, setSvcDrawer] = useState<{ record: MaintenanceRecord | null } | null>(null)
  const [faultDrawer, setFaultDrawer] = useState<{ record: FaultReport | null } | null>(null)
  const vehicles = useVehicles()

  const days = PERIODS.find((p) => p[0] === period)![2]
  const svcParams = new URLSearchParams()
  if (vehicleId) svcParams.set('vehicleId', vehicleId)
  if (category) svcParams.set('category', category)
  if (q.trim()) svcParams.set('q', q.trim())
  if (days) svcParams.set('from', new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10))
  const svc = useApi<MaintenanceRecord[]>(tab === 'service' ? `/maintenance?${svcParams}` : null)
  const summary = useApi<MaintenanceSummary>(tab === 'service' ? `/maintenance/summary?${svcParams}` : null)

  const fParams = new URLSearchParams()
  if (vehicleId) fParams.set('vehicleId', vehicleId)
  if (status) fParams.set('status', status)
  if (severity) fParams.set('severity', severity)
  if (q.trim()) fParams.set('q', q.trim())
  const faults = useApi<FaultReport[]>(tab === 'faults' ? `/faults?${fParams}` : null)

  const refresh = () => { svc.reload(); summary.reload(); faults.reload() }
  const vlist = vehicles.data ?? []

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Maintenance</h1>
        <div className="flex flex-wrap gap-2">
          {can(role, 'fault:write') && <Button onClick={() => setFaultDrawer({ record: null })}><TriangleAlert className="size-4" /> Report fault</Button>}
          {can(role, 'maintenance:write') && <Button variant="primary" onClick={() => setSvcDrawer({ record: null })}><Plus className="size-4" /> Log service</Button>}
        </div>
      </div>

      <div role="tablist" className="mt-6 flex border-b border-line">
        {([['service', 'Service records'], ['faults', 'Fault reports']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-[15px] ${tab === k ? 'border-night font-semibold' : 'border-transparent text-ink-3 hover:text-ink'}`}>{l}</button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'service' ? 'Search work, parts, workshop' : 'Search symptoms, reporter'} aria-label="Search" className={`${sel} min-w-[14rem] flex-1 sm:max-w-xs`} />
        <select aria-label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={sel}>
          <option value="">All vehicles</option>
          {vlist.map((v) => <option key={v.id} value={v.id}>{v.fleetId} · {v.registration}</option>)}
        </select>
        {tab === 'service' ? (
          <>
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={sel}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className={sel}>
              {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </>
        ) : (
          <>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
              <option value="">Any status</option>
              {Object.entries(FAULT_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={sel}>
              <option value="">Any severity</option>
              {Object.entries(SEVERITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </>
        )}
      </div>

      <div className="mt-6">
        {tab === 'service' ? (
          <ServiceTab svc={svc} summary={summary} canEdit={can(role, 'maintenance:write')} onEdit={(r) => setSvcDrawer({ record: r })} />
        ) : (
          <FaultsTab res={faults} canUpdate={can(role, 'fault:update')} onEdit={(f) => setFaultDrawer({ record: f })} onChanged={refresh} />
        )}
      </div>

      <ServiceDrawer open={!!svcDrawer} onClose={() => setSvcDrawer(null)} vehicles={vlist} record={svcDrawer?.record} onSaved={refresh} />
      <FaultDrawer open={!!faultDrawer} onClose={() => setFaultDrawer(null)} vehicles={vlist} record={faultDrawer?.record} onSaved={refresh} reporter={session?.user.name ?? ''} />
    </div>
  )
}

function ServiceTab({ svc, summary, canEdit, onEdit }: { svc: ReturnType<typeof useApi<MaintenanceRecord[]>>; summary: ReturnType<typeof useApi<MaintenanceSummary>>; canEdit: boolean; onEdit: (r: MaintenanceRecord) => void }) {
  if (svc.loading && !svc.data) return <LoadingRows rows={8} />
  if (svc.error) return <ErrorState message={svc.error} onRetry={svc.reload} />
  const rows = svc.data ?? []
  const s = summary.data
  return (
    <div className="space-y-8">
      {s && s.count > 0 && (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="num font-display text-4xl font-semibold">{fmtEur(s.total)}</p>
            <p className="num mt-1 text-sm text-ink-3">{s.count} records · {fmtEur(s.routine)} scheduled work · {fmtEur(s.repairs)} repairs</p>
            <div className="mt-4 h-44 bg-white py-2 pr-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.byMonth} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke="#dcd9d1" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5f636a' }} tickLine={false} axisLine={{ stroke: '#dcd9d1' }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 12, fill: '#5f636a' }} tickLine={false} axisLine={false} width={52} tickFormatter={(x) => fmtEur(x as number)} />
                  <Tooltip formatter={(x) => [fmtEur(x as number), 'Cost']} contentStyle={{ fontSize: 13, borderRadius: 6, border: '1px solid #dcd9d1' }} cursor={{ fill: '#e8e6df' }} />
                  <Bar dataKey="cost" fill="#16181b" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink-2">Cost by category</h2>
            <ul className="divide-y divide-line border-y border-line text-[15px]">
              {s.byCategory.slice(0, 6).map((c) => (
                <li key={c.category} className="flex justify-between gap-4 py-2">
                  <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <span className="num font-medium">{fmtEur(c.cost)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        <Empty title="No service records match" body="Change the filters, or log the first service for a vehicle." />
      ) : (
        <div className="bg-white">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <button disabled={!canEdit} onClick={() => onEdit(r)} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-4 py-3.5 text-left transition-colors enabled:hover:bg-canvas sm:grid-cols-[7rem_5.5rem_minmax(0,1fr)_auto]">
                  <span className="num text-sm text-ink-2">{fmtDate(r.date)}</span>
                  <span className="num font-display text-xl font-semibold leading-tight">{r.vehicle.fleetId}</span>
                  <span className="col-span-2 min-w-0 sm:col-span-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Wrench className="size-3.5 text-ink-3" />
                      <span className="font-medium">{CATEGORY_LABEL[r.category] ?? r.category}</span>
                      {r.component && COMPONENT_LABEL[r.component] !== CATEGORY_LABEL[r.category] && <span className="text-sm text-ink-3">{COMPONENT_LABEL[r.component]}</span>}
                      {r.routine && <span className="rounded-sm bg-sunken px-1.5 py-0.5 text-xs text-ink-2">Scheduled</span>}
                    </span>
                    <span className="mt-0.5 block text-[15px] text-ink-2">{r.description}</span>
                    <span className="num mt-1 block text-sm text-ink-3">{fmtKm(r.km)} · {r.provider}</span>
                  </span>
                  <span className="num text-right font-medium">{fmtEur(r.totalCost)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FaultsTab({ res, canUpdate, onEdit, onChanged }: { res: ReturnType<typeof useApi<FaultReport[]>>; canUpdate: boolean; onEdit: (f: FaultReport) => void; onChanged: () => void }) {
  const toast = useToast()
  async function setStatus(f: FaultReport, status: string) {
    try {
      await api(`/faults/${f.id}/status`, { method: 'PATCH', body: { status } })
      toast('Fault status updated.')
      onChanged()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    }
  }
  if (res.loading && !res.data) return <LoadingRows rows={6} />
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />
  if (!res.data?.length) return <Empty title="No fault reports match" body="Drivers and mechanics can report symptoms here. Open reports raise the maintenance priority of the affected component." />
  return (
    <ul className="divide-y divide-line bg-white">
      {res.data.map((f) => (
        <li key={f.id} className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="num font-display text-xl font-semibold">{f.vehicle.fleetId}</span>
            <SeverityTag severity={f.severity} />
            <FaultStatusTag status={f.status} />
            {f.component && <span className="text-sm text-ink-3">{COMPONENT_LABEL[f.component]}</span>}
            <span className="num ml-auto text-sm text-ink-3">{fmtDate(f.date)} · {fmtKm(f.km)}</span>
          </div>
          <p className="mt-2 max-w-4xl text-[15px]">{f.symptoms}</p>
          {f.notes && <p className="mt-1 text-sm text-ink-3">{f.notes}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            <span>Reported by {f.reportedBy}</span>
            {canUpdate && (
              <span className="ml-auto flex gap-1">
                {f.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => setStatus(f, 'UNDER_INSPECTION')}>Start inspection</Button>}
                {f.status !== 'RESOLVED' && <Button size="sm" variant="ghost" onClick={() => setStatus(f, 'RESOLVED')}>Mark resolved</Button>}
                {f.status === 'RESOLVED' && <Button size="sm" variant="ghost" onClick={() => setStatus(f, 'OPEN')}>Reopen</Button>}
                <Button size="sm" onClick={() => onEdit(f)}>Edit</Button>
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
