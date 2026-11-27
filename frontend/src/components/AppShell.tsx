import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Activity, FileText, Gauge, LogOut, Menu, Route as RouteIcon, Settings, Truck, Wrench, X } from 'lucide-react'
import { Logo } from './Logo'
import { DemoTag } from './ui'
import { NotificationBell } from './NotificationBell'
import { useAuth } from '../lib/auth'

// Items are added here as their modules are built, so every entry leads to a working page.
const NAV = [
  { to: '/app', label: 'Control room', icon: Gauge, end: true },
  { to: '/app/fleet', label: 'Fleet', icon: Truck },
  { to: '/app/predictions', label: 'Predictions', icon: Activity },
  { to: '/app/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/app/documents', label: 'Documents', icon: FileText },
  { to: '/app/routes', label: 'Routes and usage', icon: RouteIcon },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (!session) return null
  const { user, company } = session
  const role = user.role.charAt(0) + user.role.slice(1).toLowerCase()

  const rail = (
    <nav aria-label="Main" className="flex h-full flex-col bg-night text-white">
      <div className="relative flex items-center justify-center px-5 pb-4 pt-5">
        <Logo size="rail" />
        <button className="absolute right-3 top-3 rounded p-1 text-white/60 hover:text-white lg:hidden"aria-label="Close menu" onClick={() => setOpen(false)}>
          <X className="size-5" />
        </button>
      </div>
      <div className="mx-5 mb-4 flex items-center gap-2 border-y border-night-line py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{company.name}</p>
          {company.isDemo && (
            <div className="mt-1.5">
              <DemoTag />
            </div>
          )}
        </div>
        <NotificationBell tone="dark" />
      </div>
      <ul className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={'end' in rest}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors ${isActive ? 'bg-night-2 font-medium text-white' : 'text-white/65 hover:bg-night-2/60 hover:text-white'}`}
            >
              <Icon className="size-[18px]" /> {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-night-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-white/55">{role}</p>
        </div>
        <button
          aria-label="Sign out"
          title="Sign out"
          onClick={async () => {
            await logout()
            navigate('/', { replace: true })
          }}
          className="rounded-md p-2 text-white/65 transition-colors hover:bg-night-2 hover:text-white"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </nav>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <aside className="hidden w-72 shrink-0 lg:block">{rail}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-night/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{rail}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-night-line bg-night px-4 py-2 text-white lg:hidden">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-white/10">
            <Menu className="size-5" />
          </button>
          <Logo />
        </header>
        <main id="app-main" className="flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
