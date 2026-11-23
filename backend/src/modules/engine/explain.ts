import { COMPONENTS } from './config.js'
import type { ComponentKey, Factor, RiskCategory } from './types.js'

export interface Explanation {
  summary: string
  inspect: string[]
  urgency: string
  ifIgnored: string
  source: 'RULES' | 'LLM'
}

interface Subject {
  component: ComponentKey
  score: number
  category: RiskCategory
  timeframe: string
  factors: Factor[]
  missing: string[]
}

/**
 * Plain-language explanation built only from the factors the engine produced. It is the fallback
 * whenever the LLM layer is unavailable, so the product never depends on an external service.
 */
export function explainDeterministic(p: Subject): Explanation {
  const c = COMPONENTS[p.component]
  const top = p.factors.slice(0, 3)
  const name = c.label.toLowerCase()
  const reasons = top.map((f) => f.detail).join(' ')

  let summary: string
  if (p.category === 'LOW') {
    summary = top.length ? `The ${name} has a low maintenance priority (${p.score}/100). ${reasons}` : `The ${name} has a low maintenance priority (${p.score}/100). Nothing in the records points to a problem.`
  } else {
    const lead = p.category === 'CRITICAL' ? `The ${name} needs attention first` : p.category === 'HIGH' ? `The ${name} should be inspected soon` : `The ${name} deserves a look at the next service`
    summary = `${lead}, with a priority score of ${p.score} out of 100. ${reasons}`
  }
  if (p.missing.length) summary += ` Limits of this result: ${p.missing[0]}`

  return {
    summary,
    inspect: c.inspect.split(/,\s*(?:and\s+)?|\s+and\s+/).map((s) => s.trim()).filter(Boolean),
    urgency: p.timeframe,
    ifIgnored: p.category === 'LOW' ? 'No particular consequence is expected from the records available.' : c.consequence.replace(/^./, (m) => m),
    source: 'RULES',
  }
}
