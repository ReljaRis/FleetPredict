import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Empty, ErrorState, LoadingRows, useToast } from '../../components/ui'
import { TripDrawer } from '../../components/drawers'
import { api, ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useVehicles } from '../../lib/useVehicles'
import { useAuth } from '../../lib/auth'
import { can } from '../../lib/permissions'
import { fmtDateTime, fmtH, fmtKm, fmtNum } from '../../lib/format'
import type { Trip } from '../../lib/types'

const sel = 'h-10 rounded-md border border-line-strong bg-white px-2.5 text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber'
const PERIODS: [string, string, number | null][] = [['30', 'Last 30 days', 30], ['90', 'Last 90 days', 90], ['all', 'All time', null]]

export default function RoutesPage() {
  const { session } = useAuth()
  const toast = useToast()
  const canWrite = can(session?.user.role, 'trip:write')
  const [q, setQ] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [period, setPeriod] = useState('30')
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const vehicles = useVehicles()

  const days = PERIODS.find((p) => p[0] === period)![2]
  const p = new URLSearchParams()
  if (q.trim()) p.set('q', q.trim())
  if (vehicleId) p.set('vehicleId', vehicleId)
  if (days) p.set('from', new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)) // date only, so the request path is stable between renders
  const { data, loading, error, reload } = useApi<{ trips: Trip[]; summary: { trips: number; distanceKm: number; hours: number } }>(`/trips?${p}`)

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

  const add = canWrite ? <Button variant="primary" onClick={() => setAdding(true)}><Plus className="size-4" /> Add trip</Button> : null

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Routes and usage</h1>
          <p className="mt-2 text-sm text-ink-3">Trips are entered by hand. No GPS or telematics feed is connected.</p>
        </div>
        {add}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search place, driver, notes" aria-label="Search trips" className={`${sel} min-w-[14rem] flex-1 sm:max-w-xs`} />
        <select aria-label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={sel}>
          <option value="">All vehicles</option>
          {vehicles.data?.map((v) => <option key={v.id} value={v.id}>{v.fleetId} · {v.registration}</option>)}
        </select>
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className={sel}>
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {data && (
        <dl className="num mt-6 grid max-w-xl grid-cols-3 gap-6 border-y border-line py-4">
          {[['Trips', fmtNum(data.summary.trips)], ['Distance', fmtKm(data.summary.distanceKm)], ['Engine hours', fmtH(data.summary.hours)]].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-ink-3">{k}</dt>
              <dd className="mt-0.5 font-display text-3xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4">
        {loading && !data ? (
          <LoadingRows rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.trips.length === 0 ? (
          <Empty title="No trips in this view" body="Try another period or vehicle, or add a trip." action={add ?? undefined} />
        ) : (
          <ul className="divide-y divide-line bg-white">
            {data?.trips.map((t) => (
              <li key={t.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-3.5">
                <span className="num font-display text-xl font-semibold">{t.vehicle.fleetId}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{t.origin} → {t.destination}</span>
                  <span className="num mt-0.5 block text-sm text-ink-3">{fmtDateTime(t.departure)} · {fmtKm(t.distanceKm)} · {fmtH(t.hours)} · {t.driverName}{t.loadKg != null && ` · ${fmtNum(t.loadKg)} kg`}</span>
                  {t.notes && <span className="mt-1 block text-sm text-ink-2">{t.notes}</span>}
                </span>
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
      </div>

      <TripDrawer open={adding} onClose={() => setAdding(false)} vehicles={vehicles.data ?? []} onSaved={reload} />
    </div>
  )
}
