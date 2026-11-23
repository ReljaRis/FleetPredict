import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodError, type ZodTypeAny, type z } from 'zod'
import { badRequest } from './errors.js'

/** Wrap an async handler so rejected promises reach the central error handler. */
export const handler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next)
  }

/** Parse and validate request data, turning zod issues into field-level 422 errors. */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data)
  if (r.success) return r.data
  throw fromZod(r.error)
}

export function fromZod(e: ZodError) {
  const fields: Record<string, string> = {}
  for (const i of e.issues) {
    const key = i.path.join('.') || '_'
    if (!fields[key]) fields[key] = i.message
  }
  return badRequest('Some fields need attention.', fields)
}
