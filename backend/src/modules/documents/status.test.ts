import { describe, expect, it } from 'vitest'
import { daysLeft, docStatus, reachedThreshold } from './status.js'

// Fixed "now" at local noon so the cases do not depend on when the tests run.
const now = new Date(2026, 5, 15, 12, 0, 0)
const expiry = (daysFromToday: number) => {
  const d = new Date(Date.UTC(2026, 5, 15 + daysFromToday))
  return d
}

describe('docStatus thresholds', () => {
  it('is GREEN with more than 30 days left', () => {
    expect(docStatus(expiry(31), now)).toBe('GREEN')
    expect(docStatus(expiry(300), now)).toBe('GREEN')
  })
  it('is YELLOW from 30 down to 8 days', () => {
    expect(docStatus(expiry(30), now)).toBe('YELLOW')
    expect(docStatus(expiry(8), now)).toBe('YELLOW')
  })
  it('is RED at 7 days or fewer, including the expiry day itself', () => {
    expect(docStatus(expiry(7), now)).toBe('RED')
    expect(docStatus(expiry(1), now)).toBe('RED')
    expect(docStatus(expiry(0), now)).toBe('RED')
  })
  it('is EXPIRED the day after the expiry date', () => {
    expect(docStatus(expiry(-1), now)).toBe('EXPIRED')
    expect(docStatus(expiry(-90), now)).toBe('EXPIRED')
  })
})

describe('daysLeft', () => {
  it('counts whole days to the end of the expiry day', () => {
    expect(daysLeft(expiry(10), now)).toBe(10)
    expect(daysLeft(expiry(0), now)).toBe(0)
    expect(daysLeft(expiry(-3), now)).toBe(-3)
  })
})

describe('reminder thresholds (30, 14, 7 and on expiry)', () => {
  const T = [30, 14, 7, 0]
  it('sends nothing while more than 30 days remain', () => {
    expect(reachedThreshold(45, T)).toBeUndefined()
    expect(reachedThreshold(31, T)).toBeUndefined()
  })
  it('picks the tightest threshold reached', () => {
    expect(reachedThreshold(30, T)).toBe(30)
    expect(reachedThreshold(20, T)).toBe(30)
    expect(reachedThreshold(14, T)).toBe(14)
    expect(reachedThreshold(8, T)).toBe(14)
    expect(reachedThreshold(7, T)).toBe(7)
    expect(reachedThreshold(0, T)).toBe(7)
  })
  it('uses the on-expiry threshold only after the expiry date has passed', () => {
    expect(reachedThreshold(-1, T)).toBe(0)
    expect(reachedThreshold(-40, T)).toBe(0)
  })
  it('respects a custom list and returns nothing for an empty one', () => {
    expect(reachedThreshold(50, [60, 3])).toBe(60)
    expect(reachedThreshold(2, [60, 3])).toBe(3)
    expect(reachedThreshold(5, [])).toBeUndefined()
  })
  it('gives a stable key per document and threshold, so a repeat run creates nothing new', () => {
    const key = (id: string, hit: number) => `doc:${id}:${hit}:2026-12-05`
    const sent = new Set([key('d1', 7)])
    expect(sent.has(key('d1', reachedThreshold(5, T)!))).toBe(true)
    expect(sent.has(key('d1', reachedThreshold(-2, T)!))).toBe(false)
  })
})
