import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Logo } from './Logo'

const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'report', label: 'The score' },
  { id: 'faq', label: 'FAQ' },
]

/** The section whose area crosses the middle of the viewport, so the matching link can show it is current. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    if (!ids.length) {
      setActive(null)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id)
          else setActive((a) => (a === e.target.id ? null : a))
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    ids.map((id) => document.getElementById(id)).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return active
}

/**
 * Navigation item. An amber bar along the bottom edge marks the current item. Hovering only brightens the text.
 * A link to a section of the start page is a plain anchor on the start page and a router link everywhere else.
 */
function Item({ to, label, current, onClick, sameDocument }: { to: string; label: string; current: boolean; onClick?: () => void; sameDocument?: boolean }) {
  const cls = `group relative flex h-[5.5rem] items-center px-3.5 text-[15px] font-medium transition-colors duration-200 ${current ? 'text-white' : 'text-white/65 hover:text-white'}`
  const bar = current ? <span aria-hidden="true" className="absolute inset-x-3.5 bottom-0 h-[3px] bg-amber" /> : null
  return sameDocument ? (
    <a href={to} onClick={onClick} className={cls} aria-current={current ? 'location' : undefined}>
      {label}
      {bar}
    </a>
  ) : (
    <Link to={to} onClick={onClick} className={cls} aria-current={current ? 'page' : undefined}>
      {label}
      {bar}
    </Link>
  )
}

export function SiteHeader() {
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  const section = useActiveSection(onHome ? SECTIONS.map((s) => s.id) : [])
  const [open, setOpen] = useState(false)

  // Close the mobile menu whenever the page changes.
  useEffect(() => setOpen(false), [pathname])

  const anchor = (id: string) => (onHome ? `#${id}` : `/#${id}`)
  const signInActive = pathname === '/login'
  const registerActive = pathname === '/register'

  return (
    <header className="sticky top-0 z-30 h-[5.5rem] bg-night">
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="Fleet Predict home" className="group -ml-1 rounded-md px-1 py-1 text-white transition-opacity hover:opacity-80">
          <Logo size="nav" />
        </Link>

        <nav aria-label="Main" className="hidden items-center sm:flex">
          {SECTIONS.map((s) => (
            <Item key={s.id} to={anchor(s.id)} label={s.label} current={onHome && section === s.id} sameDocument={onHome} />
          ))}
          <span aria-hidden="true" className="mx-2 h-5 w-px bg-white/15" />
          <Item to="/login" label="Sign in" current={signInActive} />
          <Link
            to="/register"
            aria-current={registerActive ? 'page' : undefined}
            className={`group ml-3 inline-flex h-10 items-center gap-2 rounded-md px-4 text-[15px] font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.98] ${registerActive ? 'bg-amber text-night' : 'bg-white text-night hover:bg-amber'}`}
          >
            Create account
          </Link>
        </nav>

        <button
          className="rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav aria-label="Main" className="absolute inset-x-0 top-[5.5rem] border-t border-white/10 bg-night px-5 pb-5 pt-2 shadow-2xl sm:hidden">
          <ul className="divide-y divide-white/10">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                {onHome ? (
                  <a href={anchor(s.id)} onClick={() => setOpen(false)} className="block py-3.5 text-[17px] text-white/80 hover:text-white">{s.label}</a>
                ) : (
                  <Link to={anchor(s.id)} className="block py-3.5 text-[17px] text-white/80 hover:text-white">{s.label}</Link>
                )}
              </li>
            ))}
            <li><Link to="/login" className={`block py-3.5 text-[17px] ${signInActive ? 'text-amber' : 'text-white/80 hover:text-white'}`}>Sign in</Link></li>
          </ul>
          <Link to="/register" className="mt-3 flex h-12 items-center justify-center gap-2 rounded-md bg-amber text-[16px] font-semibold text-night">
            Create account
          </Link>
        </nav>
      )}
    </header>
  )
}
