import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DocStatusTag, Empty, ErrorState, FaultStatusTag, LoadingRows, RiskTag, SeverityTag, StatusTag } from '../../components/ui'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../../lib/auth'
import { CATEGORY_LABEL, fmtDate, fmtEur, fmtKm, fmtNum, SCORE_NOTE } from '../../lib/format'
import type { DocStatus, RiskCategory, Severity, FaultStatus } from '../../lib/types'

interface PredRow { id: string; vehicleId: string; fleetId: string; registration: string; vehicle: string; label: string; score: number; category: RiskCategory; timeframe: string; action: string; why: string[]; savings: number | null }
interface Dash {
  months: number
  counts: { vehicles: number; operational: number; inService: number; outOfService: number; highRiskStatus: number; elevatedRisk: number; openFaults: number; criticalFaults: number; documents: { expired: number; urgent: number; dueSoon: number }; maintenanceCost: number; routineCost: number; potentialSavings: number }
  riskDistribution: Record<RiskCategory, number>
  needsAttention: PredRow[]
  upcoming: PredRow[]
  highestRiskVehicles: { vehicleId: string; fleetId: string; vehicle: string; registration: string; status: string; component: string; score: number; category: RiskCategory }[]
  documentAlerts: { id: string; vehicleId: string; fleetId: string; type: string; expiryDate: string; status: DocStatus; daysLeft: number }[]
  recentFaults: { id: string; vehicleId: string; fleetId: string; component: string | null; severity: Severity; status: FaultStatus; date: string; symptoms: string }[]
  costByMonth: { month: string; cost: number }[]
  costByCategory: { category: string; cost: number }[]
  mileageByMonth: { month: string; km: number }[]
}

const BAR: Record<RiskCategory, string> = { CRITICAL: 'bg-critical', HIGH: 'bg-high', MODERATE: 'bg-moderate', LOW: 'bg-low' }
const LABEL: Record<RiskCategory, string> = { CRITICAL: 'Critical', HIGH: 'High', MODERATE: 'Moderate', LOW: 'Low' }
const axis = { fontSize: 12, fill: '#5f636a' }

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'bad' | 'good' }) {
  return (
    <div className="border-t-2 border-night pt-3">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className={`num mt-1 whitespace-nowrap font-display text-4xl font-semibold leading-none 2xl:text-3xl ${tone === 'bad' ? 'text-critical' : tone === 'good' ? 'text-low' : ''}`}>{value}</dd>
      {sub && <p className="num mt-1.5 text-sm text-ink-3">{sub}</p>}
    </div>
  )
}

const H = ({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <h2 className="font-display text-2xl font-semibold">{children}</h2>
    {aside}
  </div>
)

export default function DashboardPage() {
  const { session } = useAuth()
  const [months, setMonths] = useState(12)
  const { data: d, loading, error, reload } = useApi<Dash>(`/dashboard?months=${months}`)
  const first = session?.user.name.split(' ')[0]

  if (loading && !d) return <div><h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Control room</h1><div className="mt-8"><LoadingRows rows={10} /></div></div>
  if (error || !d) return <div><h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Control room</h1><div className="mt-8"><ErrorState message={error ?? 'No data.'} onRetry={reload} /></div></div>

  const c = d.counts
  const critical = d.riskDistribution.CRITICAL
  const docIssues = c.documents.expired + c.documents.urgent
  const headline: string[] = []
  if (c.vehicles === 0) headline.push('No vehicles yet.')
  else {
    if (critical) headline.push(`${critical} vehicle${critical > 1 ? 's have' : ' has'} a component that needs attention before the next trip.`)
    else if (c.elevatedRisk) headline.push(`${c.elevatedRisk} vehicle${c.elevatedRisk > 1 ? 's have' : ' has'} a component to inspect within a week.`)
    else headline.push('No vehicle has a high-risk component.')
    if (docIssues) headline.push(`${docIssues} document${docIssues > 1 ? 's are' : ' is'} expired or expire within 7 days.`)
    if (c.openFaults) headline.push(`${c.openFaults} open fault report${c.openFaults > 1 ? 's' : ''}.`)
  }

  const dist = d.riskDistribution
  const distTotal = Math.max(1, c.vehicles)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">{first ? `Hello, ${first}.` : ''} {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-none tracking-tight">Control room</h1>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Period for costs and mileage
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-9 rounded-md border border-line-strong bg-white px-2.5 text-[15px]">
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </label>
      </div>

      <p className="mt-5 max-w-3xl font-display text-3xl font-medium leading-tight">{headline.join(' ')}</p>

      <dl className="mt-8 grid grid-cols-2 gap-x-10 gap-y-9 sm:grid-cols-4 2xl:grid-cols-8 2xl:gap-x-6">
        <Stat label="Vehicles" value={fmtNum(c.vehicles)} sub={`${c.operational} operational`} />
        <Stat label="In service" value={fmtNum(c.inService)} sub={c.outOfService ? `${c.outOfService} out of service` : undefined} />
        <Stat label="High or critical" value={fmtNum(c.elevatedRisk)} sub="vehicles" tone={c.elevatedRisk ? 'bad' : undefined} />
        <Stat label="Open faults" value={fmtNum(c.openFaults)} sub={c.criticalFaults ? `${c.criticalFaults} high or critical` : undefined} tone={c.criticalFaults ? 'bad' : undefined} />
        <Stat label="Documents" value={fmtNum(docIssues)} sub={`${c.documents.dueSoon} more within 30 days`} tone={docIssues ? 'bad' : undefined} />
        <Stat label="Maintenance cost" value={fmtEur(c.maintenanceCost)} sub={`last ${d.months} months`} />
        <Stat label="Scheduled work" value={fmtEur(c.routineCost)} sub={c.maintenanceCost ? `${Math.round((c.routineCost / c.maintenanceCost) * 100)}% of cost` : undefined} />
        <Stat label="Value of acting now" value={c.potentialSavings ? fmtEur(c.potentialSavings) : '—'} sub={c.potentialSavings ? 'estimate' : 'needs cost inputs'} tone={c.potentialSavings ? 'good' : undefined} />
      </dl>

      <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-12">
          <section>
            <H aside={<Link to="/app/predictions" className="text-sm font-medium underline underline-offset-4">All predictions</Link>}>Needs attention</H>
            {d.needsAttention.length === 0 ? (
              <Empty title="Nothing urgent" body="No component is rated high or critical based on the records on file." />
            ) : (
              <ul className="divide-y divide-line border-y border-line bg-white">
                {d.needsAttention.map((p) => (
                  <li key={p.id}>
                    <Link to={`/app/fleet/${p.vehicleId}?tab=report`} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 px-4 py-4 transition-colors hover:bg-canvas sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
                      <span className="num font-display text-4xl font-semibold leading-none">{p.score}</span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-medium"><span className="num">{p.fleetId}</span> · {p.label}</span>
                          <RiskTag category={p.category} />
                          <span className="text-sm font-medium text-ink-2">{p.timeframe}</span>
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-3">{p.vehicle} · {p.registration}</span>
                        <span className="mt-1.5 block text-[15px] text-ink-2">{p.why.slice(0, 3).join(' · ')}</span>
                      </span>
                      <span className="num col-span-2 mt-2 text-sm text-ink-3 sm:col-span-1 sm:mt-0 sm:text-right">{p.savings != null && p.savings > 0 ? <>Est. saving<br className="hidden sm:block" /> <span className="font-semibold text-low">{fmtEur(p.savings)}</span></> : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-3">{SCORE_NOTE}</p>
          </section>

          <section>
            <H>Upcoming maintenance recommendations</H>
            {d.upcoming.length === 0 ? (
              <p className="text-sm text-ink-3">No moderate-priority items right now.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line bg-white">
                {d.upcoming.map((p) => (
                  <li key={p.id}>
                    <Link to={`/app/fleet/${p.vehicleId}?tab=report`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-canvas">
                      <span className="min-w-0">
                        <span className="font-medium"><span className="num">{p.fleetId}</span> · {p.label}</span>
                        <span className="block truncate text-sm text-ink-3">{p.timeframe} · {p.why[0]}</span>
                      </span>
                      <RiskTag category={p.category} score={p.score} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <H>Maintenance cost</H>
            {d.costByMonth.every((m) => m.cost === 0) ? (
              <p className="text-sm text-ink-3">No maintenance costs recorded in this period.</p>
            ) : (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div className="h-56 bg-white py-3 pr-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.costByMonth} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
                      <CartesianGrid stroke="#dcd9d1" vertical={false} />
                      <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: '#dcd9d1' }} minTickGap={16} />
                      <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(x) => fmtEur(x as number)} />
                      <Tooltip formatter={(x) => [fmtEur(x as number), 'Cost']} contentStyle={{ fontSize: 13, borderRadius: 6, border: '1px solid #dcd9d1' }} cursor={{ fill: '#e8e6df' }} />
                      <Bar dataKey="cost" fill="#16181b" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="divide-y divide-line border-y border-line text-[15px]">
                  {d.costByCategory.map((x) => (
                    <li key={x.category} className="flex justify-between gap-4 py-2">
                      <span>{CATEGORY_LABEL[x.category] ?? x.category}</span>
                      <span className="num font-medium">{fmtEur(x.cost)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section>
            <H>Fleet mileage per month</H>
            {d.mileageByMonth.every((m) => m.km === 0) ? (
              <p className="text-sm text-ink-3">Not enough odometer readings in this period.</p>
            ) : (
              <div className="h-56 bg-white py-3 pr-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.mileageByMonth} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
                    <CartesianGrid stroke="#dcd9d1" vertical={false} />
                    <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: '#dcd9d1' }} minTickGap={16} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={60} tickFormatter={(x) => fmtNum(x as number)} />
                    <Tooltip formatter={(x) => [fmtKm(x as number), 'Fleet distance']} contentStyle={{ fontSize: 13, borderRadius: 6, border: '1px solid #dcd9d1' }} />
                    <Line type="monotone" dataKey="km" stroke="#16181b" strokeWidth={2} dot={{ r: 2.5, fill: '#f2a33a', stroke: '#16181b' }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-xs text-ink-3">Calculated from manual odometer readings. A month with no readings shows no distance.</p>
          </section>
        </div>

        <aside className="min-w-0 space-y-12">
          <section>
            <H>Fleet by worst component</H>
            <div className="flex h-3 w-full overflow-hidden bg-sunken" role="img" aria-label="Vehicles by worst component risk">
              {(['CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as RiskCategory[]).map((k) => dist[k] > 0 && <div key={k} className={BAR[k]} style={{ width: `${(dist[k] / distTotal) * 100}%` }} />)}
            </div>
            <ul className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[15px]">
              {(['CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as RiskCategory[]).map((k) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><span className={`size-2.5 ${BAR[k]}`} />{LABEL[k]}</span>
                  <span className="font-medium">{dist[k]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <H aside={<Link to="/app/fleet" className="text-sm font-medium underline underline-offset-4">Fleet</Link>}>Highest-risk vehicles</H>
            {d.highestRiskVehicles.length === 0 ? (
              <p className="text-sm text-ink-3">No vehicle is above low risk.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line bg-white">
                {d.highestRiskVehicles.map((v) => (
                  <li key={v.vehicleId}>
                    <Link to={`/app/fleet/${v.vehicleId}?tab=report`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 hover:bg-canvas">
                      <span className="min-w-0">
                        <span className="num font-display text-xl font-semibold">{v.fleetId}</span> <span className="text-sm text-ink-3">{v.vehicle}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-sm text-ink-2"><StatusTag status={v.status} /> · {v.component}</span>
                      </span>
                      <RiskTag category={v.category} score={v.score} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <H aside={<Link to="/app/documents" className="text-sm font-medium underline underline-offset-4">All documents</Link>}>Document alerts</H>
            {d.documentAlerts.length === 0 ? (
              <p className="text-sm text-ink-3">Every document is valid for more than 30 days.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line bg-white">
                {d.documentAlerts.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link to={`/app/fleet/${x.vehicleId}?tab=documents`} className="min-w-0 hover:underline">
                      <span className="num font-medium">{x.fleetId}</span> <span className="text-[15px] text-ink-2">{x.type}</span>
                      <span className="num block text-xs text-ink-3">{fmtDate(x.expiryDate)}</span>
                    </Link>
                    <DocStatusTag status={x.status} days={x.daysLeft} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <H aside={<Link to="/app/maintenance" className="text-sm font-medium underline underline-offset-4">All faults</Link>}>Open fault reports</H>
            {d.recentFaults.length === 0 ? (
              <p className="text-sm text-ink-3">No open fault reports.</p>
            ) : (
              <ul className="space-y-4">
                {d.recentFaults.map((f) => (
                  <li key={f.id} className="border-l-2 border-ink pl-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
                      <Link to={`/app/fleet/${f.vehicleId}?tab=timeline`} className="num font-semibold text-ink hover:underline">{f.fleetId}</Link>
                      <SeverityTag severity={f.severity} />
                      <FaultStatusTag status={f.status} />
                      <span className="num">{fmtDate(f.date)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[15px] text-ink-2">{f.symptoms}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
