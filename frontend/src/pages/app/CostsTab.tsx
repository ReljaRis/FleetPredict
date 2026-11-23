import { useEffect, useState } from 'react'
import { Button, ErrorState, LoadingRows, useToast } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../../lib/auth'
import { can } from '../../lib/permissions'
import type { CostRow } from '../../lib/types'

type Draft = Record<string, { repairCost: string; preventiveCost: string; intervalKm: string; intervalMonths: string }>
const s = (n: number | null) => (n == null ? '' : String(n))
const cell = 'h-10 w-full rounded-md border bg-white px-2.5 text-right text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber disabled:bg-transparent disabled:border-transparent'

/** Settings. For now: cost assumptions and service intervals, which the prediction engine and the savings estimate use. */
export default function CostsTab() {
  const { session } = useAuth()
  const toast = useToast()
  const canWrite = can(session?.user.role, 'costs:write')
  const { data, loading, error, reload } = useApi<CostRow[]>('/costs')
  const [draft, setDraft] = useState<Draft>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.map((r) => [r.component, { repairCost: s(r.repairCost), preventiveCost: s(r.preventiveCost), intervalKm: s(r.intervalKm), intervalMonths: s(r.intervalMonths) }])))
  }, [data])

  const set = (c: string, k: keyof Draft[string], v: string) => {
    setDraft((d) => ({ ...d, [c]: { ...d[c], [k]: v } }))
    setErrors((e) => ({ ...e, [`${c}.${k}`]: '' }))
  }

  async function save() {
    setBusy(true)
    setErrors({})
    try {
      await api('/costs', { method: 'PUT', body: { rows: Object.entries(draft).map(([component, v]) => ({ component, ...v })) } })
      toast('Cost assumptions saved. Predictions updated.')
      reload()
    } catch (e) {
      if (e instanceof ApiError) {
        const mapped: Record<string, string> = {}
        for (const [k, msg] of Object.entries(e.fields ?? {})) {
          // Field paths look like rows.3.repairCost
          const m = k.match(/^rows\.(\d+)\.(\w+)$/)
          if (m && data) mapped[`${Object.keys(draft)[Number(m[1])]}.${m[2]}`] = msg
        }
        setErrors(mapped)
        toast(Object.keys(mapped).length ? 'Some values need attention.' : e.message, 'error')
      } else toast('Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section>
        <h2 className="font-display text-2xl font-semibold">Cost assumptions and service intervals</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-3">
          Repair and preventive costs feed the savings estimate. Without them no figure is shown. Leave an interval empty to use the default. Changing a value recalculates all predictions.
        </p>

        <div className="mt-5">
          {loading && !data ? (
            <LoadingRows rows={10} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <div className="overflow-x-auto bg-white">
              <table className="num w-full min-w-[52rem] text-sm">
                <thead className="border-b border-line text-left text-ink-3">
                  <tr>
                    <th className="px-4 py-3 font-medium">Component</th>
                    <th className="px-3 py-3 text-right font-medium">Repair cost (€)</th>
                    <th className="px-3 py-3 text-right font-medium">Preventive cost (€)</th>
                    <th className="px-3 py-3 text-right font-medium">Interval (km)</th>
                    <th className="px-3 py-3 pr-4 text-right font-medium">Interval (months)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data?.map((r) => (
                    <tr key={r.component}>
                      <th scope="row" className="px-4 py-2 text-left text-[15px] font-medium">{r.label}</th>
                      {(['repairCost', 'preventiveCost', 'intervalKm', 'intervalMonths'] as const).map((k) => {
                        const ph = k === 'intervalKm' ? (r.defaultIntervalKm == null ? 'none' : r.defaultIntervalKm.toLocaleString('en-GB')) : k === 'intervalMonths' ? String(r.defaultIntervalMonths ?? 'none') : ''
                        const err = errors[`${r.component}.${k}`]
                        return (
                          <td key={k} className="px-3 py-3 last:pr-4">
                            <input
                              aria-label={`${r.label} ${k}`}
                              inputMode="decimal"
                              disabled={!canWrite}
                              value={draft[r.component]?.[k] ?? ''}
                              placeholder={ph}
                              onChange={(e) => set(r.component, k, e.target.value)}
                              aria-invalid={!!err}
                              className={`${cell} ${err ? 'border-critical' : 'border-line'}`}
                            />
                            {err && <span className="mt-0.5 block text-right text-xs text-critical">{err}</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {canWrite ? (
          <div className="mt-4"><Button variant="primary" loading={busy} onClick={save}>Save assumptions</Button></div>
        ) : (
          <p className="mt-4 text-sm text-ink-3">Only owners and managers can change these values.</p>
        )}
      </section>
    </div>
  )
}
