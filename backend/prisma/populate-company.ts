import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, type Prisma, type VehicleStatus } from '@prisma/client'
import { seedHistory, type DocOffsets, type Ev, type Fault, type Route, type SeedVehicle } from './seed-history'
import { refreshPredictions } from '../src/modules/engine/engine.service'
import { runForCompany } from '../src/modules/notifications/notifications.service'

/**
 * Fills ONE existing, empty company with a large fictional example: vehicles, readings, service history,
 * fault reports, documents, trips, cost assumptions, notification settings and a few users.
 * Usage: npx tsx prisma/populate-company.ts "Prva Firma"
 * It refuses to run if the company already has vehicles, so it can never overwrite real data.
 */
const prisma = new PrismaClient()
const NAME = process.argv[2] ?? 'Prva Firma'
const USER_PASSWORD = 'PrvaFirma2026!'
const DAY = 86_400_000

let seed = 777001
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const between = (a: number, b: number) => a + rnd() * (b - a)

const W1 = 'Auto servis Moravac, Beograd'
const W2 = 'Truck centar Niš'
const W3 = 'Kamion servis Novi Sad'

interface Row {
  id: string; make: string; model: string; variant: string; year: number; cat: string; engine: string; kw: number; l: number; fuel?: string
  status: VehicleStatus; km: number; h: number; daily: number; hrs: number
  load: boolean; terrain: boolean; haul: boolean; urban: boolean
  loc: string; driver: string; price: number; body: string; payload: number; adr?: boolean; notes?: string
}
const R = (r: Row) => r

// Each of the first two drivers is also an app user, so the DRIVER role can be tried out.
const APP_DRIVERS: Record<string, string> = { 'Milan Petrović': 'milan.petrovic.pf@example.com', 'Ivan Đorđević': 'ivan.djordjevic.pf@example.com' }

const FLEET: Row[] = [
  R({ id: '#201', make: 'Volvo', model: 'FH', variant: '500', year: 2022, cat: 'Tractor unit', engine: 'D13K 12.8 L inline-6 diesel, Euro 6', kw: 368, l: 12.8, status: 'OPERATIONAL', km: 312400, h: 6900, daily: 560, hrs: 8.2, load: false, terrain: false, haul: true, urban: false, loc: 'Beograd depot, RS', driver: 'Milan Petrović', price: 139000, body: 'Reefer semi', payload: 25000 }),
  R({ id: '#202', make: 'Scania', model: 'R', variant: '450', year: 2021, cat: 'Tractor unit', engine: 'DC13 12.7 L inline-6 diesel, Euro 6', kw: 331, l: 12.7, status: 'OPERATIONAL', km: 401800, h: 8800, daily: 540, hrs: 8.0, load: false, terrain: false, haul: true, urban: false, loc: 'Novi Sad, RS', driver: 'Dušan Jovanović', price: 118000, body: 'Reefer semi', payload: 25000 }),
  R({ id: '#203', make: 'Scania', model: 'R', variant: '450', year: 2017, cat: 'Tractor unit', engine: 'DC13 12.7 L inline-6 diesel, Euro 6', kw: 331, l: 12.7, status: 'OPERATIONAL', km: 782300, h: 17100, daily: 470, hrs: 7.4, load: true, terrain: false, haul: true, urban: false, loc: 'Niš, RS', driver: 'Goran Nikolić', price: 92000, body: 'Curtainsider semi', payload: 25500 }),
  R({ id: '#204', make: 'MAN', model: 'TGX', variant: '18.510', year: 2023, cat: 'Tractor unit', engine: 'D2676 12.4 L inline-6 diesel, Euro 6', kw: 375, l: 12.4, status: 'OPERATIONAL', km: 158900, h: 3400, daily: 520, hrs: 7.8, load: false, terrain: false, haul: true, urban: false, loc: 'Beograd depot, RS', driver: 'Ivan Đorđević', price: 146000, body: 'Curtainsider semi', payload: 26000 }),
  R({ id: '#205', make: 'DAF', model: 'XF', variant: '480', year: 2020, cat: 'Tractor unit', engine: 'MX-13 12.9 L inline-6 diesel, Euro 6', kw: 355, l: 12.9, status: 'OPERATIONAL', km: 521700, h: 11300, daily: 500, hrs: 7.5, load: false, terrain: false, haul: true, urban: false, loc: 'Subotica, RS', driver: 'Nenad Stanković', price: 112000, body: 'Box semi', payload: 25500 }),
  R({ id: '#206', make: 'Mercedes-Benz', model: 'Actros', variant: '1851', year: 2019, cat: 'Tractor unit', engine: 'OM 471 12.8 L inline-6 diesel, Euro 6', kw: 370, l: 12.8, status: 'OPERATIONAL', km: 612400, h: 13600, daily: 480, hrs: 7.3, load: false, terrain: false, haul: true, urban: false, loc: 'Beograd depot, RS', driver: 'Zoran Lazić', price: 108000, body: 'Curtainsider semi', payload: 26000 }),
  R({ id: '#207', make: 'MAN', model: 'TGX', variant: '18.440', year: 2016, cat: 'Tractor unit', engine: 'D2066 10.5 L inline-6 diesel, Euro 6', kw: 324, l: 10.5, status: 'OPERATIONAL', km: 921800, h: 20400, daily: 440, hrs: 7.0, load: true, terrain: false, haul: true, urban: false, loc: 'Kragujevac, RS', driver: 'Dragan Simić', price: 84000, body: 'Box semi', payload: 25000 }),
  R({ id: '#208', make: 'Iveco', model: 'S-Way', variant: '460 LNG', year: 2022, cat: 'Tractor unit', engine: 'Cursor 13 NG 12.9 L inline-6 gas, Euro 6', kw: 338, l: 12.9, fuel: 'LNG', status: 'OPERATIONAL', km: 241500, h: 5600, daily: 500, hrs: 7.6, load: false, terrain: false, haul: true, urban: false, loc: 'Beograd depot, RS', driver: 'Aleksandar Kostić', price: 152000, body: 'Curtainsider semi', payload: 25500, notes: 'LNG tractor. Refuelled at the Beograd and Niš LNG stations.' }),
  R({ id: '#209', make: 'Renault', model: 'T', variant: '480', year: 2018, cat: 'Tractor unit', engine: 'DTI 13 12.8 L inline-6 diesel, Euro 6', kw: 353, l: 12.8, status: 'OPERATIONAL', km: 584000, h: 13100, daily: 460, hrs: 7.2, load: false, terrain: false, haul: true, urban: false, loc: 'Čačak, RS', driver: 'Bojan Pavlović', price: 96000, body: 'Box semi', payload: 25000 }),
  R({ id: '#210', make: 'Volvo', model: 'FMX', variant: '460', year: 2020, cat: 'Rigid 8x4', engine: 'D13K 12.8 L inline-6 diesel, Euro 6', kw: 338, l: 12.8, status: 'OPERATIONAL', km: 276300, h: 8100, daily: 160, hrs: 6.9, load: true, terrain: true, haul: false, urban: false, loc: 'Kamenolom Vrdnik, RS', driver: 'Radovan Tomić', price: 156000, body: 'Tipper body', payload: 20500 }),
  R({ id: '#211', make: 'Volvo', model: 'FH', variant: '460', year: 2019, cat: 'Tractor unit', engine: 'D13K 12.8 L inline-6 diesel, Euro 6', kw: 338, l: 12.8, status: 'OUT_OF_SERVICE', km: 433100, h: 9800, daily: 500, hrs: 7.5, load: false, terrain: false, haul: true, urban: false, loc: 'Beograd depot, RS', driver: 'Marko Ristić', price: 124000, body: 'Container chassis', payload: 28000, notes: 'Parked after a brake air-loss warning. Waiting for the workshop.' }),
  R({ id: '#212', make: 'Scania', model: 'G', variant: '410', year: 2018, cat: 'Rigid 6x4', engine: 'DC13 12.7 L inline-6 diesel, Euro 6', kw: 302, l: 12.7, status: 'OPERATIONAL', km: 468900, h: 11800, daily: 210, hrs: 6.8, load: true, terrain: true, haul: false, urban: false, loc: 'Kamenolom Vrdnik, RS', driver: 'Saša Ilić', price: 101000, body: 'Tipper body', payload: 19500 }),
  R({ id: '#213', make: 'MAN', model: 'TGS', variant: '26.400', year: 2019, cat: 'Rigid 6x2', engine: 'D2676 12.4 L inline-6 diesel, Euro 6', kw: 294, l: 12.4, status: 'OPERATIONAL', km: 341200, h: 8800, daily: 250, hrs: 6.2, load: true, terrain: false, haul: false, urban: true, loc: 'Novi Sad, RS', driver: 'Vladimir Đukić', price: 98000, body: 'Concrete mixer', payload: 17000 }),
  R({ id: '#214', make: 'DAF', model: 'XF', variant: '440', year: 2018, cat: 'Tractor unit', engine: 'MX-13 12.9 L inline-6 diesel, Euro 6', kw: 324, l: 12.9, status: 'HIGH_RISK', km: 698400, h: 15600, daily: 450, hrs: 7.2, load: true, terrain: false, haul: true, urban: false, loc: 'Niš, RS', driver: 'Predrag Mitić', price: 99000, body: 'Curtainsider semi', payload: 25500 }),
  R({ id: '#215', make: 'DAF', model: 'CF', variant: '440', year: 2021, cat: 'Rigid 6x2', engine: 'MX-11 10.8 L inline-6 diesel, Euro 6', kw: 324, l: 10.8, status: 'OPERATIONAL', km: 214600, h: 5100, daily: 280, hrs: 6.1, load: false, terrain: false, haul: false, urban: true, loc: 'Beograd depot, RS', driver: 'Nikola Marinković', price: 93000, body: 'Curtainsider body', payload: 15500 }),
  R({ id: '#216', make: 'DAF', model: 'LF', variant: '230', year: 2020, cat: 'Light truck', engine: 'PX-7 6.7 L inline-6 diesel, Euro 6', kw: 169, l: 6.7, status: 'OPERATIONAL', km: 143800, h: 4300, daily: 130, hrs: 5.4, load: false, terrain: false, haul: false, urban: true, loc: 'Beograd depot, RS', driver: 'Miloš Vuković', price: 58000, body: 'Box body', payload: 7500 }),
  R({ id: '#217', make: 'Mercedes-Benz', model: 'Actros', variant: '2545', year: 2017, cat: 'Rigid 6x2', engine: 'OM 471 12.8 L inline-6 diesel, Euro 6', kw: 330, l: 12.8, status: 'OPERATIONAL', km: 536900, h: 12400, daily: 300, hrs: 6.5, load: true, terrain: false, haul: true, urban: false, loc: 'Novi Sad, RS', driver: 'Siniša Popović', price: 105000, body: 'Car transporter', payload: 15000 }),
  R({ id: '#218', make: 'Mercedes-Benz', model: 'Axor', variant: '1840', year: 2014, cat: 'Tractor unit', engine: 'OM 457 12.0 L inline-6 diesel, Euro 5', kw: 295, l: 12.0, status: 'OPERATIONAL', km: 1124500, h: 24800, daily: 420, hrs: 6.9, load: true, terrain: false, haul: true, urban: false, loc: 'Subotica, RS', driver: 'Branislav Gavrilović', price: 61000, body: 'Tank semi (ADR)', payload: 27000, adr: true }),
  R({ id: '#219', make: 'Iveco', model: 'Stralis', variant: 'AS440S46', year: 2015, cat: 'Tractor unit', engine: 'Cursor 11 10.3 L inline-6 diesel, Euro 6', kw: 338, l: 10.3, status: 'IN_SERVICE', km: 1048700, h: 23100, daily: 390, hrs: 6.7, load: true, terrain: false, haul: true, urban: false, loc: 'Kamion servis Novi Sad', driver: 'Rade Janković', price: 82000, body: 'Curtainsider semi', payload: 25000 }),
  R({ id: '#220', make: 'Renault', model: 'Premium', variant: '380', year: 2013, cat: 'Rigid 4x2', engine: 'DXi 11 10.8 L inline-6 diesel, Euro 5', kw: 280, l: 10.8, status: 'OPERATIONAL', km: 742300, h: 17000, daily: 190, hrs: 5.6, load: false, terrain: false, haul: false, urban: true, loc: 'Beograd depot, RS', driver: 'Slobodan Todorović', price: 54000, body: 'Box body', payload: 11000 }),
  R({ id: '#221', make: 'Volvo', model: 'FM', variant: '420', year: 2021, cat: 'Rigid 6x2', engine: 'D11K 10.8 L inline-6 diesel, Euro 6', kw: 309, l: 10.8, status: 'OPERATIONAL', km: 238700, h: 5900, daily: 270, hrs: 6.1, load: true, terrain: false, haul: false, urban: true, loc: 'Beograd depot, RS', driver: 'Uroš Mihajlović', price: 118000, body: 'Tank body (ADR)', payload: 16000, adr: true }),
  R({ id: '#222', make: 'Renault', model: 'T', variant: '480', year: 2020, cat: 'Tractor unit', engine: 'DTI 13 12.8 L inline-6 diesel, Euro 6', kw: 353, l: 12.8, status: 'OPERATIONAL', km: 463700, h: 10300, daily: 480, hrs: 7.4, load: false, terrain: false, haul: true, urban: false, loc: 'Čačak, RS', driver: 'Filip Radosavljević', price: 101000, body: 'Curtainsider semi', payload: 25500 }),
  R({ id: '#223', make: 'Scania', model: 'S', variant: '500', year: 2023, cat: 'Tractor unit', engine: 'DC13 12.7 L inline-6 diesel, Euro 6', kw: 368, l: 12.7, status: 'OPERATIONAL', km: 121400, h: 2600, daily: 560, hrs: 8.1, load: false, terrain: false, haul: true, urban: false, loc: 'Beograd depot, RS', driver: 'Luka Stojanović', price: 158000, body: 'Reefer semi', payload: 25000 }),
  R({ id: '#224', make: 'MAN', model: 'TGL', variant: '12.250', year: 2020, cat: 'Light truck', engine: 'D0836 4.6 L inline-6 diesel, Euro 6', kw: 184, l: 4.6, status: 'OPERATIONAL', km: 184200, h: 5200, daily: 150, hrs: 5.8, load: false, terrain: false, haul: false, urban: true, loc: 'Beograd depot, RS', driver: 'Đorđe Milošević', price: 62000, body: 'Box body', payload: 6500 }),
  R({ id: '#225', make: 'Mercedes-Benz', model: 'Actros', variant: '1845', year: 2022, cat: 'Tractor unit', engine: 'OM 471 12.8 L inline-6 diesel, Euro 6', kw: 330, l: 12.8, status: 'OPERATIONAL', km: 287300, h: 6200, daily: 520, hrs: 7.9, load: false, terrain: false, haul: true, urban: false, loc: 'Beograd depot, RS', driver: 'Miodrag Kovačević', price: 134000, body: 'Curtainsider semi', payload: 26000 }),
  R({ id: '#226', make: 'MAN', model: 'TGS', variant: '33.480', year: 2018, cat: 'Rigid 8x4', engine: 'D2676 12.4 L inline-6 diesel, Euro 6', kw: 353, l: 12.4, status: 'OPERATIONAL', km: 402600, h: 11400, daily: 170, hrs: 6.9, load: true, terrain: true, haul: false, urban: false, loc: 'Kamenolom Vrdnik, RS', driver: 'Vladan Savić', price: 129000, body: 'Tipper body', payload: 18500 }),
  R({ id: '#227', make: 'Ford', model: 'F-Max', variant: '500', year: 2020, cat: 'Tractor unit', engine: 'Ecotorq 12.7 L inline-6 diesel, Euro 6', kw: 368, l: 12.7, status: 'OPERATIONAL', km: 509300, h: 11200, daily: 530, hrs: 8.0, load: false, terrain: false, haul: true, urban: false, loc: 'Niš, RS', driver: 'Aca Mladenović', price: 104000, body: 'Curtainsider semi', payload: 25500 }),
  R({ id: '#228', make: 'Volvo', model: 'FM', variant: 'Electric', year: 2023, cat: 'Rigid 4x2', engine: 'Electric drivetrain, 2 motors', kw: 330, l: 0, fuel: 'Electric', status: 'OPERATIONAL', km: 48200, h: 1900, daily: 120, hrs: 5.0, load: false, terrain: false, haul: false, urban: true, loc: 'Beograd depot, RS', driver: 'Petar Nedeljković', price: 168000, body: 'Box body', payload: 12000, notes: 'Battery-electric city distribution truck. Charged at the depot overnight.' }),
]

const ev = (kmAgo: number, category: Ev['category'], component: Ev['component'], description: string, parts: string, labor: number, partsCost: number, provider: string, routine = false, notes?: string): Ev => ({ kmAgo, category, component, description, parts, labor, partsCost, provider, routine, notes })
const ft = (kmAgo: number, component: Fault['component'], severity: Fault['severity'], status: Fault['status'], symptoms: string, by: string, notes?: string): Fault => ({ kmAgo, component, severity, status, symptoms, by, notes })

const STORIES: Record<string, { events: Ev[]; faults: Fault[] }> = {
  '#203': {
    events: [
      ev(9000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil 10W-40 (40 L), oil filter', 120, 310, W2, true),
      ev(21000, 'COOLING', 'COOLING', 'Radiator hose burst on the road. Hoses and coolant replaced', 'Upper and lower hose, clamps, coolant (35 L)', 260, 340, W2),
      ev(88000, 'COOLING', 'COOLING', 'Water pump replaced after a bearing noise', 'Water pump, belt, tensioner', 420, 710, W2),
      ev(150000, 'TURBO', 'TURBO', 'Turbocharger actuator replaced', 'VGT actuator', 210, 650, W2),
      ev(62000, 'BRAKES', 'BRAKES', 'Brake pads replaced on both axles', 'Brake pad set', 430, 900, W2, true),
      ev(120000, 'REGULAR_SERVICE', undefined, 'Scheduled service with brake test and tachograph check', 'Grease, filters', 290, 180, W2, true),
    ],
    faults: [
      ft(1800, 'COOLING', 'HIGH', 'OPEN', 'Coolant level drops by about two litres between refills. Temperature gauge rises on long climbs on the Niš to Beograd road.', 'Goran Nikolić'),
      ft(6500, 'COOLING', 'MEDIUM', 'RESOLVED', 'Low coolant warning on the dashboard, topped up at the depot.', 'Goran Nikolić', 'Topped up. No leak found at the time.'),
      ft(3000, 'TURBO', 'MEDIUM', 'OPEN', 'Slight whistling from the turbocharger under load and some loss of power on slopes.', 'Goran Nikolić'),
    ],
  },
  '#207': {
    events: [
      ev(26000, 'CLUTCH', 'CLUTCH', 'Clutch kit replaced after slipping when pulling away', 'Clutch kit, release bearing', 760, 1620, W1),
      ev(78000, 'CLUTCH', 'CLUTCH', 'Clutch release bearing and slave cylinder replaced', 'Release bearing, slave cylinder', 410, 530, W1),
      ev(135000, 'TRANSMISSION', 'TRANSMISSION', 'Gearbox oil change and shift linkage adjustment', 'Gearbox oil (16 L)', 180, 215, W1, true),
      ev(15000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil, filters', 115, 300, W1, true),
    ],
    faults: [
      ft(2600, 'CLUTCH', 'HIGH', 'UNDER_INSPECTION', 'Clutch slips when pulling away fully loaded on a slope. Burning smell after repeated starts.', 'Dragan Simić'),
      ft(9000, 'TRANSMISSION', 'MEDIUM', 'OPEN', 'Gearbox grinds when shifting into 2nd gear when cold.', 'Dragan Simić'),
    ],
  },
  '#211': {
    events: [
      ev(8000, 'BRAKES', 'BRAKES', 'Front brake chambers and slack adjusters replaced', 'Brake chambers x2, adjusters x2', 320, 640, W1),
      ev(36000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil, filters', 118, 305, W1, true),
      ev(70000, 'TIRES', 'TIRES', 'Drive axle tyres replaced and balanced', '4 x drive tyres', 160, 2400, W1, true),
    ],
    faults: [
      ft(250, 'BRAKES', 'CRITICAL', 'OPEN', 'Air loss in the brake circuit. The compressor runs constantly and pressure drops overnight. The truck was parked immediately.', 'Marko Ristić'),
    ],
  },
  '#214': {
    events: [
      ev(14000, 'SUSPENSION', 'SUSPENSION', 'Rear air bellows replaced, one leaking', 'Air bellows x1', 240, 420, W2),
      ev(52000, 'SUSPENSION', 'SUSPENSION', 'Levelling valve and air line replaced', 'Levelling valve, air line', 190, 360, W2),
      ev(98000, 'SUSPENSION', 'SUSPENSION', 'Both rear air bellows replaced', 'Air bellows x2', 330, 800, W2),
      ev(40000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil, filters', 120, 310, W2, true),
    ],
    faults: [
      ft(1200, 'SUSPENSION', 'MEDIUM', 'OPEN', 'The trailer sits low on the left side after standing overnight, and the truck pulls slightly to the left.', 'Predrag Mitić'),
    ],
  },
  '#218': {
    events: [
      ev(30000, 'COOLING', 'COOLING', 'Coolant replaced and radiator cleaned', 'Coolant (35 L)', 150, 190, W3, true),
      ev(88000, 'TURBO', 'TURBO', 'Turbocharger replaced', 'Turbocharger, gaskets, oil line', 650, 2250, W3),
      ev(205000, 'ENGINE_REPAIR', 'ENGINE', 'Cylinder head gasket replaced', 'Head gasket set, bolts, coolant', 1500, 1750, W3),
      ev(12000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil, filters', 120, 310, W3, true),
      ev(55000, 'BRAKES', 'BRAKES', 'Brake pads and discs replaced', 'Pads and discs', 460, 1150, W3, true),
    ],
    faults: [ft(7000, 'ELECTRICAL', 'LOW', 'RESOLVED', 'Intermittent loss of the rear trailer lights. Connector corroded.', 'Branislav Gavrilović', 'Trailer socket replaced.')],
  },
  '#219': {
    events: [
      ev(11000, 'ENGINE_REPAIR', 'ENGINE', 'Oil consumption investigated. Piston rings and valve stem seals checked, oil separator replaced', 'Oil separator, valve stem seals', 1100, 980, W3),
      ev(95000, 'COOLING', 'COOLING', 'Water pump replaced', 'Water pump, belt', 400, 650, W3),
      ev(160000, 'TURBO', 'TURBO', 'Turbocharger actuator replaced', 'Actuator', 220, 680, W3),
      ev(60000, 'ELECTRICAL', 'ELECTRICAL', 'Alternator replaced', 'Alternator', 180, 520, W3),
    ],
    faults: [
      ft(600, 'ENGINE', 'HIGH', 'UNDER_INSPECTION', 'The engine uses about a litre of oil per 1,000 km and there is blue smoke on start-up.', 'Rade Janković', 'Truck is in the workshop in Novi Sad.'),
      ft(7500, 'ELECTRICAL', 'LOW', 'RESOLVED', 'Battery warning light while driving. Loose alternator connector.', 'Rade Janković', 'Connector tightened.'),
    ],
  },
  '#222': {
    events: [
      ev(23000, 'FUEL', 'FUEL', 'Two injectors replaced after rough idle', 'Injector x2, seals', 380, 1480, W1),
      ev(9000, 'FUEL', 'FUEL', 'Main and pre fuel filters replaced, circuit bled', 'Fuel filters', 70, 135, W1, true),
      ev(30000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil, filters', 115, 300, W1, true),
    ],
    faults: [
      ft(1500, 'FUEL', 'MEDIUM', 'OPEN', 'Hesitation when accelerating and the engine stumbles at about 1,300 rpm under load.', 'Filip Radosavljević'),
      ft(5200, 'FUEL', 'MEDIUM', 'RESOLVED', 'Same hesitation under load. It cleared after changing the fuel filter.', 'Filip Radosavljević'),
    ],
  },
  '#226': {
    events: [
      ev(17000, 'BRAKES', 'BRAKES', 'Brake pads and discs replaced on the front axles', 'Pads and discs, 2 axles', 520, 1350, W3),
      ev(56000, 'BRAKES', 'BRAKES', 'Brake pads replaced', 'Brake pad set', 420, 880, W3),
      ev(39000, 'SUSPENSION', 'SUSPENSION', 'Rear leaf springs replaced after cracking on a quarry road', 'Leaf spring set, bushings', 520, 1240, W3),
      ev(20000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil, filters', 115, 300, W3, true),
    ],
    faults: [ft(4000, 'SUSPENSION', 'LOW', 'RESOLVED', 'Rattle from the rear axle on rough surfaces. Loose U-bolt.', 'Vladan Savić', 'Tightened.')],
  },
  '#227': {
    events: [
      ev(15000, 'ELECTRICAL', 'ELECTRICAL', 'Starter motor replaced', 'Starter motor', 180, 480, W2),
      ev(63000, 'ELECTRICAL', 'ELECTRICAL', 'Both batteries replaced', 'Batteries x2', 90, 360, W2),
      ev(27000, 'OIL_FILTER', 'ENGINE', 'Engine oil and filter change', 'Engine oil, filters', 118, 305, W2, true),
    ],
    faults: [
      ft(1100, 'ELECTRICAL', 'MEDIUM', 'OPEN', 'The truck sometimes does not crank in the morning. The dashboard flickers when the engine is started.', 'Aca Mladenović'),
      ft(3300, 'ELECTRICAL', 'LOW', 'RESOLVED', 'Dashboard flickered once when starting.', 'Aca Mladenović', 'Battery terminals cleaned.'),
    ],
  },
  '#209': {
    events: [ev(48000, 'COOLING', 'COOLING', 'Upper radiator hose and thermostat replaced', 'Hose, thermostat, coolant', 190, 240, W1)],
    faults: [ft(900, 'BRAKES', 'LOW', 'OPEN', 'Slight squeal from the front brakes at low speed.', 'Bojan Pavlović')],
  },
  '#220': {
    events: [ev(72000, 'COOLING', 'COOLING', 'Upper radiator hose and thermostat replaced', 'Hose, thermostat, coolant', 190, 240, W1)],
    faults: [ft(3200, 'COOLING', 'MEDIUM', 'RESOLVED', 'Coolant level dropping slowly. Loose clamp on the heater hose.', 'Slobodan Todorović', 'Clamp tightened and coolant topped up.')],
  },
}

const D = (o: Record<string, number>) => o
const DOC_OFFSETS: DocOffsets = {
  '#203': D({ Insurance: 5, 'Technical inspection': 40 }),
  '#207': D({ 'Technical inspection': -14, 'Tachograph inspection': 26 }),
  '#211': D({ 'Vehicle registration': 20, Insurance: 20 }),
  '#214': D({ 'Tachograph inspection': 9 }),
  '#218': D({ 'ADR certificate': 11, 'Technical inspection': 3 }),
  '#219': D({ 'Vehicle registration': -6 }),
  '#221': D({ 'ADR certificate': 27 }),
  '#201': D({ 'Technical inspection': 12 }),
  '#205': D({ Insurance: 29 }),
  '#210': D({ 'Technical inspection': 7 }),
  '#222': D({ 'Tachograph inspection': 17 }),
  '#227': D({ Insurance: 2 }),
  '#204': D({ 'CEMT permit': 24 }),
  '#225': D({ 'CEMT permit': 8 }),
}

const ROUTES: Route[] = [
  ['Beograd', 'Niš', 240, 3.1], ['Niš', 'Beograd', 240, 3.1], ['Beograd', 'Novi Sad', 90, 1.2], ['Novi Sad', 'Beograd', 90, 1.2], ['Beograd', 'Subotica', 190, 2.4],
  ['Subotica', 'Beograd', 190, 2.4], ['Beograd', 'Zagreb', 390, 4.6], ['Zagreb', 'Beograd', 390, 4.7], ['Beograd', 'Budimpešta', 380, 4.5], ['Budimpešta', 'Beograd', 380, 4.5],
  ['Beograd', 'Sofija', 380, 5.4], ['Niš', 'Skoplje', 215, 3.0], ['Beograd', 'Temišvar', 270, 3.6], ['Kragujevac', 'Beograd', 140, 1.9], ['Čačak', 'Beograd', 145, 2.0],
]
const QUARRY: Route[] = [
  ['Kamenolom Vrdnik', 'Novi Sad, gradilište', 45, 1.1], ['Novi Sad, gradilište', 'Kamenolom Vrdnik', 45, 1.0],
  ['Kamenolom Vrdnik', 'Beograd, Surčin', 75, 1.6], ['Beograd, Surčin', 'Kamenolom Vrdnik', 75, 1.5], ['Kamenolom Vrdnik', 'Šabac, gradilište', 95, 1.9],
]

const WMI: Record<string, string> = { Volvo: 'YV2', Scania: 'YS2', MAN: 'WMA', DAF: 'XLR', 'Mercedes-Benz': 'WDB', Iveco: 'ZCF', Renault: 'VF6', Ford: 'W0L' }
const LETTERS = 'ABCDEFGHJKLMNPRSTUVZ'
const letter = () => LETTERS[Math.floor(rnd() * LETTERS.length)]

async function main() {
  const matches = await prisma.company.findMany({ where: { name: { equals: NAME, mode: 'insensitive' }, isDemo: false }, include: { _count: { select: { vehicles: true } } } })
  if (matches.length !== 1) throw new Error(`Expected exactly one company named "${NAME}", found ${matches.length}.`)
  const company = matches[0]
  if (company._count.vehicles > 0) throw new Error(`"${company.name}" already has ${company._count.vehicles} vehicles. Refusing to add to existing data.`)
  console.log(`Populating "${company.name}" (${company.id})`)

  // Settings -------------------------------------------------------------------------------------------------------
  await prisma.company.update({ where: { id: company.id }, data: { country: 'Serbia', vatId: 'RS100000001', notifyEmail: true, notifyInApp: true, notifyThresholds: [30, 14, 7, 0] } })

  const COSTS: Record<string, [number, number, number | null, number | null]> = {
    ENGINE: [9800, 390, 40000, 12], COOLING: [4200, 360, 75000, 36], BRAKES: [2500, 640, 110000, 18], TRANSMISSION: [8400, 460, null, null], CLUTCH: [3700, 540, null, null],
    TURBO: [3400, 420, null, null], SUSPENSION: [2000, 400, 180000, 48], ELECTRICAL: [1600, 230, null, null], FUEL: [2900, 270, 55000, 24], TIRES: [2700, 310, 130000, 36],
  }
  await prisma.componentCost.createMany({ data: Object.entries(COSTS).map(([component, [repairCost, preventiveCost, intervalKm, intervalMonths]]) => ({ companyId: company.id, component: component as never, repairCost, preventiveCost, intervalKm, intervalMonths })), skipDuplicates: true })

  // Users: one of each role besides the existing owner --------------------------------------------------------------
  const hash = await bcrypt.hash(USER_PASSWORD, 12)
  const mk = (name: string, email: string, role: 'MANAGER' | 'MECHANIC' | 'DRIVER') => prisma.user.create({ data: { companyId: company.id, name, email, role, passwordHash: hash } })
  await mk('Jelena Ilić', 'jelena.ilic.pf@example.com', 'MANAGER')
  await mk('Stefan Marković', 'stefan.markovic.pf@example.com', 'MECHANIC')
  const appDrivers = new Map<string, string>()
  for (const [name, email] of Object.entries(APP_DRIVERS)) appDrivers.set(name, (await mk(name, email, 'DRIVER')).id)

  // Vehicles with monthly odometer readings ------------------------------------------------------------------------
  const now = Date.now()
  const seeded: SeedVehicle[] = []
  for (const f of FLEET) {
    const purchase = new Date(Date.UTC(f.year, 1 + Math.floor(rnd() * 7), 1 + Math.floor(rnd() * 27)))
    const driverId = appDrivers.get(f.driver) ?? null
    const wmi = WMI[f.make] ?? 'WDB'
    const v = await prisma.vehicle.create({
      data: {
        companyId: company.id, fleetId: f.id,
        registration: `${['BG', 'NS', 'NI', 'SU', 'KG', 'CA'][Math.floor(rnd() * 6)]} ${100 + Math.floor(rnd() * 899)}-${letter()}${letter()}`,
        vin: `${wmi}${String(f.year % 100).padStart(2, '0')}${Math.floor(1e11 + rnd() * 9e11)}`.slice(0, 17).padEnd(17, '0'),
        manufacturer: f.make, model: f.model, variant: f.variant, year: f.year, category: f.cat, engineType: f.engine, powerKw: f.kw, fuelType: f.fuel ?? 'Diesel',
        displacementL: f.l, payloadKg: f.payload, bodyType: f.body, km: f.km, engineHours: f.h, avgDailyKm: f.daily, avgDailyHours: f.hrs, status: f.status, location: f.loc,
        purchaseDate: purchase, purchasePrice: f.price, driverId, driverName: driverId ? '' : f.driver, notes: f.notes ?? '',
        heavyLoads: f.load, demandingTerrain: f.terrain, longHaul: f.haul, urbanStopGo: f.urban,
      },
    })
    seeded.push({ id: v.id, fleetId: f.id, km: f.km, engineHours: f.h, avgDailyKm: f.daily, avgDailyHours: f.hrs, year: f.year, category: f.cat, heavy: f.load, longHaul: f.haul, driverName: f.driver, location: f.loc, adr: f.adr })

    const points = 18
    let km = f.km
    let h = f.h
    const rows: Prisma.VehicleReadingCreateManyInput[] = []
    for (let k = 0; k < points; k++) {
      rows.push({ companyId: company.id, vehicleId: v.id, recordedAt: new Date(now - k * 30.4 * DAY - (k === 0 ? 0 : Math.floor(between(0, 2)) * DAY)), km: Math.round(km), engineHours: Math.round(h), source: 'MANUAL' })
      km -= f.daily * 30.4 * between(0.85, 1.12)
      h -= f.hrs * 30.4 * between(0.85, 1.12)
      if (km < 1000) break
    }
    await prisma.vehicleReading.createMany({ data: rows })
  }

  // Service history, faults, documents and trips ----------------------------------------------------------------------
  const counts = await seedHistory(prisma, company.id, seeded, rnd, {
    stories: STORIES, docOffsets: DOC_OFFSETS, routes: ROUTES, quarry: QUARRY, quarryFleetIds: [], countrySuffix: ', RS', workshop: W1, defaultDriver: 'Milan Petrović',
    tripsPerVehicle: (v) => (v.avgDailyKm < 150 ? 5 : 9),
  })

  await refreshPredictions(company.id)
  const notes = await runForCompany(company.id)

  const dist = await prisma.prediction.groupBy({ by: ['category'], where: { companyId: company.id }, _count: true })
  console.log(`Vehicles: ${seeded.length}`)
  console.log(`History: ${counts.maintenance} service records, ${counts.faults} fault reports, ${counts.documents} documents, ${counts.trips} trips`)
  console.log(`Predictions by category: ${dist.map((d) => `${d.category} ${d._count}`).join(', ')}`)
  console.log(`Notifications created: ${notes.documents + notes.predictions}`)
  console.log(`Extra users created with password ${USER_PASSWORD}: jelena.ilic.pf@example.com (Manager), stefan.markovic.pf@example.com (Mechanic), milan.petrovic.pf@example.com and ivan.djordjevic.pf@example.com (Drivers)`)
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1) }).finally(() => prisma.$disconnect())
