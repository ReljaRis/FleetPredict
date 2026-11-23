import type { ComponentKey, FaultStatus, MaintenanceCategory, Prisma, PrismaClient, Severity } from '@prisma/client'

/**
 * Fictional but realistic maintenance, fault, document and trip history for the demo fleet.
 * Every record is generated relative to each vehicle's current odometer, so the story stays consistent
 * (nothing is dated after today and no record has a higher odometer than the vehicle itself).
 */
const DAY = 86_400_000

export interface SeedVehicle {
  id: string
  fleetId: string
  km: number
  engineHours: number
  avgDailyKm: number
  avgDailyHours: number
  year: number
  category: string
  heavy: boolean
  longHaul: boolean
  driverName: string
  location: string
  /** Tank vehicle that needs an ADR certificate. */
  adr?: boolean
}

export type DocOffsets = Record<string, Record<string, number>>
export type Route = [string, string, number, number]

/** Everything that is specific to one company: stories per vehicle, document expiries, route pools, names. */
export interface SeedOptions {
  stories?: Record<string, { events: Ev[]; faults: Fault[] }>
  docOffsets?: DocOffsets
  routes?: Route[]
  quarry?: Route[]
  /** Fleet IDs that always run the quarry pool, besides heavy rigid trucks. */
  quarryFleetIds?: string[]
  countrySuffix?: string
  workshop?: string
  defaultDriver?: string
  tripsPerVehicle?: (v: SeedVehicle) => number
}

export type Ev = {
  kmAgo: number
  category: MaintenanceCategory
  component?: ComponentKey
  description: string
  parts?: string
  labor: number
  partsCost: number
  routine?: boolean
  provider?: string
  notes?: string
}
export type Fault = { kmAgo: number; component: ComponentKey; severity: Severity; status: FaultStatus; symptoms: string; by: string; notes?: string }

const WORKSHOP = 'Savica workshop, Zagreb'

// Hand-written stories that give specific vehicles a believable, explainable history.
const STORIES: Record<string, { events: Ev[]; faults: Fault[] }> = {
  '#104': {
    events: [
      { kmAgo: 18000, category: 'OIL_FILTER', component: 'ENGINE', description: 'Engine oil and filter change, fuel water separator drained', parts: 'Engine oil 10W-40 (40 L), oil filter, air filter insert', labor: 124, partsCost: 368, routine: true, provider: WORKSHOP },
      { kmAgo: 24500, category: 'FUEL', component: 'FUEL', description: 'Main and pre fuel filters replaced, low-pressure circuit bled', parts: 'Main fuel filter, pre filter', labor: 70, partsCost: 133, routine: true, provider: WORKSHOP },
      { kmAgo: 41000, category: 'REGULAR_SERVICE', description: 'Scheduled service: steering, lights, belts, axle oil level, chassis greasing', parts: 'Grease, cabin air filter, wiper blades', labor: 295, partsCost: 160, routine: true, provider: WORKSHOP },
      { kmAgo: 52000, category: 'BRAKES', component: 'BRAKES', description: 'Front and rear brake pads replaced, discs measured within limits', parts: 'Brake pad set x2 axles', labor: 440, partsCost: 920, routine: true, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 63000, category: 'OIL_FILTER', component: 'ENGINE', description: 'Engine oil and filter change', parts: 'Engine oil 10W-40 (40 L), oil filter', labor: 110, partsCost: 300, routine: true, provider: WORKSHOP },
      { kmAgo: 78000, category: 'TIRES', component: 'TIRES', description: 'Drive axle tyres replaced and wheels balanced', parts: '4 x 315/70 R22.5 drive tyres', labor: 160, partsCost: 2480, routine: true, provider: 'Gume Plus, Zagreb' },
      { kmAgo: 90000, category: 'COOLING', component: 'COOLING', description: 'Coolant loss traced to a leaking water pump. Pump and thermostat replaced, system flushed and refilled', parts: 'Water pump, thermostat, gaskets, coolant (35 L)', labor: 520, partsCost: 880, routine: false, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 118000, category: 'OIL_FILTER', component: 'ENGINE', description: 'Engine oil and filter change', parts: 'Engine oil 10W-40 (40 L), oil filter', labor: 110, partsCost: 295, routine: true, provider: WORKSHOP },
      { kmAgo: 146000, category: 'SUSPENSION', component: 'SUSPENSION', description: 'Rear air bellows replaced, one leaking', parts: 'Air bellows x1, levelling valve seal', labor: 240, partsCost: 410, routine: false, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 181000, category: 'REGULAR_SERVICE', description: 'Scheduled service with brake test and tachograph check', parts: 'Grease, filters', labor: 290, partsCost: 175, routine: true, provider: WORKSHOP },
    ],
    faults: [
      { kmAgo: 1400, component: 'COOLING', severity: 'HIGH', status: 'OPEN', symptoms: 'Coolant temperature climbed to 104 °C on the climb from Brinje towards Vratnik with a 38 t gross load. Dropped back to normal after stopping for 20 minutes. No visible leak at the roadside.', by: 'Ante Perić', notes: 'Second time this month on the same climb according to the driver.' },
      { kmAgo: 4200, component: 'COOLING', severity: 'MEDIUM', status: 'RESOLVED', symptoms: 'Temperature warning on the same climb with a full load. Cleared after a 20 minute stop and the coolant level was normal.', by: 'Ante Perić', notes: 'Closed after the driver completed the trip. The cause was not found.' },
      { kmAgo: 212000, component: 'ELECTRICAL', severity: 'LOW', status: 'RESOLVED', symptoms: 'AdBlue level warning appeared although the tank was recently filled.', by: 'Ante Perić', notes: 'Level sensor replaced under warranty.' },
    ],
  },
  '#107': {
    events: [
      { kmAgo: 31000, category: 'CLUTCH', component: 'CLUTCH', description: 'Clutch kit replaced after slipping under load', parts: 'Clutch kit, release bearing', labor: 780, partsCost: 1650, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 74000, category: 'CLUTCH', component: 'CLUTCH', description: 'Clutch release bearing and slave cylinder replaced', parts: 'Release bearing, slave cylinder', labor: 420, partsCost: 540, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 52000, category: 'TURBO', component: 'TURBO', description: 'Turbocharger replaced after loss of boost and oil in the intake', parts: 'Turbocharger, oil feed line, gaskets', labor: 640, partsCost: 2380, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 143000, category: 'TRANSMISSION', component: 'TRANSMISSION', description: 'Gearbox oil change and shift linkage adjustment', parts: 'Gearbox oil (16 L)', labor: 180, partsCost: 210, routine: true, provider: WORKSHOP },
    ],
    faults: [
      { kmAgo: 2300, component: 'CLUTCH', severity: 'HIGH', status: 'UNDER_INSPECTION', symptoms: 'Clutch slips when pulling away fully loaded on a slope. Burning smell after repeated starts.', by: 'Josip Tomić' },
      { kmAgo: 5200, component: 'TURBO', severity: 'MEDIUM', status: 'OPEN', symptoms: 'Whistling noise from the turbocharger at 1,400 to 1,600 rpm under acceleration.', by: 'Josip Tomić' },
    ],
  },
  '#112': {
    events: [
      { kmAgo: 12000, category: 'COOLING', component: 'COOLING', description: 'Radiator replaced after coolant weeping at the lower tank', parts: 'Radiator, hoses, coolant', labor: 480, partsCost: 1320, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 96000, category: 'COOLING', component: 'COOLING', description: 'Water pump replaced', parts: 'Water pump, belt, tensioner', labor: 410, partsCost: 690, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 188000, category: 'TRANSMISSION', component: 'TRANSMISSION', description: 'Gearbox actuator replaced after shift faults', parts: 'Gearshift actuator', labor: 360, partsCost: 1480, provider: 'Truck Servis Ivić, Zagreb' },
    ],
    faults: [
      { kmAgo: 900, component: 'TRANSMISSION', severity: 'MEDIUM', status: 'UNDER_INSPECTION', symptoms: 'Harsh shifts between 5th and 6th gear when the engine is warm, intermittent transmission warning light.', by: 'Branko Župan' },
    ],
  },
  '#103': {
    events: [{ kmAgo: 47000, category: 'BRAKES', component: 'BRAKES', description: 'Rear brake pads and discs replaced', parts: 'Pads and discs, rear axle', labor: 460, partsCost: 1180, routine: true, provider: WORKSHOP }],
    faults: [{ kmAgo: 300, component: 'BRAKES', severity: 'HIGH', status: 'UNDER_INSPECTION', symptoms: 'Truck pulls to the right under braking and the front right wheel runs hot after long descents.', by: 'Tomislav Katić', notes: 'Truck is in the workshop for caliper and brake line inspection.' }],
  },
  '#116': {
    events: [
      { kmAgo: 15000, category: 'ENGINE_REPAIR', component: 'ENGINE', description: 'Cylinder head gasket replaced after coolant in the oil', parts: 'Head gasket set, head bolts, coolant, oil', labor: 1650, partsCost: 1890, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 110000, category: 'TURBO', component: 'TURBO', description: 'Turbocharger actuator replaced', parts: 'VGT actuator', labor: 220, partsCost: 690, provider: WORKSHOP },
    ],
    faults: [{ kmAgo: 400, component: 'ENGINE', severity: 'CRITICAL', status: 'OPEN', symptoms: 'Knocking noise from the engine at idle, oil pressure warning at low rpm. Truck was parked immediately.', by: 'Workshop foreman' }],
  },
  '#115': {
    events: [{ kmAgo: 26000, category: 'SUSPENSION', component: 'SUSPENSION', description: 'Both rear air bellows replaced', parts: 'Air bellows x2', labor: 330, partsCost: 780, provider: WORKSHOP }],
    faults: [{ kmAgo: 60000, component: 'ELECTRICAL', severity: 'LOW', status: 'RESOLVED', symptoms: 'Battery warning light on while driving. Alternator output low.', by: 'Zvonimir Kovač', notes: 'Alternator replaced.' }],
  },
  '#110': {
    events: [
      { kmAgo: 38000, category: 'SUSPENSION', component: 'SUSPENSION', description: 'Rear leaf spring pack and bushings replaced after cracking on a quarry road', parts: 'Leaf spring set, bushings', labor: 520, partsCost: 1240, provider: 'Truck Servis Ivić, Zagreb' },
      { kmAgo: 83000, category: 'FUEL', component: 'FUEL', description: 'Two injectors replaced after rough idle', parts: 'Injector x2, seals', labor: 380, partsCost: 1560, provider: WORKSHOP },
    ],
    faults: [{ kmAgo: 4100, component: 'SUSPENSION', severity: 'LOW', status: 'RESOLVED', symptoms: 'Rattle from the rear axle on rough surfaces.', by: 'Goran Perković', notes: 'Loose U-bolt tightened.' }],
  },
  '#120': {
    events: [{ kmAgo: 60000, category: 'COOLING', component: 'COOLING', description: 'Upper radiator hose and thermostat replaced', parts: 'Hose, thermostat, coolant', labor: 190, partsCost: 240, provider: WORKSHOP }],
    faults: [{ kmAgo: 3200, component: 'COOLING', severity: 'MEDIUM', status: 'RESOLVED', symptoms: 'Coolant level dropping slowly, small puddle under the cab after parking.', by: 'Ivica Šarić', notes: 'Loose clamp on the heater hose, tightened and topped up.' }],
  },
}

const ROUTES: [string, string, number, number][] = [
  ['Zagreb', 'Split', 409, 5.6], ['Split', 'Zagreb', 409, 5.5], ['Zagreb', 'Rijeka', 165, 2.4], ['Rijeka', 'Zagreb', 165, 2.3], ['Zagreb', 'Trieste', 270, 3.6],
  ['Zagreb', 'Vienna', 372, 4.4], ['Vienna', 'Zagreb', 372, 4.3], ['Zagreb', 'Munich', 640, 8.2], ['Munich', 'Zagreb', 640, 8.4], ['Zagreb', 'Budapest', 350, 4.3],
  ['Maribor', 'Zagreb', 118, 1.7], ['Zagreb', 'Osijek', 280, 3.6],
]
const QUARRY: [string, string, number, number][] = [['Šibenik quarry', 'Knin site', 62, 1.5], ['Knin site', 'Šibenik quarry', 62, 1.4], ['Split quarry', 'Kaštela site', 45, 1.1], ['Kaštela site', 'Split quarry', 45, 1.0]]

const DOC_TYPES = ['Vehicle registration', 'Insurance', 'Technical inspection', 'Tachograph inspection'] as const
// Days from today until expiry. Chosen so the demo shows every status.
const DOC_OFFSETS: DocOffsets = {
  '#104': { 'Vehicle registration': 341, Insurance: 121, 'Technical inspection': 30, 'Tachograph inspection': 12 },
  '#107': { Insurance: 6 },
  '#103': { 'Tachograph inspection': -9 },
  '#101': { 'Technical inspection': 12 },
  '#112': { 'Technical inspection': 3 },
  '#116': { 'Vehicle registration': -21, Insurance: -21 },
  '#109': { 'Vehicle registration': 18 },
  '#118': { 'Tachograph inspection': 26 },
}

export async function seedHistory(prisma: PrismaClient, companyId: string, vehicles: SeedVehicle[], rnd: () => number, opts: SeedOptions = {}) {
  const stories = opts.stories ?? STORIES
  const docOffsets = opts.docOffsets ?? DOC_OFFSETS
  const routes = opts.routes ?? ROUTES
  const quarry = opts.quarry ?? QUARRY
  const quarryIds = opts.quarryFleetIds ?? ['#104']
  const suffix = opts.countrySuffix ?? ', HR'
  const workshop = opts.workshop ?? WORKSHOP
  const fallbackDriver = opts.defaultDriver ?? 'Ante Perić'
  const now = Date.now()
  const between = (a: number, b: number) => a + rnd() * (b - a)
  const utcDay = (t: number) => new Date(Math.floor(t / DAY) * DAY)

  const maintenance: Prisma.MaintenanceRecordCreateManyInput[] = []
  const faults: Prisma.FaultReportCreateManyInput[] = []
  const documents: Prisma.DocumentCreateManyInput[] = []
  const trips: Prisma.TripCreateManyInput[] = []

  for (const v of vehicles) {
    const at = (km: number) => {
      const back = (v.km - km) / Math.max(1, v.avgDailyKm)
      return { date: utcDay(now - back * DAY), km: Math.round(km), engineHours: Math.max(0, Math.round(v.engineHours - back * v.avgDailyHours)) }
    }
    const story = stories[v.fleetId]
    const add = (e: Ev) => {
      const km = v.km - e.kmAgo
      if (km < 1000) return
      maintenance.push({
        companyId, vehicleId: v.id, ...at(km), category: e.category, component: e.component ?? null, routine: e.routine ?? false, description: e.description,
        parts: e.parts ?? '', laborCost: e.labor, partsCost: e.partsCost, provider: e.provider ?? workshop, notes: e.notes ?? '',
      })
    }

    if (story) story.events.forEach(add)
    else {
      // Routine history: oil and filter, scheduled service, plus wear items that match the vehicle's mileage.
      const oilEvery = v.heavy ? 40000 : 45000
      let km = v.km - Math.round(between(5000, oilEvery - 6000))
      for (let n = 0; n < 6 && km > 8000; n++, km -= oilEvery) {
        add({ kmAgo: v.km - km, category: 'OIL_FILTER', component: 'ENGINE', description: 'Engine oil and filter change', parts: 'Engine oil 10W-40 (40 L), oil filter', labor: Math.round(between(95, 135)), partsCost: Math.round(between(260, 340)), routine: true })
      }
      km = v.km - Math.round(between(12000, 75000))
      for (let n = 0; n < 3 && km > 10000; n++, km -= 90000) {
        add({ kmAgo: v.km - km, category: 'REGULAR_SERVICE', description: 'Scheduled service: steering, lights, belts, axle oil level, chassis greasing', parts: 'Grease, cabin air filter', labor: Math.round(between(270, 320)), partsCost: Math.round(between(140, 220)), routine: true })
      }
      if (v.km > 150000) add({ kmAgo: Math.round(between(25000, 130000)), category: 'BRAKES', component: 'BRAKES', description: 'Brake pads replaced on both axles, discs measured', parts: 'Brake pad set', labor: Math.round(between(400, 480)), partsCost: Math.round(between(780, 1000)), routine: true })
      if (v.km > 220000) add({ kmAgo: Math.round(between(20000, 110000)), category: 'TIRES', component: 'TIRES', description: 'Drive axle tyres replaced and balanced', parts: '4 x drive tyres', labor: 150, partsCost: Math.round(between(1900, 2700)), routine: true })
      if (v.km > 380000) add({ kmAgo: Math.round(between(30000, 160000)), category: 'COOLING', component: 'COOLING', description: 'Coolant replaced and hoses inspected', parts: 'Coolant (35 L)', labor: 130, partsCost: 170, routine: true })
    }
    for (const f of story?.faults ?? []) {
      const km = Math.max(1000, v.km - f.kmAgo)
      faults.push({ companyId, vehicleId: v.id, ...at(km), component: f.component, symptoms: f.symptoms, severity: f.severity, status: f.status, reportedBy: f.by, notes: f.notes ?? '' })
    }

    // Documents
    const offsets = docOffsets[v.fleetId] ?? {}
    DOC_TYPES.forEach((type, i) => {
      const left = offsets[type] ?? Math.round(between(45, 340)) + i * 3
      const expiry = utcDay(now + left * DAY)
      const issue = utcDay(expiry.getTime() - 365 * DAY)
      documents.push({ companyId, vehicleId: v.id, type, number: `${type.slice(0, 3).toUpperCase()}-${v.fleetId.slice(1)}${String(i + 1)}${Math.floor(rnd() * 900 + 100)}`, issueDate: issue, expiryDate: expiry, fileName: type === 'Insurance' ? `policy_${v.fleetId.slice(1)}.pdf` : null, notes: '' })
    })
    if (v.adr) {
      const left = offsets['ADR certificate'] ?? Math.round(between(40, 300))
      documents.push({ companyId, vehicleId: v.id, type: 'ADR certificate', number: `ADR-${v.fleetId.slice(1)}-${Math.floor(rnd() * 9000 + 1000)}`, issueDate: utcDay(now + (left - 365) * DAY), expiryDate: utcDay(now + left * DAY), fileName: null, notes: 'Carriage of dangerous goods by road.' })
    }
    if (v.category === 'Tractor unit' && v.longHaul) {
      const left = v.fleetId === '#113' ? 9 : Math.round(between(60, 300))
      documents.push({ companyId, vehicleId: v.id, type: 'CEMT permit', number: `CEMT-${v.fleetId.slice(1)}-${Math.floor(rnd() * 9000 + 1000)}`, issueDate: utcDay(now + (left - 365) * DAY), expiryDate: utcDay(now + left * DAY), fileName: null, notes: 'International road haulage permit.' })
    }

    // Trips: older than the newest reading, so they never move the odometer.
    const pool = (v.category.startsWith('Rigid') && v.heavy) || quarryIds.includes(v.fleetId) ? quarry : routes
    const count = opts.tripsPerVehicle ? opts.tripsPerVehicle(v) : v.avgDailyKm < 150 ? 3 : 6
    for (let n = 0; n < count; n++) {
      const [from, to, dist, hrs] = pool[Math.floor(rnd() * pool.length)]
      const dep = new Date(now - (2 + n * 6 + Math.floor(between(0, 4))) * DAY - Math.floor(between(0, 3)) * 3600_000)
      const arr = new Date(dep.getTime() + hrs * 1.12 * 3600_000)
      trips.push({
        companyId, vehicleId: v.id, origin: from + (pool === quarry ? '' : suffix), destination: to, departure: dep, arrival: arr,
        distanceKm: dist, hours: Math.round(hrs * 10) / 10, driverName: v.driverName || fallbackDriver, loadKg: v.heavy ? Math.round(between(18000, 27500)) : Math.round(between(12000, 24000)), notes: '',
      })
    }
  }

  // Newest #104 trip carries the same symptom as the open fault, so the dossier tells one consistent story.
  const v104 = vehicles.find((v) => v.fleetId === '#104')
  if (v104) {
    const dep = new Date(now - 5 * DAY)
    trips.push({ companyId, vehicleId: v104.id, origin: 'Split quarry', destination: 'Kaštela site', departure: dep, arrival: new Date(dep.getTime() + 1.2 * 3600_000), distanceKm: 45, hours: 1.1, driverName: 'Ante Perić', loadKg: 22915, notes: 'Excavator transport, Lika section. Coolant temperature warning on Vratnik climb.' })
  }

  await prisma.maintenanceRecord.createMany({ data: maintenance })
  await prisma.faultReport.createMany({ data: faults })
  await prisma.document.createMany({ data: documents })
  await prisma.trip.createMany({ data: trips })
  return { maintenance: maintenance.length, faults: faults.length, documents: documents.length, trips: trips.length }
}
