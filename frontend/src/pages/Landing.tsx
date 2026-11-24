import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { LandingSections } from './landing/Sections'

/**
 * The opening curtain plays only when the page itself is loaded or refreshed on the start page.
 * Arriving at the start page later by moving around the app (logo, back button, sign out) never plays it,
 * and neither does a load that began on another page such as /login.
 */
const loadedOnStartPage = typeof window !== 'undefined' && window.location.pathname === '/'
let introPlayed = false

/**
 * Black screen with the logo that parts like a curtain. The logo is centred on the screen and the
 * curtain opens down the middle of it. The curtain starts only once the image has loaded, otherwise
 * it would open on an empty screen.
 */
function Intro({ onDone }: { onDone: () => void }) {
  const [seam, setSeam] = useState<number | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    const ready = () => !cancelled && setSeam(Math.round(window.innerWidth / 2))
    const img = new Image()
    img.src = '/logo.png'
    img.decode().then(ready, ready)
    return () => {
      cancelled = true
    }
  }, [])

  const logo = (
    <img src="/logo.png" alt="" className="intro-name h-auto w-[min(82vw,760px)]" />
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] bg-night" aria-hidden="true" style={seam === null ? undefined : { background: 'transparent' }}>
      {seam !== null && (
        <>
          <div className="curtain-left absolute inset-y-0 left-0 overflow-hidden bg-night" style={{ width: seam }}>
            <div className="absolute left-0 top-0 flex h-full w-screen items-center justify-center">{logo}</div>
          </div>
          <div
            className="curtain-right absolute inset-y-0 overflow-hidden bg-night"
            style={{ left: seam, width: `calc(100vw - ${seam}px)` }}
            onAnimationEnd={(e) => e.animationName === 'curtain-right' && onDone()}
          >
            <div className="absolute top-0 flex h-full w-screen items-center justify-center" style={{ left: -seam }}>{logo}</div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Landing() {
  const panel = useRef<HTMLDivElement>(null)
  const { hash } = useLocation()
  const navigate = useNavigate()
  const [intro, setIntro] = useState(() => loadedOnStartPage && !introPlayed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  // Fixed at the first render: if the delay were dropped when the curtain ends, the hero text would jump to its final position.
  const [playedIntro] = useState(intro)

  // A page load or refresh with the curtain always starts at the hero: the browser's remembered scroll position
  // and a leftover "#section" in the address (from an earlier click on the navigation) are dropped.
  useLayoutEffect(() => {
    if (!intro) return
    window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    if (window.location.hash) navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Arriving from another page with #how or #report scrolls to that section.
  useEffect(() => {
    if (hash && !intro) document.getElementById(hash.slice(1))?.scrollIntoView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  // While the curtain is closed the page cannot scroll.
  useEffect(() => {
    if (!intro) return
    introPlayed = true
    const html = document.documentElement
    const before = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter }
    // Hiding the scrollbar would widen the page and shift the hero, and bringing it back would shift it again.
    html.style.scrollbarGutter = 'stable'
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = before.overflow
      html.style.scrollbarGutter = before.gutter
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
        <section className="sticky top-[5.5rem] h-[calc(100svh-5.5rem)]">
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
            <div className="absolute inset-x-0 bottom-0 -z-10 h-3/5 bg-gradient-to-t from-night/85 via-night/50 to-transparent md:hidden" />
            <div className="absolute inset-0 -z-10 hidden bg-gradient-to-l from-night/70 via-night/20 to-transparent md:block" />

            <div className="mx-auto flex h-full w-full max-w-[1400px] items-center px-5 py-[4vh] sm:px-8 md:pb-[6vh] md:pt-0">
              <div className="rise flex w-full flex-col md:ml-auto md:block md:w-[56%] lg:w-[50%]" style={playedIntro ? { animationDelay: '2000ms' } : undefined}>
                <h1 className="mt-3 font-hero text-[clamp(3rem,min(16.5vw,9.5svh),4.75rem)] font-black md:text-[clamp(2.8rem,6.6vw,6rem)] leading-[1] tracking-tight text-white">
                  A truck standing still is <span className="text-amber">money standing still.</span>
                </h1>
                <div className="pt-7 md:pt-0">
                <p className="md:mt-6 max-w-[34rem] text-[clamp(1rem,1.5vw,1.2rem)] leading-relaxed text-white/80">
                  A breakdown on the road stops the truck, and the income with it. Fleet Predict ranks which truck and which component to inspect first, from your own service history, faults and mileage, so the stop happens in your workshop, on your schedule.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    to="/register"
                    className="group inline-flex h-12 items-center gap-2 rounded-md bg-amber px-6 text-[16px] font-semibold text-night transition-[transform,background-color] duration-150 hover:bg-white active:scale-[0.98]"
                  >
                    Set up your fleet
                  </Link>
                  <a href="#report" className="text-[15px] font-medium text-white/85 transition-colors duration-200 hover:text-white">
                    See how a score is built
                  </a>
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Everything below slides up over the pinned hero */}
        <div className="relative z-10 rounded-t-2xl border-t border-white/10 bg-night-2 shadow-[0_-30px_50px_-10px_rgba(0,0,0,0.7)]">
      <LandingSections />

      <SiteFooter />
        </div>
      </div>
    </div>
  )
}
