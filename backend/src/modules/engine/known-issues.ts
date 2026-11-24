import { prisma } from '../../lib/prisma.js'
import type { ComponentKey, KnownIssue } from './types.js'

/**
 * Known issues from the reference catalogue (schema "public", read only) for the engines of a fleet.
 * The catalogue describes engine models in general. An entry here means "documented for this engine",
 * never "present on this vehicle". The catalogue stores most issues on one record per engine family
 * (for example "MX-13"), while vehicles point at a power variant ("MX-13 355"), so issues of every
 * engine of the same family count.
 */

/** Catalogue component keys mapped to the ten components the application scores. */
export const CATALOG_COMPONENT: Record<string, ComponentKey> = {
  turbocharger: 'TURBO',
  fuel_injectors: 'FUEL',
  high_pressure_fuel_pump: 'FUEL',
  cooling_system: 'COOLING',
  egr: 'ENGINE',
  dpf: 'ENGINE',
  scr_adblue: 'ENGINE',
  crankshaft: 'ENGINE',
  pistons_rings: 'ENGINE',
  camshaft_timing: 'ENGINE',
  oil_pump: 'ENGINE',
  engine_sensors: 'ENGINE',
}

/** Engine-level catalogue issues carry no component, so the component is read from the title. */
export function componentFromTitle(title: string): ComponentKey {
  if (/\begr\b/i.test(title)) return 'ENGINE'
  if (/turbo/i.test(title)) return 'TURBO'
  if (/injector|fuel/i.test(title)) return 'FUEL'
  if (/cooling|coolant|radiator|water pump/i.test(title)) return 'COOLING'
  return 'ENGINE'
}

export type KnownIssuesByEngine = Map<string, Map<ComponentKey, KnownIssue[]>>

const clip = (s: string | null, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 3) + '...' : t
}

/** Pure part, used by the loader and by tests: groups rows by engine and component and drops repeated titles. */
export function groupIssues(rows: { code: string; component: ComponentKey; id: string; title: string; description: string | null }[]): KnownIssuesByEngine {
  const out: KnownIssuesByEngine = new Map()
  for (const r of rows) {
    const byComp = out.get(r.code) ?? new Map<ComponentKey, KnownIssue[]>()
    const list = byComp.get(r.component) ?? []
    if (!list.some((i) => i.title.toLowerCase() === r.title.toLowerCase())) list.push({ id: r.id, title: r.title, description: clip(r.description, 220), engineCode: r.code })
    byComp.set(r.component, list)
    out.set(r.code, byComp)
  }
  return out
}

export async function loadKnownIssues(engineCodes: string[]): Promise<KnownIssuesByEngine> {
  const codes = [...new Set(engineCodes.filter(Boolean))]
  if (!codes.length) return new Map()
  const [engineRows, partRows] = await Promise.all([
    prisma.$queryRaw<{ code: string; id: string; title: string; description: string | null }[]>`
      select r.code, 'engine:' || i.id::text as id, i.title, i.description
      from public.engines r
      join public.engines e on e.family = r.family
      join public.common_engine_issues i on i.engine_id = e.id
      where r.code = any(${codes}::text[]) order by i.id`,
    // Links the catalogue marked as rejected are ignored. "candidate" links are used: nearly all of them are still candidates.
    prisma.$queryRaw<{ code: string; component_key: string; id: string; title: string; description: string | null }[]>`
      select r.code, c.key as component_key, 'part:' || i.id::text as id, i.title, i.description
      from public.engines r
      join public.engines e on e.family = r.family
      join public.engine_components ec on ec.engine_id = e.id and ec.verification_status <> 'rejected'
      join public.components c on c.id = ec.component_id
      join public.parts p on p.engine_component_id = ec.id
      join public.common_part_issues i on i.part_id = p.id
      where r.code = any(${codes}::text[]) order by i.id`,
  ])
  return groupIssues([
    ...engineRows.map((r) => ({ code: r.code, component: componentFromTitle(r.title), id: r.id, title: r.title, description: r.description })),
    ...partRows.flatMap((r) => (CATALOG_COMPONENT[r.component_key] ? [{ code: r.code, component: CATALOG_COMPONENT[r.component_key], id: r.id, title: r.title, description: r.description }] : [])),
  ])
}

export async function knownIssuesFor(engineCode: string | null | undefined, component: ComponentKey): Promise<KnownIssue[]> {
  if (!engineCode) return []
  return (await loadKnownIssues([engineCode])).get(engineCode)?.get(component) ?? []
}
