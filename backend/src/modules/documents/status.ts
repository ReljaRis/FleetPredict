export type DocStatus = 'GREEN' | 'YELLOW' | 'RED' | 'EXPIRED'

const DAY = 86_400_000

/** Whole days until the end of the expiry day. Negative once the document has expired. */
export function daysLeft(expiry: Date, now: Date = new Date()): number {
  const endOfExpiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate(), 23, 59, 59)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds())
  return Math.floor((endOfExpiryDay - today) / DAY)
}

/**
 * GREEN: more than 30 days left. YELLOW: 8 to 30 days. RED: 7 days or fewer.
 * EXPIRED: the expiry date has passed.
 */
export function docStatus(expiry: Date, now: Date = new Date()): DocStatus {
  const d = daysLeft(expiry, now)
  if (d < 0) return 'EXPIRED'
  if (d <= 7) return 'RED'
  if (d <= 30) return 'YELLOW'
  return 'GREEN'
}

/**
 * The tightest reminder threshold a document has reached, or undefined if none yet.
 * A threshold of 0 means "on expiry" and applies once the expiry date has passed.
 */
export function reachedThreshold(daysRemaining: number, thresholds: number[]): number | undefined {
  return [...thresholds].sort((a, b) => a - b).find((t) => (t === 0 ? daysRemaining < 0 : daysRemaining <= t))
}
