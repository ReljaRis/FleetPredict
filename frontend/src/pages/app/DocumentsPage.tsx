import { useState } from 'react'
import { FileText, Pencil, Plus } from 'lucide-react'
import { Button, DocStatusTag, Empty, ErrorState, LoadingRows } from '../../components/ui'
import { DocumentDrawer } from '../../components/drawers'
import { useApi } from '../../lib/useApi'
import { useVehicles } from '../../lib/useVehicles'
import { useAuth } from '../../lib/auth'
import { can } from '../../lib/permissions'
import { DOC_TYPES, fmtDate } from '../../lib/format'
import type { DocStatus, VehicleDocument } from '../../lib/types'

const sel = 'h-10 rounded-md border border-line-strong bg-white px-2.5 text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber'
const ORDER: [DocStatus, string][] = [['EXPIRED', 'Expired'], ['RED', 'Urgent, 7 days or less'], ['YELLOW', 'Due within 30 days'], ['GREEN', 'Valid']]

export default function DocumentsPage() {
  const { session } = useAuth()
  const canWrite = can(session?.user.role, 'document:write')
  const [q, setQ] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState<DocStatus | ''>('')
  const [drawer, setDrawer] = useState<{ record: VehicleDocument | null } | null>(null)
  const vehicles = useVehicles()

  const p = new URLSearchParams()
  if (q.trim()) p.set('q', q.trim())
  if (vehicleId) p.set('vehicleId', vehicleId)
  if (type) p.set('type', type)
  const { data, loading, error, reload } = useApi<VehicleDocument[]>(`/documents?${p}`)
  const all = data ?? []
  const count = (s: DocStatus) => all.filter((d) => d.status === s).length
  const rows = status ? all.filter((d) => d.status === status) : all
  const filtered = !!(q || vehicleId || type || status)

  const add = canWrite ? (
    <Button variant="primary" onClick={() => setDrawer({ record: null })}><Plus className="size-4" /> Add document</Button>
  ) : null

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Documents</h1>
        {add}
      </div>

      {data && (
        <div role="group" aria-label="Filter by status" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-3">
          {ORDER.map(([k, l]) => (
            <button key={k} aria-pressed={status === k} onClick={() => setStatus(status === k ? '' : k)} className={`flex items-baseline gap-2 border-b-2 pb-1 text-[15px] transition-colors ${status === k ? 'border-night text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}>
              <span className={`num font-display text-2xl font-semibold ${k === 'EXPIRED' && count(k) ? 'text-critical' : k === 'RED' && count(k) ? 'text-high' : ''}`}>{count(k)}</span> {l}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, vehicle, plate" aria-label="Search documents" className={`${sel} min-w-[14rem] flex-1 sm:max-w-xs`} />
        <select aria-label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={sel}>
          <option value="">All vehicles</option>
          {vehicles.data?.map((v) => <option key={v.id} value={v.id}>{v.fleetId} · {v.registration}</option>)}
        </select>
        <select aria-label="Document type" value={type} onChange={(e) => setType(e.target.value)} className={sel}>
          <option value="">All types</option>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="mt-4">
        {loading && !data ? (
          <LoadingRows rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          filtered ? (
            <Empty title="No documents match" body="Try other filters." action={<Button onClick={() => { setQ(''); setVehicleId(''); setType(''); setStatus('') }}>Clear filters</Button>} />
          ) : (
            <Empty title="No documents yet" body="Add registration, insurance and inspection documents to track their expiry dates." action={add ?? undefined} />
          )
        ) : (
          <ul className="divide-y divide-line bg-white">
            {rows.map((d) => (
              <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[5rem_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
                <span className="num font-display text-xl font-semibold">{d.vehicle.fleetId}</span>
                <span className="order-first col-span-2 flex min-w-0 items-center gap-2.5 sm:order-none sm:col-span-1">
                  <FileText className="size-4 shrink-0 text-ink-3" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.type}</span>
                    <span className="num block truncate text-sm text-ink-3">{d.number}{d.fileName ? ` · ${d.fileName}` : ''}</span>
                  </span>
                </span>
                <span className="num text-sm text-ink-3">{fmtDate(d.issueDate)} → <span className="font-medium text-ink-2">{fmtDate(d.expiryDate)}</span></span>
                <DocStatusTag status={d.status} days={d.daysLeft} />
                {canWrite ? <Button size="sm" variant="ghost" aria-label={`Edit ${d.type} for ${d.vehicle.fleetId}`} onClick={() => setDrawer({ record: d })}><Pencil className="size-4" /></Button> : <span />}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DocumentDrawer open={!!drawer} onClose={() => setDrawer(null)} vehicles={vehicles.data ?? []} record={drawer?.record} onSaved={reload} />
    </div>
  )
}
