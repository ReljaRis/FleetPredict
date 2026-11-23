import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { dateOnly, isoDay, text } from '../../lib/validation.js'
import { findOwned, scope } from '../vehicles/vehicle.service.js'
import { daysLeft, docStatus } from './status.js'
import { generateDocumentNotifications } from '../notifications/notifications.service.js'

export const DOC_TYPES = ['Vehicle registration', 'Insurance', 'ADR certificate', 'CEMT permit', 'Tachograph inspection', 'Technical inspection', 'Other'] as const

const input = z.object({
  vehicleId: z.string().min(1, 'Choose a vehicle.'),
  type: z.enum(DOC_TYPES, { error: 'Choose a document type.' }),
  number: text(80).min(1, 'Enter the document number.'),
  issueDate: dateOnly('Issue date'),
  expiryDate: dateOnly('Expiry date'),
  fileName: text(200).nullable().optional().transform((v) => v || null),
  notes: text(2000).default(''),
})

const listQuery = z.object({
  vehicleId: z.string().optional(),
  type: z.enum(DOC_TYPES).optional(),
  status: z.enum(['GREEN', 'YELLOW', 'RED', 'EXPIRED']).optional(),
  q: z.string().trim().max(80).optional(),
})

const include = { vehicle: { select: { fleetId: true, registration: true, manufacturer: true, model: true } } } as const

function ser(d: Prisma.DocumentGetPayload<{ include: typeof include }>) {
  return { ...d, issueDate: isoDay(d.issueDate), expiryDate: isoDay(d.expiryDate), status: docStatus(d.expiryDate), daysLeft: daysLeft(d.expiryDate) }
}

function check(i: z.infer<typeof input>) {
  if (i.expiryDate <= i.issueDate) throw badRequest('Some fields need attention.', { expiryDate: 'The expiry date must be after the issue date.' })
}

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  handler(async (req, res) => {
    const a = ctx(req)
    const q = parse(listQuery, req.query)
    const w: Prisma.DocumentWhereInput = { companyId: a.companyId, vehicle: { is: { ...scope(a), archived: false } } }
    if (q.vehicleId) w.vehicleId = q.vehicleId
    if (q.type) w.type = q.type
    if (q.q) w.OR = [{ number: { contains: q.q, mode: 'insensitive' } }, { notes: { contains: q.q, mode: 'insensitive' } }, { type: { contains: q.q, mode: 'insensitive' } }, { vehicle: { is: { fleetId: { contains: q.q, mode: 'insensitive' } } } }, { vehicle: { is: { registration: { contains: q.q, mode: 'insensitive' } } } }]
    // Status is derived from the expiry date and the current day, so it is filtered after loading.
    let rows = (await prisma.document.findMany({ where: w, include, orderBy: { expiryDate: 'asc' } })).map(ser)
    if (q.status) rows = rows.filter((d) => d.status === q.status)
    res.json(rows)
  }),
)

router.post(
  '/',
  requirePermission('document:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const i = parse(input, req.body)
    await findOwned(a, i.vehicleId)
    check(i)
    const created = await prisma.document.create({ data: { companyId: a.companyId, ...i }, include })
    await generateDocumentNotifications(a.companyId).catch((e) => console.error(e))
    res.status(201).json(ser(created))
  }),
)

router.put(
  '/:id',
  requirePermission('document:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    if (!(await prisma.document.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } }))) throw notFound()
    const i = parse(input, req.body)
    await findOwned(a, i.vehicleId)
    check(i)
    const updated = await prisma.document.update({ where: { id }, data: i, include })
    await generateDocumentNotifications(a.companyId).catch((e) => console.error(e))
    res.json(ser(updated))
  }),
)

router.delete(
  '/:id',
  requirePermission('document:write'),
  handler(async (req, res) => {
    const a = ctx(req)
    const id = String(req.params.id)
    if (!(await prisma.document.findFirst({ where: { id, companyId: a.companyId, vehicle: { is: scope(a) } } }))) throw notFound()
    await prisma.document.delete({ where: { id } })
    res.status(204).end()
  }),
)

export default router
