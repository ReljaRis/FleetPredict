import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { handler, parse } from '../../lib/http.js'
import { prisma } from '../../lib/prisma.js'

/**
 * Read-only access to the truck reference catalogue (makes, models, generations, engines).
 * The catalogue lives in the "public" schema and is shared by all companies, so it holds no
 * company data. Vehicles copy the chosen values as plain text and never reference it by key.
 */
const router = Router()
router.use(requireAuth)

const id = z.coerce.number().int().positive()

router.get(
  '/makes',
  handler(async (_req, res) => {
    const rows = await prisma.$queryRaw<{ id: bigint; name: string }[]>`select id, name from public.makes order by name`
    res.json(rows.map((r) => ({ id: Number(r.id), name: r.name })))
  }),
)

router.get(
  '/makes/:id/models',
  handler(async (req, res) => {
    const makeId = parse(id, req.params.id)
    const rows = await prisma.$queryRaw<{ id: bigint; name: string }[]>`
      select id, name from public.models where make_id = ${makeId} order by name`
    res.json(rows.map((r) => ({ id: Number(r.id), name: r.name })))
  }),
)

router.get(
  '/models/:id/generations',
  handler(async (req, res) => {
    const modelId = parse(id, req.params.id)
    const rows = await prisma.$queryRaw<{ id: bigint; name: string; year_from: number | null; year_to: number | null; emission_standard: string | null }[]>`
      select id, name, year_from, year_to, emission_standard from public.generations
      where model_id = ${modelId} order by year_from desc nulls last`
    res.json(rows.map((r) => ({ id: Number(r.id), name: r.name, yearFrom: r.year_from, yearTo: r.year_to, emission: r.emission_standard })))
  }),
)

router.get(
  '/generations/:id/engines',
  handler(async (req, res) => {
    const generationId = parse(id, req.params.id)
    const rows = await prisma.$queryRaw<{ family: string | null; code: string | null; displacement_l: string | null; cylinders: number | null; power_kw: number | null; emission_standard: string | null }[]>`
      select distinct e.family, e.code, e.displacement_l, e.cylinders, e.power_kw, e.emission_standard
      from public.generation_engines ge join public.engines e on e.id = ge.engine_id
      where ge.generation_id = ${generationId}
      order by e.power_kw nulls last, e.code`
    res.json(
      rows.map((r) => ({
        family: r.family,
        code: r.code,
        displacementL: r.displacement_l === null ? null : Number(r.displacement_l),
        cylinders: r.cylinders,
        powerKw: r.power_kw,
        emission: r.emission_standard,
      })),
    )
  }),
)

export default router
