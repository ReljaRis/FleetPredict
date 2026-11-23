import { Router } from 'express'
import { ctx, requireAuth, requirePermission } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'
import { listQuery, readingInput, readingsQuery, vehicleInput } from './vehicle.schemas.js'
import { addReading, createVehicle, findOwned, listVehicles, readingsWithSummary, serialize, setArchived, updateVehicle } from './vehicle.service.js'

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  handler(async (req, res) => {
    res.json(await listVehicles(ctx(req), parse(listQuery, req.query)))
  }),
)

router.post(
  '/',
  requirePermission('vehicle:write'),
  handler(async (req, res) => {
    const v = await createVehicle(ctx(req), parse(vehicleInput, req.body))
    res.status(201).json(serialize(v))
  }),
)

router.get(
  '/:id',
  handler(async (req, res) => {
    const a = ctx(req)
    const v = await findOwned(a, String(req.params.id))
    const driver = v.driverId ? await prisma.user.findFirst({ where: { id: v.driverId, companyId: a.companyId }, select: { id: true, name: true } }) : null
    res.json({ ...serialize(v), driver })
  }),
)

router.put(
  '/:id',
  requirePermission('vehicle:write'),
  handler(async (req, res) => {
    const v = await updateVehicle(ctx(req), String(req.params.id), parse(vehicleInput, req.body))
    res.json(serialize(v))
  }),
)

// Vehicles are archived, not erased: their service history stays available.
router.post(
  '/:id/archive',
  requirePermission('vehicle:delete'),
  handler(async (req, res) => {
    res.json(serialize(await setArchived(ctx(req), String(req.params.id), true)))
  }),
)
router.post(
  '/:id/restore',
  requirePermission('vehicle:delete'),
  handler(async (req, res) => {
    res.json(serialize(await setArchived(ctx(req), String(req.params.id), false)))
  }),
)

router.get(
  '/:id/readings',
  handler(async (req, res) => {
    const { from, to } = parse(readingsQuery, req.query)
    res.json(await readingsWithSummary(ctx(req), String(req.params.id), from, to))
  }),
)

router.post(
  '/:id/readings',
  requirePermission('reading:write'),
  handler(async (req, res) => {
    res.status(201).json(await addReading(ctx(req), String(req.params.id), parse(readingInput, req.body)))
  }),
)

export default router
