import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Button, RiskTag, useToast } from './ui'
import { useApi } from '../lib/useApi'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { can } from '../lib/permissions'
import { fmtEur, PRED_STATUS_LABEL, SCORE_NOTE } from '../lib/format'
import type { Prediction, RiskCategory, VehicleReport } from '../lib/types'

const BAR: Record<RiskCategory, string> = { LOW: 'bg-low', MODERATE: 'bg-moderate', HIGH: 'bg-high', CRITICAL: 'bg-critical' }

/** Bar with tick marks at the category thresholds (25, 50, 75), so the scale is readable without colour. */
export function RiskMeter({ score, category }: { score: number; category: RiskCategory }) {
  return (
    <div className="relative h-2 w-full bg-sunken" role="img" aria-label={`Risk score ${score} of 100`}>
      <div className={`h-full ${BAR[category]}`} style={{ width: `${score}%` }} />
      {[25, 50, 75].map((t) => (
        <span key={t} className="absolute inset-y-0 w-px bg-white" style={{ left: `${t}%` }} />
      ))}
    </div>
  )
}

/** Compact list of component conditions, worst first. Used on the vehicle overview. */
export function ComponentList({ report, onOpen }: { report: VehicleReport; onOpen: () => void }) {
  return (
    <ul className="divide-y divide-line border-y border-line bg-white">
      {report.predictions.map((p) => (
        <li key={p.id}>
          <button onClick={onOpen} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-canvas sm:grid-cols-[10rem_minmax(0,1fr)_9rem]">
            <span className="text-[15px] font-medium">{p.label}</span>
            <span className="order-3 col-span-2 sm:order-none sm:col-span-1"><RiskMeter score={p.score} category={p.category} /></span>
            <span className="justify-self-end"><RiskTag category={p.category} score={p.score} /></span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function PredictionActions({ p, onChanged }: { p: Prediction; onChanged: () => void }) {
  const { session } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!can(session?.user.role, 'prediction:act')) return <span className="text-sm text-ink-3">{PRED_STATUS_LABEL[p.status]}</span>
  async function set(status: string) {
    setBusy(true)
    try {
      await api(`/predictions/${p.id}/status`, { method: 'PATCH', body: { status } })
      toast('Prediction status updated.')
      onChanged()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <label className="flex items-center gap-2 text-sm text-ink-3">
      Status
      <select value={p.status} disabled={busy} onChange={(e) => set(e.target.value)} className="h-8 rounded-md border border-line-strong bg-white px-2 text-sm font-medium text-ink">
        {Object.entries(PRED_STATUS_LABEL).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
    </label>
  )
}

/** Cost block with the arithmetic shown, or the reason why there is no figure. */
export function EstimateBlock({ p }: { p: Prediction }) {
  const e = p.estimate
  if (!e.available)
    return (
      <div className="border-l-2 border-line-strong pl-4">
        <p className="text-sm font-medium text-ink">Financial impact</p>
        <p className="mt-1 text-sm text-ink-3">{e.reason} Enter the costs under Settings to see an estimate.</p>
      </div>
    )
  return (
    <div>
      <p className="text-sm font-medium text-ink">Financial impact (estimate)</p>
      <dl className="num mt-2 grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 border-y border-line py-3 text-[15px]">
        <dt className="text-ink-2">Repair cost if it fails (your assumption)</dt><dd>{fmtEur(e.repairCost)}</dd>
        <dt className="text-ink-2">Weighting from the priority score ({p.score}/100)</dt><dd>× {e.riskFactor.toFixed(2)}</dd>
        <dt className="text-ink-2">Weighted repair cost</dt><dd>{fmtEur(e.avoidedRepair)}</dd>
        <dt className="text-ink-2">Preventive inspection and service</dt><dd>− {fmtEur(e.preventiveCost)}</dd>
        <dt className="font-semibold">{(e.savings ?? 0) >= 0 ? 'Estimated saving by acting now' : 'Estimated net cost of acting now'}</dt>
        <dd className={`font-semibold ${(e.savings ?? 0) >= 0 ? 'text-low' : 'text-ink'}`}>{fmtEur(Math.abs(e.savings ?? 0))}</dd>
      </dl>
      <p className="mt-2 text-xs text-ink-3">An estimate from your own cost assumptions. The weighting is the priority score, not a failure probability, and savings are not guaranteed.</p>
    </div>
  )
}

function Row({ p, open, onToggle, onChanged, aiOn }: { p: Prediction; open: boolean; onToggle: () => void; onChanged: () => void; aiOn: boolean }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function explain() {
    setBusy(true)
    try {
      const r = await api<{ note: string | null }>(`/predictions/${p.id}/explain`, { method: 'POST', body: {} })
      if (r.note) toast(r.note, 'error')
      else toast('AI explanation added.')
      onChanged()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <li>
      <button onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-x-4 gap-y-2 px-4 py-4 text-left transition-colors hover:bg-canvas sm:grid-cols-[11rem_minmax(0,1fr)_auto_1.25rem]">
        <span>
          <span className="block font-medium">{p.label}</span>
          <span className="block text-sm text-ink-3">{p.timeframe}</span>
        </span>
        <span className="order-4 col-span-4 sm:order-none sm:col-span-1"><RiskMeter score={p.score} category={p.category} /></span>
        <RiskTag category={p.category} score={p.score} />
        <ChevronDown className={`size-4 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid gap-8 border-t border-line bg-white px-4 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5">
            <div>
              <p className="text-[15px] leading-relaxed">{p.explanation?.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                {p.explanationSource === 'LLM' ? (
                  <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5 text-amber-ink" /> Written by AI from the facts below and checked against the data. The score is not changed by AI.</span>
                ) : (
                  <span>Generated from the rules and the facts below.</span>
                )}
                {aiOn && p.explanationSource !== 'LLM' && p.category !== 'LOW' && (
                  <Button size="sm" variant="secondary" loading={busy} onClick={explain}><Sparkles className="size-3.5" /> Explain with AI</Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Recommended action</p>
              <p className="mt-1 text-[15px] text-ink-2">{p.action}</p>
              {p.explanation && p.category !== 'LOW' && (
                <>
                  <p className="mt-3 text-sm font-medium">Inspect</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">{p.explanation.inspect.map((i) => <li key={i} className="rounded-sm bg-sunken px-2 py-0.5 text-sm">{i}</li>)}</ul>
                  <p className="mt-3 text-sm font-medium">If it is ignored</p>
                  <p className="mt-1 text-[15px] text-ink-2">{p.explanation.ifIgnored}</p>
                </>
              )}
            </div>
            {p.missing.length > 0 && (
              <div className="border-l-2 border-moderate pl-4">
                <p className="text-sm font-medium">Missing data that limits this result</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-ink-2">{p.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}
            <PredictionActions p={p} onChanged={onChanged} />
          </div>
          <div className="min-w-0 space-y-6">
            <div>
              <p className="text-sm font-medium">Why this score</p>
              {p.factors.length === 0 ? (
                <p className="mt-1 text-sm text-ink-3">No risk factors were found in the available records.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line border-y border-line">
                  {p.factors.map((f) => (
                    <li key={f.code + f.detail} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2.5">
                      <span>
                        <span className="block text-[15px] font-medium">{f.label}</span>
                        <span className="block text-sm text-ink-3">{f.detail}</span>
                      </span>
                      <span className="num font-medium">+{f.points}</span>
                    </li>
                  ))}
                  <li className="flex justify-between py-2.5 text-[15px] font-semibold"><span>Priority score</span><span className="num">{p.score}</span></li>
                </ul>
              )}
            </div>
            <EstimateBlock p={p} />
          </div>
        </div>
      )}
    </li>
  )
}

export function ReportTab({ report, onChanged }: { report: VehicleReport; onChanged: () => void }) {
  const llm = useApi<{ configured: boolean }>('/predictions/llm/status')
  const o = report.overall
  const first = report.predictions.find((p) => p.category !== 'LOW')?.id ?? null
  const [openId, setOpenId] = useState<string | null>(first)
  const headline =
    o.critical > 0 ? `${o.critical} component${o.critical > 1 ? 's need' : ' needs'} attention before the next trip.`
    : o.high > 0 ? `${o.high} component${o.high > 1 ? 's' : ''} should be inspected within a week.`
    : o.moderate > 0 ? `${o.moderate} component${o.moderate > 1 ? 's' : ''} to include in the next scheduled service.`
    : 'No component needs attention based on the records on file.'
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold leading-tight">{headline}</h2>
          <p className="mt-1 text-sm text-ink-3">{SCORE_NOTE}</p>
        </div>
        {o.potentialSavings > 0 && (
          <div className="text-right">
            <p className="text-sm text-ink-3">Estimated value of acting now</p>
            <p className="num font-display text-3xl font-semibold text-low">{fmtEur(o.potentialSavings)}</p>
          </div>
        )}
      </div>

      {(report.vehicleMissing.length > 0 || o.actionableWithoutCosts > 0) && (
        <div className="mt-5 border-l-2 border-moderate pl-4">
          <p className="text-sm font-medium">Data that limits this report</p>
          <ul className="mt-1 list-disc pl-4 text-sm text-ink-2">
            {report.vehicleMissing.map((m) => <li key={m}>{m}</li>)}
            {o.actionableWithoutCosts > 0 && <li>{o.actionableWithoutCosts} component{o.actionableWithoutCosts > 1 ? 's' : ''} with elevated risk have no cost assumptions, so no savings are shown for them.</li>}
          </ul>
        </div>
      )}

      <ul className="mt-6 divide-y divide-line border-y border-line bg-white">
        {report.predictions.map((p) => (
          <Row key={p.id} p={p} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} onChanged={onChanged} aiOn={!!llm.data?.configured} />
        ))}
      </ul>
      {report.calculatedAt && <p className="mt-3 text-xs text-ink-3">Calculated {new Date(report.calculatedAt).toLocaleString('en-GB')} by the rule engine. It recalculates whenever records change.</p>}
    </div>
  )
}
