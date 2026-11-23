import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'

const steps = [
  { n: '01', title: 'Record what happens to each truck', body: 'Services, repairs, driver fault reports, odometer and engine-hour readings, trips and documents live in one dossier per vehicle.' },
  { n: '02', title: 'A rule engine ranks every component', body: 'Ten components are scored from 0 to 100 from service intervals, repeated repairs, open faults, vehicle age and operating conditions. Every point is traceable to a record.' },
  { n: '03', title: 'Plain-language report and cost estimate', body: 'An explanation says what to inspect and how soon. Repair cost against preventive cost is shown with its assumptions, and only when you have entered the costs.' },
]

const factors: [string, string][] = [
  ['Open fault: coolant temperature 104 °C on a climb', '+32'],
  ['Cooling service 90,000 km ago, interval 80,000 km', '+22'],
  ['Heavy-load and demanding-terrain duty', '+10'],
  ['Vehicle age and total mileage', '+15'],
]

/**
 * The opening curtain plays only when the page itself is loaded or refreshed on the start page.
 * Arriving at the start page later by moving around the app (logo, back button, sign out) never plays it,
 * and neither does a load that began on another page such as /login.
 */
const loadedOnStartPage = typeof window !== 'undefined' && window.location.pathname === '/'
let introPlayed = false

/**
 * Black screen with the product name that parts like a curtain. The name is centred on the screen, but the
 * curtain opens between "Fleet" and "Predict", not at the middle of the screen, so no word is cut in half.
 * The seam is measured from the real layout once the font is loaded.
 */
function Intro({ onDone }: { onDone: () => void }) {
  const measure = useRef<HTMLSpanElement>(null)
  const [seam, setSeam] = useState<number | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    const take = () => {
      const p = measure.current?.querySelector<HTMLElement>('[data-predict]')
      if (p && !cancelled) setSeam(Math.round(p.getBoundingClientRect().left))
    }
    // Wait for the display font, otherwise the words would be measured in a fallback font.
    const fonts = document.fonts
    if (fonts?.load) fonts.load('700 64px "Sofia Sans Semi Condensed"').then(take, take)
    else take()
    return () => {
      cancelled = true
    }
  }, [])

  const word = (animated: boolean) => (
    <span className={`${animated ? 'intro-name ' : ''}font-display text-[clamp(2.75rem,9vw,7rem)] font-semibold leading-none text-white`}>
      Fleet<span data-predict className="text-amber">Predict</span>
    </span>
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] bg-night" aria-hidden="true" style={seam === null ? undefined : { background: 'transparent' }}>
      {/* Unseen copy used only to measure where "Predict" begins */}
      <div className="invisible absolute inset-0 flex items-center justify-center"><span ref={measure}>{word(false)}</span></div>
      {seam !== null && (
        <>
          <div className="curtain-left absolute inset-y-0 left-0 overflow-hidden bg-night" style={{ width: seam }}>
            <div className="absolute left-0 top-0 flex h-full w-screen items-center justify-center">{word(true)}</div>
          </div>
          <div
            className="curtain-right absolute inset-y-0 overflow-hidden bg-night"
            style={{ left: seam, width: `calc(100vw - ${seam}px)` }}
            onAnimationEnd={(e) => e.animationName === 'curtain-right' && onDone()}
          >
            <div className="absolute top-0 flex h-full w-screen items-center justify-center" style={{ left: -seam }}>{word(true)}</div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Landing() {
  const panel = useRef<HTMLDivElement>(null)
  const { hash } = useLocation()

  // Arriving from another page with #how or #report scrolls to that section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  const [intro, setIntro] = useState(() => loadedOnStartPage && !introPlayed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  // While the curtain is closed the page cannot scroll.
  useEffect(() => {
    if (!intro) return
    introPlayed = true
    const html = document.documentElement
    const before = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = before
    }
  }, [intro])

  // The hero stays pinned under the navigation while the page content slides over it. It keeps its size and
  // only dims a little as it is covered. Written straight to the element to avoid re-rendering on scroll.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = () => {
      frame = 0
      const el = panel.current
      if (!el) return
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.85)))
      el.style.filter = `brightness(${1 - 0.6 * p})`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="bg-night text-white">
      {intro && <Intro onDone={() => setIntro(false)} />}
      {/* NAVIGATION: its own bar, so the hero image never runs underneath it */}

      {/* HERO: pinned below the navigation; the content after it scrolls over it */}
      <div className="relative">
        <section className="sticky top-16 h-[calc(100svh-4rem)]">
          <div ref={panel} className="relative isolate h-full overflow-hidden will-change-[filter]">
            <picture>
              <source media="(max-width: 767px)" srcSet="/hero-truck-md.jpg" />
              <img
                src="/hero-truck.jpg"
                alt="Dark tractor unit lit by amber marker lights, side view in a smoky workshop"
                fetchPriority="high"
                className="absolute inset-0 -z-20 h-full w-full object-cover object-[22%_bottom] md:object-bottom"
              />
            </picture>
            {/* The top edge fades from the navigation colour, so the bar and the picture read as one black surface */}
            <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-night via-night/60 to-transparent" />
            {/* Legibility: darken the top and the text side only */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-night/70 via-night/20 to-night/10" />
            <div className="absolute inset-0 -z-10 hidden bg-gradient-to-l from-night/70 via-night/20 to-transparent md:block" />

            <div className="mx-auto flex h-full w-full max-w-[1400px] items-start px-5 pb-[30vh] pt-[7vh] sm:px-8 md:items-center md:pb-[6vh] md:pt-0">
              <div className="rise w-full md:ml-auto md:w-[56%] lg:w-[50%]" style={intro ? { animationDelay: '2000ms' } : undefined}>
                <p className="text-[15px] font-medium text-amber">Predictive maintenance for truck fleets</p>
                <h1 className="mt-3 font-display text-[clamp(2.8rem,6.6vw,6rem)] font-bold leading-[0.92] tracking-tight text-white">
                  A truck standing still is <span className="text-amber">money standing still.</span>
                </h1>
                <p className="mt-6 max-w-[34rem] text-[clamp(1rem,1.5vw,1.2rem)] leading-relaxed text-white/80">
                  A breakdown on the road stops the truck, and the income with it. Fleet Predict ranks which truck and which component to inspect first, from your own service history, faults and mileage, so the stop happens in your workshop, on your schedule.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    to="/register"
                    className="group inline-flex h-12 items-center gap-2 rounded-md bg-amber px-6 text-[16px] font-semibold text-night transition-[transform,background-color] duration-150 hover:bg-white active:scale-[0.98]"
                  >
                    Set up your fleet
                  </Link>
                  <a href="#how" className="text-[15px] font-medium text-white/85 transition-colors duration-200 hover:text-white">
                    See how a score is built
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Everything below slides up over the pinned hero */}
        <div className="relative z-10 rounded-t-2xl border-t border-white/10 bg-night-2 shadow-[0_-30px_50px_-10px_rgba(0,0,0,0.7)]">
      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div>
            <h2 className="font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">A score you can trace back to a record</h2>
            <p className="mt-5 max-w-md text-white/70">
              The numbers come from a deterministic rule engine, not from a language model. The language model, when connected, only explains a result that is already calculated. Scores rank priority. They are not failure probabilities.
            </p>
          </div>
          <ol className="divide-y divide-night-line border-y border-night-line">
            {steps.map((s) => (
              <li key={s.n} className="grid grid-cols-[3.5rem_1fr] gap-4 py-7">
                <span className="num font-display text-2xl text-amber">{s.n}</span>
                <div>
                  <h3 className="text-xl font-medium">{s.title}</h3>
                  <p className="mt-2 max-w-xl text-white/65">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SAMPLE REPORT: illustration of the report layout, clearly labelled as demo data */}
      <section id="report" className="scroll-mt-20 bg-canvas text-ink">
        <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-2xl font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">What a manager reads on a single page</h2>
            <span className="rounded-sm border border-dashed border-ink-3 px-2 py-1 text-xs font-semibold tracking-wide text-ink-3">DEMO DATA</span>
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="bg-surface">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-6 py-5">
                <p className="font-display text-3xl font-semibold">
                  <span className="num">#104</span> <span className="text-ink-2">Mercedes-Benz Actros 1845</span>
                </p>
                <p className="num text-sm text-ink-3">485,200 km · 11,200 h</p>
              </div>
              <div className="px-6 py-6">
                <div className="flex items-center gap-3">
                  <span className="rounded-sm bg-critical px-2 py-0.5 text-sm font-semibold text-white">Critical</span>
                  <span className="text-lg font-medium">Cooling system</span>
                  <span className="num ml-auto font-display text-4xl font-semibold text-critical">79</span>
                </div>
                <p className="mt-5 text-ink-2">
                  Overheating was reported under a heavy load, and the last cooling intervention was a long way back. Inspect the radiator, thermostat, water pump and coolant circulation before the next demanding route.
                </p>
                <ul className="mt-5 divide-y divide-line border-y border-line text-sm">
                  {factors.map(([a, b]) => (
                    <li key={a} className="flex justify-between gap-4 py-2.5">
                      <span>{a}</span>
                      <span className="num font-medium">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="self-center">
              <h3 className="text-xl font-medium">The cost of waiting, with the arithmetic shown</h3>
              <dl className="num mt-5 grid grid-cols-[1fr_auto] gap-x-8 gap-y-2 border-y border-line py-5 text-[15px]">
                <dt className="text-ink-2">Repair cost if it fails (entered by you)</dt>
                <dd>€4,000</dd>
                <dt className="text-ink-2">Weighting from the score (79/100)</dt>
                <dd>× 0.79</dd>
                <dt className="text-ink-2">Weighted repair cost</dt>
                <dd>€3,160</dd>
                <dt className="text-ink-2">Preventive inspection and service</dt>
                <dd>− €350</dd>
                <dt className="font-semibold">Estimated saving by acting now</dt>
                <dd className="font-semibold text-low">€2,810</dd>
              </dl>
              <p className="mt-4 max-w-md text-sm text-ink-3">
                An estimate from your own cost assumptions, not a guarantee. If a component has no costs entered, no figure is shown and the report says what is missing.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
        </div>
      </div>
    </div>
  )
}
