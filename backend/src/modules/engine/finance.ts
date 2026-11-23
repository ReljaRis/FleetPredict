export interface Estimate {
  available: boolean
  /** Why no figure is shown. Present only when available is false. */
  reason?: string
  repairCost: number | null
  preventiveCost: number | null
  /** Score divided by 100. A weighting taken from the priority score, not a probability of failure. */
  riskFactor: number
  avoidedRepair: number | null
  savings: number | null
}

/**
 * Transparent estimate: expected avoided repair = repair cost x risk factor,
 * potential savings = expected avoided repair - preventive cost.
 * Nothing is estimated when either cost is missing.
 */
export function estimate(score: number, repairCost: number | null, preventiveCost: number | null): Estimate {
  const riskFactor = Math.round(score) / 100
  const missing: string[] = []
  if (repairCost == null) missing.push('the expected repair cost')
  if (preventiveCost == null) missing.push('the preventive maintenance cost')
  if (missing.length) {
    return { available: false, reason: `No estimate: ${missing.join(' and ')} ${missing.length > 1 ? 'have' : 'has'} not been entered for this component.`, repairCost, preventiveCost, riskFactor, avoidedRepair: null, savings: null }
  }
  const avoidedRepair = Math.round(repairCost! * riskFactor * 100) / 100
  return { available: true, repairCost, preventiveCost, riskFactor, avoidedRepair, savings: Math.round((avoidedRepair - preventiveCost!) * 100) / 100 }
}
