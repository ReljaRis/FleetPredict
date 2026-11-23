import { env } from '../../config/env.js'
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserMessage, fallback, parseJsonReply, validateAnswer, type PredictionFacts } from './llm.js'
import type { Explanation } from './explain.js'

/**
 * The only place that talks to an LLM provider. The API key is read from the server environment and
 * never reaches the browser. Gemini is the first provider; another one only needs a new `generate`.
 */
// If LLM_MODEL is empty the server asks the provider which models this key can use and picks stable
// "flash" models, newest first, so nobody has to know model names that change over time.
let discovered: string[] | null = null
const TIMEOUT_MS = 15_000
const TOTAL_BUDGET_MS = 45_000
const MAX_MODELS = 5

export class ProviderError extends Error {}

export const llmConfigured = () => Boolean(env.LLM_API_KEY)
export const llmModel = () => env.LLM_MODEL || discovered?.[0] || 'auto'

/**
 * Candidate models, best first, from the provider's own model list: the maintained "-latest" aliases (the provider
 * keeps them pointing at something that works), then numbered stable flash models newest first, then lite ones.
 * Preview, experimental, image, audio and speech models are skipped.
 */
export function pickModels(models: { name: string; supportedGenerationMethods?: string[] }[]): string[] {
  const names = models.filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
  const version = (n: string) => Number(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  const byNewest = (x: string, y: string) => version(y) - version(x) || x.localeCompare(y)
  const aliases = ['gemini-flash-latest', 'gemini-flash-lite-latest'].filter((n) => names.includes(n))
  const stable = names.filter((n) => /^gemini-[\d.]+-flash(-lite)?$/i.test(n))
  const flash = stable.filter((n) => !/lite/.test(n)).sort(byNewest)
  const lite = stable.filter((n) => /lite/.test(n)).sort(byNewest)
  return [...aliases, ...flash, ...lite]
}

export const pickModel = (models: { name: string; supportedGenerationMethods?: string[] }[]) => pickModels(models)[0] ?? null

async function candidateModels(): Promise<string[]> {
  if (env.LLM_MODEL) return [env.LLM_MODEL]
  if (discovered) return discovered
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': env.LLM_API_KEY! } })
  if (!res.ok) throw new ProviderError(res.status === 400 || res.status === 403 ? 'The AI service rejected the API key. Check LLM_API_KEY.' : `Could not list AI models (${res.status}).`)
  const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
  const list = pickModels(body.models ?? []).slice(0, MAX_MODELS)
  if (!list.length) throw new ProviderError('No suitable AI model was found for this key. Set LLM_MODEL.')
  discovered = list
  console.log(`AI models selected automatically: ${list.join(', ')}`)
  return list
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One request to one model. Returns the text, or a ProviderError carrying the HTTP status when relevant. */
async function callModel(model: string, system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.LLM_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
    })
    if (!res.ok) {
      // Never log the key or the prompt. The status is enough to diagnose quota, key and model-name problems.
      throw new HttpStatusError(res.status, res.status === 429 ? 'The AI service is rate limited right now. Try again in a minute.' : res.status === 404 ? `The AI model "${model}" was not found. Check LLM_MODEL.` : res.status === 400 || res.status === 403 ? 'The AI service rejected the request. Check LLM_API_KEY and LLM_MODEL.' : res.status >= 500 ? 'The AI service is busy right now. Try again in a moment.' : `The AI service returned an error (${res.status}).`)
    }
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; promptFeedback?: { blockReason?: string } }
    if (body.promptFeedback?.blockReason) throw new ProviderError('The AI service blocked this request.')
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw new ProviderError('The AI service returned an empty answer.')
    return text
  } catch (e) {
    if (e instanceof ProviderError) throw e
    if ((e as Error).name === 'AbortError') throw new ProviderError('The AI service took too long to answer.')
    throw new ProviderError('The AI service could not be reached.')
  } finally {
    clearTimeout(timer)
  }
}

class HttpStatusError extends ProviderError {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/**
 * Tries the candidate models in order. A busy service (5xx) is retried once after a short pause and then
 * the next model is tried. Authentication and quota errors stop immediately because another model would fail the same way.
 */
async function generate(system: string, user: string): Promise<string> {
  const models = await candidateModels()
  let last: ProviderError = new ProviderError('The AI service did not answer.')
  const deadline = Date.now() + TOTAL_BUDGET_MS
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() > deadline) throw new ProviderError('The AI service is too busy right now. Try again in a minute.')
      try {
        return await callModel(model, system, user)
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e
        last = e
        const status = e instanceof HttpStatusError ? e.status : 0
        if (status === 400 || status === 401 || status === 403 || status === 429) throw e
        if (status >= 500) {
          if (attempt === 0) await wait(1500)
          continue
        }
        break // 404, timeouts and similar: go to the next model
      }
    }
  }
  throw last
}

export interface ExplainOutcome {
  explanation: Explanation
  /** Set when the LLM was tried but its answer was not used. */
  note?: string
}

/**
 * Asks the model for an explanation and checks it. On any problem (not configured, provider error,
 * invalid or unsafe answer) the deterministic explanation is returned together with the reason.
 */
export async function explainWithLlm(facts: PredictionFacts): Promise<ExplainOutcome> {
  if (!llmConfigured()) return { explanation: fallback(facts), note: 'The AI explanation layer is not configured, so the rules-based text is shown.' }
  try {
    const text = await generate(SYSTEM_PROMPT, buildUserMessage(facts))
    const checked = validateAnswer(parseJsonReply(text), facts)
    if (checked.ok) return { explanation: checked.value }
    console.warn('LLM answer rejected:', checked.reason)
    return { explanation: fallback(facts), note: `The AI answer was not used because it failed a safety check (${checked.reason}) The rules-based text is shown.` }
  } catch (e) {
    return { explanation: fallback(facts), note: `${e instanceof ProviderError ? e.message : 'The AI explanation failed.'} The rules-based text is shown.` }
  }
}
