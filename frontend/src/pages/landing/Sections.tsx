import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

/** Fades a block in once as it scrolls into view. Skipped for people who ask for reduced motion. */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  )
}

const wrap = 'mx-auto max-w-[1400px] px-5 py-24 sm:px-8 md:py-28'
const h2 = 'font-display text-4xl font-semibold leading-[0.98] tracking-tight sm:text-5xl lg:text-[3.5rem]'
const eyebrow = 'text-[15px] font-medium text-amber'

/* ------------------------------------------------------------------ 1. The problem */
function Problem() {
  const rows: [string, string, string][] = [
    ['When it is found', 'On the road, with a load on board', 'In your workshop, on a day you chose'],
    ['What it interrupts', 'A delivery, a driver and the next booking', 'A slot you had already left empty'],
    ['What you pay for', 'Towing, a rushed repair, a late delivery', 'The inspection and the part, nothing else'],
    ['What you knew before', 'Nothing. The dashboard light came on', 'Which component, how urgent, and why'],
  ]
  return (
    <section id="problem" className="scroll-mt-28 bg-night-2">
      <div className={`${wrap} grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center`}>
        <Reveal>
          <p className={eyebrow}>Why it matters</p>
          <h2 className={`mt-3 ${h2}`}>The same fault costs very different money depending on where it is found.</h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
            Most breakdowns have a history: a symptom reported twice, a service that ran long, a part known to wear on that engine. The information exists. It is just spread over notebooks, spreadsheets and memory.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="hidden grid-cols-2 gap-3 text-sm font-semibold sm:grid">
            <span className="flex items-center gap-2 text-[#f3a49e]"><span aria-hidden="true" className="text-base leading-none">×</span>Found on the road</span>
            <span className="flex items-center gap-2 text-amber"><span aria-hidden="true" className="text-base leading-none">✓</span>Found in advance</span>
          </div>
          <div className="mt-3 space-y-6">
            {rows.map(([k, a, b]) => (
              <div key={k}>
                <p className="mb-2 text-sm font-medium text-white/50">{k}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="rounded-md border border-[#f3a49e]/20 bg-[#f3a49e]/[0.06] px-4 py-4 text-[15px] leading-snug text-white/75"><span className="mb-1 block text-xs font-semibold text-[#f3a49e] sm:hidden">Found on the road</span>{a}</p>
                  <p className="rounded-md border border-amber/30 bg-amber/10 px-4 py-4 text-[15px] leading-snug text-white"><span className="mb-1 block text-xs font-semibold text-amber sm:hidden">Found in advance</span>{b}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 2. Features */
function Tile({ n, title, children, className = '', foot }: { n: string; title: string; children: ReactNode; className?: string; foot?: ReactNode }) {
  return (
    <div className={`flex flex-col rounded-lg border border-line bg-surface p-7 ${className}`}>
      <span className="num font-display text-lg font-semibold text-amber-ink">{n}</span>
      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">{title}</h3>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">{children}</p>
      {foot && <div className="mt-auto pt-6">{foot}</div>}
    </div>
  )
}

const chip = 'rounded-sm bg-sunken px-2 py-1 text-xs font-medium text-ink-2'

function Features() {
  const spec: [string, string][] = [
    ['Truck', '#104 · Mercedes-Benz Actros 1845'],
    ['Engine', 'OM 471, 12.8 L, Euro 6'],
    ['Odometer', '485,200 km'],
    ['Engine hours', '11,200 h'],
    ['Duty', 'Heavy loads, demanding terrain'],
  ]
  return (
    <section id="features" className="scroll-mt-28 bg-canvas text-ink">
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className="text-[15px] font-medium text-amber-ink">What you keep in it</p>
          <h2 className={`mt-3 ${h2}`}>One dossier per truck, and everyone writes to the same one.</h2>
        </Reveal>
        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          <Reveal className="lg:col-span-3 lg:row-span-2">
            <Tile
              n="01"
              title="Fleet and vehicle data"
              className="h-full"
              foot={
                <dl className="num divide-y divide-line border-y border-line text-sm">
                  {spec.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              }
            >
              Add each truck with its registration, VIN, odometer, engine hours and the way it is used. Pick the make, model and engine from a catalogue of European trucks, or type your own. Mileage and hours are kept as a history, so usage per day is known.
            </Tile>
          </Reveal>
          <Reveal className="lg:col-span-3" delay={0.05}>
            <Tile n="02" title="Service and repair history" className="h-full" foot={<div className="flex flex-wrap gap-2">{['Oil and filters', 'Brakes', 'Cooling', 'Turbo', 'Tyres'].map((c) => <span key={c} className={chip}>{c}</span>)}</div>}>
              Every job is tied to a component and marked as routine or as a repair. Workshop, parts and cost stay on the record, and repeated repairs on the same component are noticed.
            </Tile>
          </Reveal>
          <Reveal className="lg:col-span-3" delay={0.1}>
            <Tile n="03" title="Fault reports from the people who see them" className="h-full" foot={<div className="flex flex-wrap gap-2">{['Open', 'Under inspection', 'Resolved'].map((c) => <span key={c} className={chip}>{c}</span>)}</div>}>
              A driver describes the symptom, picks the component and a severity. A mechanic takes it through inspection to resolution. The same symptom coming back is recognised as a pattern.
            </Tile>
          </Reveal>
          <Reveal className="lg:col-span-2" delay={0.05}>
            <Tile n="04" title="Trips" className="h-full">
              Log trips with distance and duration. They move the odometer and engine hours forward and give each truck its real daily usage.
            </Tile>
          </Reveal>
          <Reveal className="lg:col-span-2" delay={0.1}>
            <Tile n="05" title="Documents and reminders" className="h-full">
              Keep registration, insurance and inspection papers with their expiry dates. A reminder appears in the app, and by email if you want it, before a document runs out.
            </Tile>
          </Reveal>
          <Reveal className="lg:col-span-2" delay={0.15}>
            <Tile n="06" title="Your own cost figures" className="h-full">
              Enter what a repair and what a preventive service cost for each component. Savings are only ever calculated from numbers you entered.
            </Tile>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 3. How it works */
function How() {
  const steps = [
    { n: '01', title: 'Record what happens', body: 'Services, repairs, fault reports, odometer and engine-hour readings, trips and documents go into one dossier per vehicle. Nothing has to be typed twice.' },
    { n: '02', title: 'Every component is scored', body: 'Ten components per truck get a score from 0 to 100. It comes from service intervals, open and repeated faults, age, mileage, duty and documented problems of the engine.' },
    { n: '03', title: 'Read the page, plan the stop', body: 'A ranked list says what to inspect first and how soon, in plain language, with the cost of waiting shown next to the cost of acting.' },
  ]
  return (
    <section id="how" className="scroll-mt-28 bg-night-2">
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className={eyebrow}>How it works</p>
          <h2 className={`mt-3 ${h2}`}>From a notebook of jobs to a ranked list of trucks.</h2>
        </Reveal>
        <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          <span aria-hidden="true" className="absolute left-0 right-0 top-[1.55rem] hidden h-px bg-night-line md:block" />
          {steps.map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 0.1}>
                <div className="relative flex items-center gap-4">
                  <span className="num relative grid h-[3.1rem] min-w-[3.1rem] place-items-center rounded-full border border-amber bg-night-2 px-3 font-display text-xl font-semibold text-amber">{s.n}</span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold">{s.title}</h3>
                <p className="mt-3 max-w-sm leading-relaxed text-white/65">{s.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 4. Ten components, scored */
type Part = { name: string; factors: [string, number][] }
const PARTS: Part[] = [
  { name: 'Cooling system', factors: [['Open fault: coolant temperature 104 °C on a climb', 32], ['Last cooling service 90,000 km ago, interval 80,000 km', 22], ['Heavy-load and demanding-terrain duty', 10], ['Vehicle age and total mileage', 15]] },
  { name: 'Braking system', factors: [['Last brake work at 70% of the interval', 7], ['Heavy-load duty', 8], ['Demanding terrain', 8], ['Vehicle age and total mileage', 8]] },
  { name: 'Engine', factors: [['Documented problems of the OM 471 engine', 10], ['Heavy-load duty', 6], ['Vehicle age', 6], ['High total mileage', 4]] },
  { name: 'Suspension', factors: [['Heavy-load duty', 8], ['Demanding terrain', 8], ['Vehicle age', 5]] },
  { name: 'Tyres', factors: [['Last tyre work at 65% of the interval', 5], ['Heavy-load duty', 7], ['Demanding terrain', 5], ['High total mileage', 4]] },
  { name: 'Transmission', factors: [['Heavy-load duty', 6], ['Demanding terrain', 5], ['High total mileage', 4]] },
  { name: 'Turbocharger', factors: [['Documented problem of the OM 471 engine', 5], ['Heavy-load duty', 5], ['High total mileage', 4]] },
  { name: 'Clutch', factors: [['Heavy-load duty', 8], ['Demanding terrain', 5]] },
  { name: 'Fuel system', factors: [['Documented problems of the OM 471 engine', 7], ['High total mileage', 2]] },
  { name: 'Electrical system', factors: [['Demanding terrain', 3], ['Vehicle age', 3]] },
]
const total = (p: Part) => p.factors.reduce((s, [, n]) => s + n, 0)
const level = (s: number) => (s >= 75 ? { label: 'Critical', bar: 'bg-critical', tag: 'bg-critical text-white' } : s >= 50 ? { label: 'High', bar: 'bg-high', tag: 'bg-high-soft text-high' } : s >= 25 ? { label: 'Moderate', bar: 'bg-moderate', tag: 'bg-moderate-soft text-moderate' } : { label: 'Low', bar: 'bg-low', tag: 'bg-low-soft text-low' })

function Scoring() {
  const [sel, setSel] = useState(0)
  const p = PARTS[sel]
  const score = total(p)
  const lv = level(score)
  return (
    <section id="report" className="scroll-mt-28 bg-canvas text-ink">
      <div className={wrap}>
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[15px] font-medium text-amber-ink">The score</p>
            <h2 className={`mt-3 ${h2}`}>Ten components per truck. Every point has a reason.</h2>
          </div>
          <span className="rounded-sm border border-dashed border-ink-3 px-2 py-1 text-xs font-semibold tracking-wide text-ink-3">DEMO DATA · TRUCK #104</span>
        </Reveal>
        <Reveal delay={0.1} className="mt-12 grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="divide-y divide-line border-b border-line lg:border-b-0 lg:border-r" aria-label="Components of the demo truck">
            {PARTS.map((c, i) => {
              const s = total(c)
              const l = level(s)
              return (
                <li key={c.name}>
                  <button
                    onClick={() => setSel(i)}
                    aria-pressed={sel === i}
                    className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition-colors duration-150 ${sel === i ? 'bg-sunken' : 'hover:bg-canvas'}`}
                  >
                    <span className="text-[15px] font-medium">{c.name}</span>
                    <span className="num font-display text-xl font-semibold">{s}</span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                      <span className={`block h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)] ${l.bar}`} style={{ width: `${s}%` }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-col px-6 py-6 sm:px-8 sm:py-8" aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-sm px-2 py-0.5 text-sm font-semibold ${lv.tag}`}>{lv.label}</span>
              <h3 className="font-display text-3xl font-semibold">{p.name}</h3>
              <span className="num ml-auto font-display text-5xl font-semibold leading-none">{score}</span>
            </div>
            <p className="mt-2 text-sm text-ink-3">out of 100, a maintenance priority and not the chance of a failure</p>
            <ul className="mt-6 divide-y divide-line border-y border-line text-[15px]">
              {p.factors.map(([a, b]) => (
                <li key={a} className="flex justify-between gap-4 py-3">
                  <span>{a}</span>
                  <span className="num font-semibold">+{b}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 py-3 font-semibold">
                <span>Total</span>
                <span className="num">{score}</span>
              </li>
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-ink-3">
              Scores start at 25 for Moderate, 50 for High and 75 for Critical. Each one maps to a timeframe, from "next scheduled service" to "before the next trip".
            </p>
          </div>
        </Reveal>
        <Reveal className="mt-8 grid gap-6 text-[15px] text-ink-2 md:grid-cols-3">
          {[
            ['Traceable', 'Each factor points at the service record, fault report or rule it came from.'],
            ['Adjustable', 'Service intervals and weights can be changed per company, so the score follows your operation.'],
            ['Honest about gaps', 'When a record is missing, the report says so and what it limits, instead of guessing.'],
          ].map(([t, d]) => (
            <div key={t} className="border-t border-line-strong pt-4">
              <p className="font-semibold text-ink">{t}</p>
              <p className="mt-1.5 leading-relaxed">{d}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 5. Engine knowledge */
function Engines() {
  const stats: [string, string][] = [
    ['8', 'makes'],
    ['58', 'models'],
    ['116', 'engines'],
    ['440+', 'documented problems'],
  ]
  const issues: [string, string][] = [
    ['EGR cooler', 'Leakage and corrosion, with coolant reaching the exhaust side.'],
    ['Turbocharger', 'Oil pressure line faults and failures at high mileage.'],
    ['AdBlue pump', 'Low pressure and electrical faults on the dosing pump.'],
    ['Fuel injection pump', 'Wear and hard starting in a known production range.'],
  ]
  return (
    <section id="engines" className="scroll-mt-28 bg-night-2">
      <div className={`${wrap} grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
        <Reveal>
          <p className={eyebrow}>Engine knowledge</p>
          <h2 className={`mt-3 ${h2}`}>It knows what usually goes wrong on your engine.</h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
            Choose the engine when you add a truck. The app looks up the problems documented for that engine family, such as recalls, repair cases and supplier guidance, and counts them toward the matching component.
          </p>
          <dl className="num mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-night-line bg-night-line sm:grid-cols-4">
            {stats.map(([n, l]) => (
              <div key={l} className="bg-night-2 px-4 py-5">
                <dt className="font-display text-4xl font-semibold text-white">{n}</dt>
                <dd className="mt-1 text-sm text-white/55">{l}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/45">Entries come from public sources and the catalogue keeps a link to each one. A documented problem is general knowledge about an engine model. It is never presented as a finding on your truck.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-lg border border-night-line bg-night p-6 sm:p-8">
            <p className="text-sm text-white/50">Examples from the catalogue</p>
            <ul className="mt-4 divide-y divide-night-line">
              {issues.map(([t, d]) => (
                <li key={t} className="py-4">
                  <p className="font-medium text-white">{t}</p>
                  <p className="mt-1 text-[15px] leading-snug text-white/60">{d}</p>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-3 rounded-md bg-amber/10 p-4 text-[15px] leading-snug text-white/80">
              <span aria-hidden="true" className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-amber" />
              <p>This adds at most 10 points to a component. That is below the Moderate threshold, so it can raise a priority together with real evidence but can never raise an alert on its own.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 6. AI explanation */
function Ai() {
  const checks = [
    'It may only use the facts the engine produced for that component.',
    'It cannot change the score or the category.',
    'It cannot introduce a number that is not in the data.',
    'It cannot say a failure is certain.',
    'If any check fails, or the service is unavailable, a plain text written from the rules is shown instead.',
  ]
  return (
    <section id="ai" className="scroll-mt-28 bg-canvas text-ink">
      <div className={`${wrap} grid gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center`}>
        <Reveal delay={0.05} className="order-2 lg:order-1">
          <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink-3">Explanation · cooling system</p>
              <span className="rounded-sm bg-night px-2 py-0.5 text-xs font-semibold text-amber">AI-written</span>
            </div>
            <p className="mt-4 text-[17px] leading-relaxed">
              <strong>#104</strong> should have its cooling system looked at first, with a score of 79 (Critical). A coolant temperature of 104 °C was reported under a heavy load, and the last cooling work was 90,000 km ago, beyond the 80,000 km interval.
            </p>
            <p className="mt-5 text-sm font-semibold">Inspect</p>
            <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[15px] text-ink-2 sm:grid-cols-2">
              {['Radiator and hoses', 'Thermostat', 'Water pump', 'Coolant circulation', 'EGR cooler for leaks'].map((x) => (
                <li key={x} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-amber" />{x}</li>
              ))}
            </ul>
            <p className="mt-5 border-t border-line pt-4 text-sm text-ink-3">Before the next trip. Continued overheating may damage the engine and lead to a costly repair.</p>
          </div>
        </Reveal>
        <Reveal className="order-1 lg:order-2">
          <p className="text-[15px] font-medium text-amber-ink">The language model</p>
          <h2 className={`mt-3 ${h2}`}>It explains the result. It never decides it.</h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
            The score is calculated by rules you can read. A language model, when connected, turns that result into a few clear sentences for someone who is not a mechanic. Its answer is checked before you see it.
          </p>
          <ul className="mt-7 space-y-3 text-[15px] text-ink-2">
            {checks.map((c) => (
              <li key={c} className="flex gap-3"><span aria-hidden="true" className="font-semibold text-low">✓</span>{c}</li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 7. Cost of waiting */
function Cost() {
  return (
    <section id="cost" className="scroll-mt-28 bg-night-2">
      <div className={`${wrap} grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center`}>
        <Reveal>
          <p className={eyebrow}>The cost of waiting</p>
          <h2 className={`mt-3 ${h2}`}>The arithmetic is on the page, not hidden in the score.</h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
            For a High or Critical component the report sets a weighted repair cost against the cost of inspecting now. You see every number and where it came from.
          </p>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/50">
            An estimate from your own cost figures, not a guarantee. If a component has no costs entered, no figure is shown and the report says what is missing.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-lg border border-night-line bg-night p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/50">Cooling system · truck #104</p>
              <span className="rounded-sm border border-dashed border-white/30 px-2 py-0.5 text-xs font-semibold text-white/50">DEMO DATA</span>
            </div>
            <dl className="num mt-6 grid grid-cols-[1fr_auto] gap-x-8 gap-y-3 text-[16px]">
              <dt className="text-white/65">Repair cost if it fails (entered by you)</dt>
              <dd>€4,000</dd>
              <dt className="text-white/65">Weighting from the score (79 of 100)</dt>
              <dd>× 0.79</dd>
              <dt className="text-white/65">Weighted repair cost</dt>
              <dd>€3,160</dd>
              <dt className="text-white/65">Inspection and service now</dt>
              <dd>− €350</dd>
            </dl>
            <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-night-line pt-5">
              <span className="font-semibold">Estimated saving by acting now</span>
              <span className="num font-display text-4xl font-semibold text-amber">€2,810</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 8. Roles */
function Roles() {
  const roles: { name: string; body: string; can: string[] }[] = [
    { name: 'Driver', body: 'Reports what they notice on the road.', can: ['Reports a fault with symptoms and severity'] },
    { name: 'Mechanic', body: 'Works the list the report produces.', can: ['Logs service, repairs and readings', 'Takes faults through inspection', 'Acknowledges and schedules predictions', 'Sees the whole fleet'] },
    { name: 'Manager', body: 'Plans the workshop and the budget.', can: ['Everything a mechanic does', 'Edits vehicles, trips and documents', 'Sets cost assumptions'] },
    { name: 'Owner', body: 'Runs the account.', can: ['Everything a manager does', 'Company settings', 'Adds and manages team members'] },
  ]
  return (
    <section id="roles" className="scroll-mt-28 bg-canvas text-ink">
      <div className={wrap}>
        <Reveal className="max-w-3xl">
          <p className="text-[15px] font-medium text-amber-ink">Your team</p>
          <h2 className={`mt-3 ${h2}`}>Each person sees and changes only what their job needs.</h2>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r, i) => (
            <Reveal key={r.name} delay={i * 0.06} className="bg-surface">
              <div className="flex h-full flex-col p-7">
                <span className="text-sm font-semibold text-amber-ink">Access level {i + 1} of 4</span>
                <h3 className="mt-3 font-display text-2xl font-semibold">{r.name}</h3>
                <p className="mt-1 text-[15px] text-ink-3">{r.body}</p>
                <ul className="mt-5 space-y-2 border-t border-line pt-5 text-[15px] text-ink-2">
                  {r.can.map((c) => (
                    <li key={c} className="flex gap-2.5"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-amber" />{c}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-6 max-w-3xl border-l-2 border-amber pl-4 text-[15px] text-ink-2">
          <p>Access is enforced on the server, not only hidden in the screen, and each company's data is separate from every other company's.</p>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 9. FAQ */
const FAQ: [string, string][] = [
  ['Is this machine learning?', 'No. The score comes from explicit rules and weights that you can read and adjust. That is a deliberate choice: with no history of real failures to learn from, a trained model would only look clever. When enough real failure data exists, a model can be added next to the rules, not instead of them.'],
  ['Is the score the probability that something fails?', 'No. It ranks how urgently a component deserves an inspection. A score of 80 means "look at this first", not "an 80% chance of failure".'],
  ['What happens when records are missing?', 'The result says so. A component with no service record gets a capped score and a note that the real state is unknown. A fault with no component selected is listed as something that cannot yet influence any score.'],
  ['Can I change the intervals and weights?', 'Yes. Service intervals and cost figures are set per component for your company, and the weights behind the score can be overridden. The defaults are sensible starting points for heavy trucks.'],
  ['Does my data go to an AI provider?', 'Only the calculated facts of one component are sent, and only when someone asks for an explanation: vehicle, component, score and the factors. No company, user or contact details leave the server, and the key stays on the server.'],
  ['Does it work without the AI layer?', 'Yes. If the language model is not configured, is busy or gives an answer that fails a check, the app shows a plain explanation written from the rules. Nothing else depends on it.'],
]

function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 bg-night-2">
      <div className={`${wrap} grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]`}>
        <Reveal>
          <p className={eyebrow}>Questions</p>
          <h2 className={`mt-3 ${h2}`}>What people ask before they trust a score.</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="divide-y divide-night-line border-y border-night-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="shrink-0 font-display text-3xl leading-none text-amber transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-2xl pb-6 leading-relaxed text-white/65">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 10. Closing call */
function Closing() {
  return (
    <section className="bg-amber text-night">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-4xl font-bold leading-[0.98] tracking-tight sm:text-5xl lg:text-6xl">Find out which truck goes to the workshop first.</h2>
          <p className="mt-4 text-lg text-night/75">Create a company account, add your trucks and their history, and the first ranked list is ready.</p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/register" className="inline-flex h-12 items-center rounded-md bg-night px-6 text-[16px] font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-night-2 active:scale-[0.98]">
            Set up your fleet
          </Link>
          <Link to="/login" className="text-[15px] font-semibold underline underline-offset-4">
            Sign in
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

export function LandingSections() {
  return (
    <>
      <Problem />
      <Features />
      <How />
      <Scoring />
      <Engines />
      <Ai />
      <Cost />
      <Roles />
      <Faq />
      <Closing />
    </>
  )
}
