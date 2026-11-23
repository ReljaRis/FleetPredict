import type { ErrorRequestHandler, RequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { HttpError } from '../lib/errors.js'
import { fromZod } from '../lib/http.js'
import { isProd } from '../config/env.js'

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Not found.' } })
}

/** One place that turns every failure into a consistent JSON error. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let e: unknown = err
  if (e instanceof ZodError) e = fromZod(e)
  if (e instanceof HttpError) {
    return res.status(e.status).json({ error: { message: e.message, fields: e.fields } })
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return res.status(409).json({ error: { message: 'That value is already in use.' } })
  }
  if (typeof e === 'object' && e && (e as { type?: string }).type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'The request body is not valid JSON.' } })
  }
  console.error(e)
  res.status(500).json({ error: { message: isProd ? 'Something went wrong on our side.' : String((e as Error)?.message ?? e) } })
}
