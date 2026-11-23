import type { RequestHandler } from 'express'
import { refreshPredictions } from '../modules/engine/engine.service.js'

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const AFFECTS_PREDICTIONS = /^\/(vehicles|maintenance|faults|trips|costs)(\/|$)/

/**
 * After a successful write that can change a prediction input (vehicle, readings, service, fault, trip, cost
 * assumptions) the company's predictions are recalculated before the response is sent. The client's next read
 * therefore always sees up-to-date scores. A failed recalculation is logged and does not fail the write.
 */
export const refreshAfterWrite: RequestHandler = (req, res, next) => {
  if (!WRITES.has(req.method) || !AFFECTS_PREDICTIONS.test(req.path)) return next()
  const json = res.json.bind(res)
  const end = res.end.bind(res) as (...a: unknown[]) => typeof res
  let started = false

  const defer = (send: () => void) => {
    started = true
    if (res.statusCode >= 400 || !req.auth) return send()
    refreshPredictions(req.auth.companyId)
      .catch((e) => console.error('Prediction refresh failed:', e))
      .finally(send)
  }

  res.json = ((body: unknown) => {
    defer(() => json(body))
    return res
  }) as typeof res.json
  res.end = ((...args: unknown[]) => {
    if (started) return end(...args)
    defer(() => end(...args))
    return res
  }) as typeof res.end
  next()
}
