import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, type Prisma } from '@prisma/client'
import { seedHistory, type SeedVehicle } from './seed-history'
import { refreshPredictions } from '../src/modules/engine/engine.service'
import { runForCompany } from '../src/modules/notifications/notifications.service'

/**
 * Demo company. Everything here is fictional and the company is flagged isDemo so the app labels it DEMO DATA.
 * Re-running replaces the demo company; real companies are never touched.
 * Dates are relative to the day the seed runs so the demo never looks stale.
 */
const prisma = new PrismaClient()
export const DEMO_EMAIL = 'ivana.maric@savica-demo.hr'
export const DEMO_PASSWORD = 'demo1234'
const DAY = 86_400_000

// Deterministic pseudo-random numbers so a re-seed produces the same fleet.
let s = 20260617
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const between = (a: number, b: number) => a + rnd() * (b - a)

type Row = {
  id: string; make: string; model: string; variant: string; year: number; cat: string; engine: string; kw: number; l: number
  status: Prisma.VehicleCreateManyInput['status']; km: number; h: number; daily: number; hrs: number
  load: boolean; terrain: boolean; haul: boolean; urban: boolean; loc: string; driver: string; price: number; body: string; payload: number
}

const FLEET: Row[] = [
  { id: '#101', make: 'Volvo', model: 'FH', variant: '460', year: 2019, cat: 'Tractor unit', engine: 'D13K 12.8 L inline-6 diesel, Euro 6', kw: 338, l: 12.8, status: 'OPERATIONAL', km: 612400, h: 13900, daily: 480, hrs: 7.2, load: false, terrain: false, haul: true, urban: false, loc: 'Zagreb depot, HR', driver: 'Marko Jurić', price: 112000, body: 'Curtainsider semi', payload: 26500 },
  { id: '#102', make: 'Scania', model: 'R', variant: '450', year: 2021, cat: 'Tractor unit', engine: 'DC13 12.7 L inline-6 diesel, Euro 6', kw: 331, l: 12.7, status: 'OPERATIONAL', km: 398100, h: 8700, daily: 520, hrs: 7.8, load: false, terrain: false, haul: true, urban: false, loc: 'Trieste, IT', driver: 'Ivo Babić', price: 118000, body: 'Reefer semi', payload: 25000 },
  { id: '#103', make: 'DAF', model: 'XF', variant: '480', year: 2018, cat: 'Tractor unit', engine: 'MX-13 12.9 L inline-6 diesel, Euro 6', kw: 355, l: 12.9, status: 'IN_SERVICE', km: 744800, h: 16800, daily: 450, hrs: 7.0, load: true, terrain: false, haul: true, urban: false, loc: 'Savica workshop, Zagreb', driver: 'Tomislav Katić', price: 105000, body: 'Box semi', payload: 25500 },
  { id: '#104', make: 'Mercedes-Benz', model: 'Actros', variant: '1845', year: 2020, cat: 'Tractor unit', engine: 'OM 471 12.8 L inline-6 diesel, Euro 6', kw: 330, l: 12.8, status: 'OPERATIONAL', km: 485200, h: 11200, daily: 210, hrs: 4.8, load: true, terrain: true, haul: false, urban: false, loc: 'Zagreb depot, HR', driver: 'Ante Perić', price: 121000, body: 'Low-loader semi', payload: 27500 },
  { id: '#105', make: 'MAN', model: 'TGX', variant: '18.510', year: 2022, cat: 'Tractor unit', engine: 'D2676 12.4 L inline-6 diesel, Euro 6', kw: 375, l: 12.4, status: 'OPERATIONAL', km: 287300, h: 6300, daily: 510, hrs: 7.5, load: false, terrain: false, haul: true, urban: false, loc: 'Maribor, SI', driver: 'Luka Vidović', price: 124000, body: 'Curtainsider semi', payload: 26000 },
  { id: '#106', make: 'Iveco', model: 'S-Way', variant: 'AS440S48', year: 2021, cat: 'Tractor unit', engine: 'Cursor 13 12.9 L inline-6 diesel, Euro 6', kw: 353, l: 12.9, status: 'OPERATIONAL', km: 352600, h: 7900, daily: 470, hrs: 7.1, load: false, terrain: false, haul: true, urban: false, loc: 'Zagreb depot, HR', driver: 'Petar Knežević', price: 109000, body: 'Curtainsider semi', payload: 25500 },
  { id: '#107', make: 'Renault', model: 'T', variant: '480', year: 2017, cat: 'Tractor unit', engine: 'DTI 13 12.8 L inline-6 diesel, Euro 6', kw: 353, l: 12.8, status: 'HIGH_RISK', km: 861900, h: 19400, daily: 430, hrs: 7.0, load: true, terrain: false, haul: true, urban: false, loc: 'Split, HR', driver: 'Josip Tomić', price: 98000, body: 'Box semi', payload: 25000 },
  { id: '#108', make: 'Volvo', model: 'FM', variant: '420', year: 2020, cat: 'Rigid 6x2', engine: 'D11K 10.8 L inline-6 diesel, Euro 6', kw: 309, l: 10.8, status: 'OPERATIONAL', km: 301500, h: 7400, daily: 260, hrs: 6.0, load: true, terrain: false, haul: false, urban: true, loc: 'Zagreb depot, HR', driver: 'Nikola Šimić', price: 96000, body: 'Tipper body', payload: 16500 },
  { id: '#109', make: 'Scania', model: 'G', variant: '410', year: 2019, cat: 'Rigid 6x4', engine: 'DC13 12.7 L inline-6 diesel, Euro 6', kw: 302, l: 12.7, status: 'OPERATIONAL', km: 418700, h: 10200, daily: 240, hrs: 6.4, load: true, terrain: true, haul: false, urban: false, loc: 'Šibenik quarry, HR', driver: 'Davor Matić', price: 104000, body: 'Tipper body', payload: 19500 },
  { id: '#110', make: 'MAN', model: 'TGS', variant: '26.470', year: 2018, cat: 'Rigid 6x4', engine: 'D2676 12.4 L inline-6 diesel, Euro 6', kw: 346, l: 12.4, status: 'OPERATIONAL', km: 506300, h: 12600, daily: 230, hrs: 6.6, load: true, terrain: true, haul: false, urban: false, loc: 'Šibenik quarry, HR', driver: 'Goran Perković', price: 99000, body: 'Tipper body', payload: 19000 },
  { id: '#111', make: 'DAF', model: 'CF', variant: '440', year: 2022, cat: 'Rigid 6x2', engine: 'MX-11 10.8 L inline-6 diesel, Euro 6', kw: 324, l: 10.8, status: 'OPERATIONAL', km: 214800, h: 5100, daily: 300, hrs: 6.2, load: false, terrain: false, haul: false, urban: true, loc: 'Zagreb depot, HR', driver: 'Mario Lukić', price: 91000, body: 'Curtainsider body', payload: 15500 },
  { id: '#112', make: 'Mercedes-Benz', model: 'Actros', variant: '1851', year: 2016, cat: 'Tractor unit', engine: 'OM 471 12.8 L inline-6 diesel, Euro 6', kw: 370, l: 12.8, status: 'IN_SERVICE', km: 934600, h: 21300, daily: 420, hrs: 7.0, load: true, terrain: false, haul: true, urban: false, loc: 'Savica workshop, Zagreb', driver: 'Branko Župan', price: 94000, body: 'Box semi', payload: 25000 },
  { id: '#113', make: 'Volvo', model: 'FH', variant: '500', year: 2023, cat: 'Tractor unit', engine: 'D13K 12.8 L inline-6 diesel, Euro 6', kw: 368, l: 12.8, status: 'OPERATIONAL', km: 168900, h: 3700, daily: 540, hrs: 8.0, load: false, terrain: false, haul: true, urban: false, loc: 'Vienna, AT', driver: 'Filip Horvat', price: 138000, body: 'Reefer semi', payload: 25000 },
  { id: '#114', make: 'Scania', model: 'S', variant: '500', year: 2022, cat: 'Tractor unit', engine: 'DC13 12.7 L inline-6 diesel, Euro 6', kw: 368, l: 12.7, status: 'OPERATIONAL', km: 276400, h: 6100, daily: 530, hrs: 7.9, load: false, terrain: false, haul: true, urban: false, loc: 'Zagreb depot, HR', driver: 'Dario Mikulić', price: 141000, body: 'Curtainsider semi', payload: 26000 },
  { id: '#115', make: 'MAN', model: 'TGX', variant: '18.470', year: 2017, cat: 'Tractor unit', engine: 'D2066 10.5 L inline-6 diesel, Euro 6', kw: 346, l: 10.5, status: 'OPERATIONAL', km: 798200, h: 18100, daily: 440, hrs: 7.2, load: true, terrain: false, haul: true, urban: false, loc: 'Budapest, HU', driver: 'Zvonimir Kovač', price: 96000, body: 'Box semi', payload: 25000 },
  { id: '#116', make: 'Iveco', model: 'Stralis', variant: 'AS440S46', year: 2016, cat: 'Tractor unit', engine: 'Cursor 11 10.3 L inline-6 diesel, Euro 6', kw: 338, l: 10.3, status: 'OUT_OF_SERVICE', km: 988700, h: 22600, daily: 380, hrs: 6.8, load: true, terrain: false, haul: true, urban: false, loc: 'Savica yard, Zagreb', driver: '', price: 88000, body: 'Curtainsider semi', payload: 25000 },
  { id: '#117', make: 'DAF', model: 'XF', variant: '530', year: 2020, cat: 'Tractor unit', engine: 'MX-13 12.9 L inline-6 diesel, Euro 6', kw: 390, l: 12.9, status: 'OPERATIONAL', km: 541700, h: 12100, daily: 500, hrs: 7.6, load: false, terrain: false, haul: true, urban: false, loc: 'Munich, DE', driver: 'Hrvoje Radić', price: 119000, body: 'Reefer semi', payload: 25000 },
  { id: '#118', make: 'Volvo', model: 'FMX', variant: '460', year: 2019, cat: 'Rigid 8x4', engine: 'D13K 12.8 L inline-6 diesel, Euro 6', kw: 338, l: 12.8, status: 'OPERATIONAL', km: 342900, h: 9800, daily: 190, hrs: 6.8, load: true, terrain: true, haul: false, urban: false, loc: 'Knin construction site, HR', driver: 'Stipe Bilić', price: 148000, body: 'Tipper body', payload: 20500 },
  { id: '#119', make: 'Mercedes-Benz', model: 'Actros', variant: '1848', year: 2021, cat: 'Tractor unit', engine: 'OM 471 12.8 L inline-6 diesel, Euro 6', kw: 350, l: 12.8, status: 'OPERATIONAL', km: 379500, h: 8300, daily: 490, hrs: 7.4, load: false, terrain: false, haul: true, urban: false, loc: 'Zagreb depot, HR', driver: 'Kristijan Pavlić', price: 126000, body: 'Curtainsider semi', payload: 26000 },
  { id: '#120', make: 'Renault', model: 'Premium', variant: '430', year: 2015, cat: 'Rigid 4x2', engine: 'DXi 11 10.8 L inline-6 diesel, Euro 5', kw: 316, l: 10.8, status: 'OPERATIONAL', km: 702300, h: 15900, daily: 210, hrs: 5.5, load: false, terrain: false, haul: false, urban: true, loc: 'Zagreb depot, HR', driver: 'Ivica Šarić', price: 71000, body: 'Box body', payload: 11500 },
  { id: '#121', make: 'MAN', model: 'TGS', variant: '18.360', year: 2020, cat: 'Rigid 4x2', engine: 'D2066 10.5 L inline-6 diesel, Euro 6', kw: 265, l: 10.5, status: 'OPERATIONAL', km: 251700, h: 6200, daily: 220, hrs: 5.8, load: false, terrain: false, haul: false, urban: true, loc: 'Zagreb depot, HR', driver: 'Robert Blažević', price: 82000, body: 'Curtainsider body', payload: 10500 },
  { id: '#122', make: 'Scania', model: 'P', variant: '280', year: 2019, cat: 'Light truck', engine: 'DC09 9.3 L inline-5 diesel, Euro 6', kw: 206, l: 9.3, status: 'OPERATIONAL', km: 224600, h: 6800, daily: 140, hrs: 5.2, load: false, terrain: false, haul: false, urban: true, loc: 'Zagreb depot, HR', driver: 'Dalibor Cindrić', price: 78000, body: 'Refuse body', payload: 9500 },
]

const DRIVER_USER = 'Ante Perić'

async function main() {
  // Re-seed: remove only the previous demo company (cascade removes everything it owns).
  await prisma.company.deleteMany({ where: { isDemo: true } })

  const hash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const company = await prisma.company.create({ data: { name: 'Savica Logistika d.o.o.', country: 'Croatia', vatId: 'HR00000000000', isDemo: true } })
  const mk = (name: string, email: string, role: 'OWNER' | 'MANAGER' | 'MECHANIC' | 'DRIVER') =>
    prisma.user.create({ data: { companyId: company.id, name, email, role, passwordHash: hash } })
  await mk('Ivana Marić', DEMO_EMAIL, 'OWNER')
  await mk('Zoran Barišić', 'zoran.barisic@savica-demo.hr', 'MANAGER')
  await mk('Dejan Kos', 'dejan.kos@savica-demo.hr', 'MECHANIC')
  const driver = await mk(DRIVER_USER, 'ante.peric@savica-demo.hr', 'DRIVER')

  const now = Date.now()
  const seeded: SeedVehicle[] = []
  for (const f of FLEET) {
    const purchase = new Date(Date.UTC(f.year, 2 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 27)))
    const v = await prisma.vehicle.create({
      data: {
        companyId: company.id, fleetId: f.id,
        registration: `ZG ${1000 + Math.floor(rnd() * 8999)}-${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}`,
        vin: `WDB${f.year % 100}${Math.floor(1e10 + rnd() * 9e10)}`.slice(0, 17).padEnd(17, '0'),
        manufacturer: f.make, model: f.model, variant: f.variant, year: f.year, category: f.cat, engineType: f.engine, powerKw: f.kw,
        fuelType: 'Diesel', displacementL: f.l, payloadKg: f.payload, bodyType: f.body, km: f.km, engineHours: f.h, avgDailyKm: f.daily, avgDailyHours: f.hrs,
        status: f.status, location: f.loc, purchaseDate: purchase, purchasePrice: f.price,
        driverName: f.driver === DRIVER_USER ? '' : f.driver, driverId: f.driver === DRIVER_USER ? driver.id : null,
        notes: f.id === '#104' ? 'Heavy-haul duty on the Zagreb to Split corridor, frequent climbs with full loads.' : '',
        heavyLoads: f.load, demandingTerrain: f.terrain, longHaul: f.haul, urbanStopGo: f.urban,
      },
    })

    seeded.push({ id: v.id, fleetId: f.id, km: f.km, engineHours: f.h, avgDailyKm: f.daily, avgDailyHours: f.hrs, year: f.year, category: f.cat, heavy: f.load, longHaul: f.haul, driverName: f.driver, location: f.loc })

    // 14 monthly readings ending today, built backwards from the current values so they are monotonic.
    const points = 14
    let km = f.km
    let h = f.h
    const rows: Prisma.VehicleReadingCreateManyInput[] = []
    for (let k = 0; k < points; k++) {
      const at = new Date(now - k * 30.4 * DAY - (k === 0 ? 0 : Math.floor(between(0, 2)) * DAY))
      rows.push({ companyId: company.id, vehicleId: v.id, recordedAt: at, km: Math.round(km), engineHours: Math.round(h), source: 'MANUAL' })
      km -= f.daily * 30.4 * between(0.85, 1.12)
      h -= f.hrs * 30.4 * between(0.85, 1.12)
    }
    await prisma.vehicleReading.createMany({ data: rows })
  }
  // Company cost assumptions (fictional, typical European workshop prices) so financial estimates can be shown.
  const COSTS: Record<string, [number, number, number | null, number | null]> = {
    ENGINE: [9500, 380, null, null], COOLING: [4000, 350, null, null], BRAKES: [2400, 620, null, null], TRANSMISSION: [8200, 450, null, null], CLUTCH: [3600, 520, null, null],
    TURBO: [3300, 400, null, null], SUSPENSION: [1900, 380, null, null], ELECTRICAL: [1500, 220, null, null], FUEL: [2800, 260, null, null], TIRES: [2600, 300, null, null],
  }
  await prisma.componentCost.createMany({ data: Object.entries(COSTS).map(([component, [repairCost, preventiveCost, intervalKm, intervalMonths]]) => ({ companyId: company.id, component: component as never, repairCost, preventiveCost, intervalKm, intervalMonths })) })

  const counts = await seedHistory(prisma, company.id, seeded, rnd)
  console.log(`History: ${counts.maintenance} service records, ${counts.faults} fault reports, ${counts.documents} documents, ${counts.trips} trips.`)
  await refreshPredictions(company.id)
  console.log(`Predictions calculated for ${seeded.length} vehicles.`)
  const notes = await runForCompany(company.id)
  console.log(`Notifications created: ${notes.documents} for documents, ${notes.predictions} for critical predictions (a repeat run creates none).`)
  const again = await runForCompany(company.id)
  console.log(`Repeat run created ${again.documents + again.predictions} (duplicates are prevented).`)
  console.log(`Seeded demo company "${company.name}" with ${FLEET.length} vehicles.`)
  console.log(`Demo sign-in: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
