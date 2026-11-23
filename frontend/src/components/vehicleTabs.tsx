import { useState } from 'react'
import { FileText, Pencil, Plus, Route as RouteIcon, TriangleAlert, Trash2, Wrench } from 'lucide-react'
import { Button, DocStatusTag, Empty, ErrorState, FaultStatusTag, LoadingRows, SeverityTag, useToast } from './ui'
import { DocumentDrawer, FaultDrawer, ServiceDrawer, TripDrawer } from './drawers'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { can } from '../lib/permissions'
import { CATEGORY_LABEL, COMPONENT_LABEL, fmtDate, fmtDateTime, fmtEur, fmtH, fmtKm, fmtNum } from '../lib/format'
import type { FaultReport, MaintenanceRecord, Trip, VehicleDetail, VehicleDocument } from '../lib/types'

type Item = { kind: 'service'; date: string; key: string; m: MaintenanceRecord } | { kind: 'fault'; date: string; key: string; f: FaultReport }

/** Service records and fault reports of one vehicle, newest first, on one timeline. */
export function TimelineTab({ v, onChanged }: { v: VehicleDetail; onChanged: () => void }) {
  const { session } = useAuth()
  const toast = useToast()
  const role = session?.user.role
  const [filter, setFilter] = useState<'all' | 'service' | 'faults'>('all')
  const [svc, setSvc] = useState<{ record: MaintenanceRecord | null } | null>(null)
  const [flt, setFlt] = useState<{ record: FaultReport | null } | null>(null)
  const maint = useApi<MaintenanceRecord[]>(`/maintenance?vehicleId=${v.id}`)
  const faults = useApi<FaultReport[]>(`/faults?vehicleId=${v.id}`)
  const refresh = () => { maint.reload(); faults.reload(); onChanged() }

  const loading = (maint.loading && !maint.data) || (faults.loading && !faults.data)
  const error = maint.error ?? faults.error
  const services = maint.data ?? []
  const fl = faults.data ?? []
  const items: Item[] = [
    ...(filter !== 'faults' ? services.map((m): Item => ({ kind: 'service', date: m.date, key: m.id, m })) : []),
    ...(filter !== 'service' ? fl.map((f): Item => ({ kind: 'fault', date: f.date, key: f.id, f })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const total = services.reduce((s, m) => s + m.totalCost, 0)

  async function setStatus(f: FaultReport, status: string) {
    try {
      await api(`/faults/${f.id}/status`, { method: 'PATCH', body: { status } })
      toast('Fault status updated.')
      refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    }
  }

  const vList = [v]
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Service and faults</h2>
          <p className="num mt-0.5 text-sm text-ink-3">{services.length} service records · {fmtEur(total)} total</p>
        </div>
        <div role="group" aria-label="Show" className="flex overflow-hidden rounded-md border border-line-strong bg-white text-sm">
          {([['all', 'All'], ['service', 'Service'], ['faults', 'Faults']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`px-3 py-2 ${filter === k ? 'bg-night text-white' : 'hover:bg-sunken'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <LoadingRows rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : items.length === 0 ? (
          <Empty title="Nothing recorded yet" body="Service records and fault reports appear here, newest first. Predictions get more reliable as the history grows." />
        ) : (
          <ol>
            {items.map((it) => (
              <li key={it.kind + it.key} className="relative grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-5 border-l border-line-strong pb-7 pl-5 last:pb-0">
                <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ${it.kind === 'fault' ? 'bg-high' : 'bg-night'}`} />
                <div className="num text-sm text-ink-3">
                  <p className="font-medium text-ink-2">{fmtDate(it.date)}</p>
                  <p className="mt-0.5">{fmtKm(it.kind === 'service' ? it.m.km : it.f.km)}</p>
                  <p>{fmtH(it.kind === 'service' ? it.m.engineHours : it.f.engineHours)}</p>
                </div>
                {it.kind === 'service' ? (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Wrench className="size-3.5 text-ink-3" />
                      <span className="font-semibold">{CATEGORY_LABEL[it.m.category] ?? it.m.category}</span>
                      {it.m.component && COMPONENT_LABEL[it.m.component] !== CATEGORY_LABEL[it.m.category] && <span className="text-sm text-ink-3">{COMPONENT_LABEL[it.m.component]}</span>}
                      {it.m.routine && <span className="rounded-sm bg-sunken px-1.5 py-0.5 text-xs text-ink-2">Scheduled</span>}
                      {can(role, 'maintenance:write') && <Button variant="ghost" size="sm" className="ml-auto" aria-label="Edit record" onClick={() => setSvc({ record: it.m })}><Pencil className="size-3.5" /> Edit</Button>}
                    </div>
                    <p className="mt-1 text-[15px]">{it.m.description}</p>
                    {it.m.parts && <p className="mt-0.5 text-sm text-ink-3">Parts: {it.m.parts}</p>}
                    <p className="num mt-1.5 text-sm text-ink-3">{it.m.provider} · labour {fmtEur(it.m.laborCost)} · parts {fmtEur(it.m.partsCost)} · <span className="font-medium text-ink-2">{fmtEur(it.m.totalCost)}</span></p>
                    {it.m.notes && <p className="mt-1 text-sm text-ink-3">{it.m.notes}</p>}
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <TriangleAlert className="size-3.5 text-high" />
                      <span className="font-semibold">Fault{it.f.component ? ` · ${COMPONENT_LABEL[it.f.component]}` : ''}</span>
                      <SeverityTag severity={it.f.severity} />
                      <FaultStatusTag status={it.f.status} />
                      {can(role, 'fault:update') && (
                        <span className="ml-auto flex flex-wrap items-center gap-1">
                          {it.f.status === 'OPEN' && <Button variant="ghost" size="sm" onClick={() => setStatus(it.f, 'UNDER_INSPECTION')}>Start inspection</Button>}
                          {it.f.status !== 'RESOLVED' && <Button variant="ghost" size="sm" onClick={() => setStatus(it.f, 'RESOLVED')}>Mark resolved</Button>}
                          <Button variant="ghost" size="sm" aria-label="Edit fault" onClick={() => setFlt({ record: it.f })}><Pencil className="size-3.5" /> Edit</Button>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[15px]">{it.f.symptoms}</p>
                    <p className="mt-1 text-sm text-ink-3">Reported by {it.f.reportedBy}</p>
                    {it.f.notes && <p className="mt-0.5 text-sm text-ink-3">{it.f.notes}</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <ServiceDrawer open={!!svc} onClose={() => setSvc(null)} vehicles={vList} vehicle={v} record={svc?.record} onSaved={refresh} />
      <FaultDrawer open={!!flt} onClose={() => setFlt(null)} vehicles={vList} vehicle={v} record={flt?.record} onSaved={refresh} reporter={session?.user.name ?? ''} />
    </div>
  )
}

export function DocumentsTab({ v }: { v: VehicleDetail }) {
  const { session } = useAuth()
  const canWrite = can(session?.user.role, 'document:write')
  const [drawer, setDrawer] = useState<{ record: VehicleDocument | null } | null>(null)
  const { data, loading, error, reload } = useApi<VehicleDocument[]>(`/documents?vehicleId=${v.id}`)
  const add = canWrite ? <Button size="sm" variant="primary" onClick={() => setDrawer({ record: null })}><Plus className="size-4" /> Add document</Button> : null
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Documents and expiry dates</h2>
        {add}
      </div>
      {loading && !data ? (
        <LoadingRows rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <Empty title="No documents on file" body="Add registration, insurance and inspection documents to track their expiry dates." action={add ?? undefined} />
      ) : (
        <ul className="divide-y divide-line bg-white">
          {data.map((d) => (
            <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
              <span className="flex min-w-0 items-center gap-2.5">
                <FileText className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.type}</span>
                  <span className="num block truncate text-sm text-ink-3">{d.number}{d.fileName ? ` · ${d.fileName}` : ''}</span>
                </span>
              </span>
              <span className="num order-3 col-span-2 text-sm text-ink-3 sm:order-none sm:col-span-1">{fmtDate(d.issueDate)} → <span className="font-medium text-ink-2">{fmtDate(d.expiryDate)}</span></span>
              <DocStatusTag status={d.status} days={d.daysLeft} />
              {canWrite ? <Button variant="ghost" size="sm" aria-label={`Edit ${d.type}`} onClick={() => setDrawer({ record: d })}><Pencil className="size-4" /></Button> : <span />}
            </li>
          ))}
        </ul>
      )}
      <DocumentDrawer open={!!drawer} onClose={() => setDrawer(null)} vehicles={[v]} vehicle={v} record={drawer?.record} onSaved={reload} />
    </div>
  )
}

/** Trip list for one vehicle, with add and delete. A trip that ends after the newest reading also advances the odometer. */
export function TripsSection({ v, onChanged }: { v: VehicleDetail; onChanged: () => void }) {
  const { session } = useAuth()
  const toast = useToast()
  const canWrite = can(session?.user.role, 'trip:write')
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { data, loading, error, reload } = useApi<{ trips: Trip[]; summary: { trips: number; distanceKm: number; hours: number } }>(`/trips?vehicleId=${v.id}`)

  async function remove(id: string) {
    try {
      await api(`/trips/${id}`, { method: 'DELETE' })
      toast('Trip deleted. Odometer history is unchanged.')
      setConfirmId(null)
      reload()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    }
  }

  return (
    <section className="mt-12">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Trips</h2>
          {data && <p className="num mt-0.5 text-sm text-ink-3">{data.summary.trips} trips · {fmtKm(data.summary.distanceKm)} · {fmtH(data.summary.hours)}</p>}
        </div>
        {canWrite && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add trip</Button>}
      </div>
      {loading && !data ? (
        <LoadingRows rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.trips.length ? (
        <p className="text-sm text-ink-3">No trips logged for this vehicle.</p>
      ) : (
        <ul className="divide-y divide-line bg-white">
          {data.trips.map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3">
              <RouteIcon className="mt-0.5 size-4 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.origin} → {t.destination}</p>
                <p className="num mt-0.5 text-sm text-ink-3">{fmtDateTime(t.departure)} · {fmtKm(t.distanceKm)} · {fmtH(t.hours)} · {t.driverName}{t.loadKg != null && ` · ${fmtNum(t.loadKg)} kg`}</p>
                {t.notes && <p className="mt-1 text-sm text-ink-2">{t.notes}</p>}
              </div>
              {canWrite &&
                (confirmId === t.id ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="danger" onClick={() => remove(t.id)}>Delete</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Keep</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" aria-label="Delete trip" onClick={() => setConfirmId(t.id)}><Trash2 className="size-4" /></Button>
                ))}
            </li>
          ))}
        </ul>
      )}
      <TripDrawer open={adding} onClose={() => setAdding(false)} vehicles={[v]} vehicle={v} onSaved={() => { reload(); onChanged() }} />
    </section>
  )
}
