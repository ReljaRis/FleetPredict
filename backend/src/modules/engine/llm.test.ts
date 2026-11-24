import { describe, expect, it } from 'vitest'
import { pickModels } from './llm.provider.js'
import { allowedNumbers, buildUserMessage, fallback, parseJsonReply, validateAnswer, type PredictionFacts } from './llm.js'

const facts: PredictionFacts = {
  vehicle: { fleetId: '#104', make: 'Mercedes-Benz', model: 'Actros', variant: '1845', year: 2020, km: 485200, engineHours: 11200 },
  component: 'COOLING',
  componentLabel: 'Cooling system',
  score: 75,
  category: 'CRITICAL',
  timeframe: 'Before the next trip',
  factors: [
    { label: 'Open fault report (high)', detail: 'Open since 2026-11-17 at 483,800 km: coolant temperature climbed to 104 °C under a 38 t load.', points: 32 },
    { label: 'Service interval exceeded', detail: 'Last cooling system work was 90,000 km ago, against a 80,000 km interval (113% used).', points: 20 },
  ],
  missing: [],
}

const good = {
  summary: 'The cooling system is the first thing to look at. A coolant temperature of 104 °C was reported under a 38 t load, and the last cooling work was 90,000 km ago, beyond the 80,000 km interval.',
  inspect: ['Radiator', 'Water pump', 'Thermostat', 'Coolant circulation'],
  urgency: 'Inspect before the next trip.',
  ifIgnored: 'Continued overheating may damage the engine and lead to a costly repair.',
}

describe('LLM answer validation', () => {
  it('accepts an answer that only uses facts from the input', () => {
    const r = validateAnswer(good, facts)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.source).toBe('LLM')
  })
  it('accepts numbers written with thousands separators', () => {
    expect(validateAnswer({ ...good, summary: good.summary.replace('90,000', '90000') }, facts).ok).toBe(true)
  })
  it('rejects invented numbers such as a made-up mileage or cost', () => {
    const r = validateAnswer({ ...good, summary: good.summary + ' A repair would cost about 7,500 euros.' }, facts)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('7500')
  })
  it('rejects an answer that tries to change the score', () => {
    const r = validateAnswer({ ...good, score: 91 }, facts)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/score/)
  })
  it('accepts an echoed score only when it matches', () => {
    expect(validateAnswer({ ...good, score: 75 }, facts).ok).toBe(true)
  })
  it('rejects statements of certainty', () => {
    expect(validateAnswer({ ...good, ifIgnored: 'The engine will fail within a week unless you act.' }, facts).ok).toBe(false)
    expect(validateAnswer({ ...good, ifIgnored: 'A breakdown is guaranteed.' }, facts).ok).toBe(false)
  })
  it('rejects links and markup', () => {
    expect(validateAnswer({ ...good, summary: good.summary + ' See https://example.com for details about this.' }, facts).ok).toBe(false)
    expect(validateAnswer({ ...good, urgency: 'Inspect <b>now</b> please.' }, facts).ok).toBe(false)
  })
  it('rejects answers with missing fields', () => {
    expect(validateAnswer({ summary: good.summary }, facts).ok).toBe(false)
    expect(validateAnswer(null, facts).ok).toBe(false)
    expect(validateAnswer('text', facts).ok).toBe(false)
  })
})

describe('helpers', () => {
  it('allowed numbers come from the input plus the 0 to 100 scale', () => {
    const a = allowedNumbers(facts)
    for (const n of ['485200', '11200', '75', '104', '38', '90000', '80000', '113', '2020', '100']) expect(a.has(n)).toBe(true)
    expect(a.has('7500')).toBe(false)
  })
  it('parses JSON even when wrapped in code fences or text', () => {
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonReply('Here you go: {"a":2} done')).toEqual({ a: 2 })
    expect(parseJsonReply('not json')).toBeNull()
  })
  it('marks input as data and never includes company details', () => {
    const m = buildUserMessage(facts)
    expect(m.startsWith('INPUT_START')).toBe(true)
    expect(m.endsWith('INPUT_END')).toBe(true)
  })
  it('the deterministic fallback keeps the score and never claims certainty', () => {
    const f = fallback(facts)
    expect(f.source).toBe('RULES')
    expect(f.summary).toContain('75')
    expect(f.ifIgnored.toLowerCase()).not.toMatch(/will fail|guaranteed/)
  })
})

describe('automatic model choice', () => {
  const m = (name: string, methods = ['generateContent']) => ({ name: 'models/' + name, supportedGenerationMethods: methods })
  it('puts the maintained latest aliases first, then numbered flash newest first, then lite', () => {
    expect(pickModels([m('gemini-2.5-flash'), m('gemini-3.8-flash'), m('gemini-flash-latest'), m('gemini-3.1-flash-lite'), m('gemini-flash-lite-latest'), m('gemini-3.7-flash')])).toEqual([
      'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite',
    ])
  })
  it('skips preview, image, speech, audio and embedding-only models', () => {
    expect(pickModels([m('gemini-3-flash-preview'), m('gemini-2.5-flash-image'), m('gemini-3.8-flash-tts'), m('gemini-omni-1.2-flash'), m('text-embedding', ['embedContent']), m('gemini-2.0-flash')])).toEqual(['gemini-2.0-flash'])
  })
  it('returns an empty list when nothing fits', () => {
    expect(pickModels([m('gemini-2.5-pro')])).toEqual([])
  })
})

describe('known issues in the facts', () => {
  it('allows numbers that come from the documented problems', () => {
    const withIssues = { ...facts, knownIssues: [{ title: 'Recall 0040215', description: 'Issued 2014-08-01.' }] }
    expect(allowedNumbers(withIssues).has("0040215")).toBe(true)
  })
})
