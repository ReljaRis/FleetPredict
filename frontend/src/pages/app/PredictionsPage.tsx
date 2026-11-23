import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorState, LoadingRows, RiskTag } from '../../components/ui'
import { PredictionActions } from '../../components/report'
import { useApi } from '../../lib/useApi'
import { useVehicles } from '../../lib/useVehicles'
import { COMPONENT_LABEL, fmtEur, PRED_STATUS_LABEL, SCORE_NOTE } from '../../lib/format'
import { vehicleTitle, type Prediction } from '../../lib/types'

const sel = 'h-10 rounded-md border border-line-strong bg-white px-2.5 text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber'

export default function PredictionsPage() {
  const [category, setCategory] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [component, setComponent] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [includeLow, setIncludeLow] = useState(false)
  const vehicles = useVehicles()

  const p = new URLSearchParams()
  if (category) p.set('category', category)
  if (vehicleId) p.set('vehicleId', vehicleId)
  if (component) p.set('component', component)
  if (status) p.set('status', status)
  if (from) p.set('from', from)
  if (includeLow) p.set('includeLow', 'true')
  const { data, loading, error, reload } = useApi<{ predictions: Prediction[]; potentialSavings: number }>(`/predictions?${p}`)
  const filtered = !!(category || vehicleId || component || status || from)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Predictions</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-3">{SCORE_NOTE} Each one comes from rules applied to service history, faults, mileage and operating conditions.</p>
        </div>
        {data && data.potentialSavings > 0 && (
          <div className="text-right">
            <p className="text-sm text-ink-3">Estimated value of acting on high and critical items</p>
            <p className="num font-display text-3xl font-semibold text-low">{fmtEur(data.potentialSavings)}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <select aria-label="Risk category" value={category} onChange={(e) => setCategory(e.target.value)} className={sel}>
          <option value="">All risk levels</option>
          {['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((k) => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase()}</option>)}
        </select>
        <select aria-label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={sel}>
          <option value="">All vehicles</option>
          {vehicles.data?.map((v) => <option key={v.id} value={v.id}>{v.fleetId} · {v.registration}</option>)}
        </select>
        <select aria-label="Component" value={component} onChange={(e) => setComponent(e.target.value)} className={sel}>
          <option value="">All components</option>
          {Object.entries(COMPONENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="">Any status</option>
          {Object.entries(PRED_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Calculated since
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${sel} text-sm`} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={includeLow} onChange={(e) => setIncludeLow(e.target.checked)} className="size-4 accent-night" /> Include low risk
        </label>
      </div>

      <div className="mt-4">
        {loading && !data ? (
          <LoadingRows rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data?.predictions.length ? (
          <Empty title={filtered ? 'No predictions match' : 'Nothing needs attention'} body={filtered ? 'Try other filters, or include low-risk items.' : 'No component is above low risk based on the records on file.'} />
        ) : (
          <ul className="divide-y divide-line bg-white">
            {data.predictions.map((pr) => (
              <li key={pr.id} className="grid gap-x-5 gap-y-2 px-4 py-4 lg:grid-cols-[4.5rem_minmax(0,1.5fr)_minmax(0,1.2fr)_auto]">
                <div className="flex items-center gap-3 lg:block">
                  <p className="num font-display text-4xl font-semibold leading-none">{pr.score}</p>
                  <RiskTag category={pr.category} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">
                    <Link to={`/app/fleet/${pr.vehicleId}?tab=report`} className="underline-offset-4 hover:underline"><span className="num">{pr.vehicle.fleetId}</span> · {pr.label}</Link>
                  </p>
                  <p className="text-sm text-ink-3">{vehicleTitle(pr.vehicle)} · {pr.vehicle.registration}</p>
                  <p className="mt-1.5 text-sm font-medium">{pr.timeframe}</p>
                  <p className="mt-0.5 text-sm text-ink-2">{pr.action}</p>
                </div>
                <div className="min-w-0">
                  <ul className="space-y-1 text-sm">
                    {pr.factors.slice(0, 3).map((f) => (
                      <li key={f.code + f.detail} className="flex justify-between gap-3"><span className="text-ink-2">{f.label}</span><span className="num font-medium">+{f.points}</span></li>
                    ))}
                  </ul>
                  <p className="num mt-2 text-sm text-ink-3">
                    {pr.estimate.available ? `Estimated saving ${fmtEur(pr.estimate.savings)} (repair ${fmtEur(pr.estimate.repairCost)}, prevention ${fmtEur(pr.estimate.preventiveCost)})` : 'No cost estimate: costs not entered'}
                  </p>
                </div>
                <div className="lg:justify-self-end"><PredictionActions p={pr} onChanged={reload} /></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
