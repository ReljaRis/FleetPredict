import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'

const EASE = [0.23, 1, 0.32, 1] as const

/**
 * Fades the old page out and the new one in when the address changes. Only opacity is animated, so fixed elements
 * inside pages (drawers, the opening curtain) are never displaced by a transform. After the old page has left, the
 * scroll position returns to the top before the new page appears.
 */
export function PageTransition({ scroller }: { scroller?: () => HTMLElement | null }) {
  const location = useLocation()
  const outlet = useOutlet()
  const reduce = useReducedMotion()
  return (
    <AnimatePresence
      mode="wait"
      initial={false}
      onExitComplete={() => {
        const el = scroller?.()
        if (el) el.scrollTo({ top: 0 })
        else window.scrollTo({ top: 0 })
      }}
    >
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}

let booted = false

/** Fades a whole layout in when it replaces another one (public pages to the app and back). Not on the first page load. */
export function LayoutFade({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const first = useRef(!booted)
  useEffect(() => {
    booted = true
  }, [])
  return (
    <motion.div className={className} initial={first.current || reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: EASE }}>
      {children}
    </motion.div>
  )
}
