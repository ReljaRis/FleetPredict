import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react'
import { Button, Empty, ErrorState, LoadingRows, RiskTag, StatusTag } from '../../components/ui'
import { VehicleForm } from '../../components/VehicleForm'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../../lib/auth'
import { can } from '../../lib/permissions'
import { fmtNum, STATUS_LABEL } from '../../lib/format'
import { vehicleTitle, type VehicleListItem } from '../../lib/types'

const SORTS: [string, string][] = [['fleetId', 'Fleet ID'], ['risk', 'Risk'], ['km', 'Mileage'], ['engineHours', 'Engine hours'], ['manufacturer', 'Manufacturer'], ['year', 'Year'], ['status', 'Status']]
const sel = 'h-10 rounded-md border border-line-strong bg-white px-2.5 text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber'

export default function FleetPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')
  const [risk, setRisk] = useState('')
  const [archived, setArchived] = useState('false')
  const [sort, setSort] = useState('fleetId')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const params = new URLSearchParams({ sort, dir, archived })
  if (debounced) params.set('q', debounced)
  if (status) params.set('status', status)
  if (risk) params.set('risk', risk)
  const { data, loading, error, reload } = useApi<VehicleListItem[]>(`/vehicles?${params}`)
  const canAdd = can(session?.user.role, 'vehicle:write')
  const filtered = !!(debounced || status || risk || archived !== 'false')

  const header = (key: string, label: string, right = false) => (
    <th scope="col" className={`px-3 py-2.5 font-medium ${right ? 'text-right' : 'text-left'}`} aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        onClick={() => (sort === key ? setDir(dir === 'asc' ? 'desc' : 'asc') : (setSort(key), setDir(key === 'risk' || key === 'km' || key === 'engineHours' ? 'desc' : 'asc')))}
        className={`inline-flex items-center gap-1 hover:text-ink ${right ? 'flex-row-reverse' : ''} ${sort === key ? 'text-ink' : ''}`}
      >
        {label}
        {sort === key && (dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
      </button>
    </th>
  )

  const counts = data && !filtered ? { all: data.length, op: data.filter((v) => v.status === 'OPERATIONAL').length, svc: data.filter((v) => v.status === 'IN_SERVICE').length, risk: data.filter((v) => v.status === 'HIGH_RISK').length } : null

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Fleet</h1>
          {counts && (
            <p className="num mt-2 text-sm text-ink-3">
              {counts.all} vehicles · {counts.op} operational · {counts.svc} in service · {counts.risk} high risk
            </p>
          )}
        </div>
        {canAdd && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add vehicle
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[14rem] flex-1 items-center sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 size-4 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, plate, VIN, model, driver" aria-label="Search vehicles" className={`${sel} w-full pl-9 pr-8`} />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2 rounded p-0.5 text-ink-3 hover:text-ink">
              <X className="size-4" />
            </button>
          )}
        </label>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <select aria-label="Filter by risk" value={risk} onChange={(e) => setRisk(e.target.value)} className={sel}>
          <option value="">Any risk</option>
          {['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((k) => (
            <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase()} risk</option>
          ))}
        </select>
        <select aria-label="Archived vehicles" value={archived} onChange={(e) => setArchived(e.target.value)} className={sel}>
          <option value="false">Active</option>
          <option value="true">Archived</option>
          <option value="all">Active and archived</option>
        </select>
        <div className="flex items-center gap-1 lg:hidden">
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>Sort: {l}</option>
            ))}
          </select>
          <Button aria-label="Reverse sort order" size="sm" className="h-10" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
            {dir === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {loading && !data ? (
          <LoadingRows rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.length === 0 ? (
          filtered ? (
            <Empty
              title="No vehicles match"
              body="Try a different search or clear the filters."
              action={<Button onClick={() => { setQ(''); setStatus(''); setRisk(''); setArchived('false') }}>Clear filters</Button>}
            />
          ) : (
            <Empty title="No vehicles yet" body="Add your first truck to start building its dossier, service history and maintenance predictions." action={canAdd ? <Button variant="primary" onClick={() => setAdding(true)}>Add vehicle</Button> : undefined} />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto bg-white lg:block">
              <table className="w-full text-[15px]">
                <thead className="border-b border-line text-sm text-ink-3">
                  <tr>
                    {header('fleetId', 'ID')}
                    {header('manufacturer', 'Vehicle')}
                    {header('status', 'Status')}
                    {header('risk', 'Top risk')}
                    {header('km', 'Odometer', true)}
                    {header('engineHours', 'Engine h', true)}
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">Location · Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data?.map((v) => (
                    <tr key={v.id} onClick={() => navigate(`/app/fleet/${v.id}`)} className={`cursor-pointer transition-colors hover:bg-canvas ${v.archived ? 'opacity-60' : ''}`}>
                      <td className="num px-3 py-3 font-display text-xl font-semibold">
                        <Link to={`/app/fleet/${v.id}`} className="focus-visible:outline-2 focus-visible:outline-amber">{v.fleetId}</Link>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{vehicleTitle(v)} <span className="text-ink-3">· {v.year}</span></p>
                        <p className="num text-sm text-ink-3">{v.registration}{v.archived && ' · Archived'}</p>
                      </td>
                      <td className="px-3 py-3"><StatusTag status={v.status} /></td>
                      <td className="px-3 py-3">{v.topRisk ? <RiskTag category={v.topRisk.category} score={v.topRisk.score} /> : <span className="text-sm text-ink-3">Not assessed</span>}</td>
                      <td className="num px-3 py-3 text-right">{fmtNum(v.km)} km</td>
                      <td className="num px-3 py-3 text-right">{fmtNum(v.engineHours)}</td>
                      <td className="px-3 py-3 text-sm text-ink-2">{v.location || '—'}<br /><span className="text-ink-3">{v.driverLabel || 'Unassigned'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile and tablet list */}
            <ul className="divide-y divide-line border-y border-line bg-white lg:hidden">
              {data?.map((v) => (
                <li key={v.id}>
                  <Link to={`/app/fleet/${v.id}`} className={`block px-4 py-3.5 ${v.archived ? 'opacity-60' : ''}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="num font-display text-2xl font-semibold">{v.fleetId}</span>
                      <StatusTag status={v.status} />
                    </div>
                    <p className="mt-0.5 font-medium">{vehicleTitle(v)} <span className="text-ink-3">· {v.year}</span></p>
                    <div className="num mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
                      <span>{v.registration}</span>
                      <span>{fmtNum(v.km)} km</span>
                      <span>{fmtNum(v.engineHours)} h</span>
                      {v.topRisk ? <RiskTag category={v.topRisk.category} score={v.topRisk.score} /> : <span>Not assessed</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <VehicleForm open={adding} onClose={() => setAdding(false)} onSaved={(v) => navigate(`/app/fleet/${v.id}`)} />
    </div>
  )
}
