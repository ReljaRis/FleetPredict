import { Link } from 'react-router-dom'
import { Logo } from './Logo'

const link = 'text-white/60 transition-colors duration-200 hover:text-white'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-night text-white">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Logo size="lg" />
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/60">
            Maintenance priorities for truck fleets, built from your own service history, faults and mileage.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-sm font-semibold text-white/90">Product</p>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><Link to="/#features" className={link}>Features</Link></li>
            <li><Link to="/#how" className={link}>How it works</Link></li>
            <li><Link to="/#report" className={link}>The score</Link></li>
            <li><Link to="/#faq" className={link}>FAQ</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <p className="text-sm font-semibold text-white/90">Account</p>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><Link to="/login" className={link}>Sign in</Link></li>
            <li><Link to="/register" className={link}>Create account</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-5 py-5 text-sm text-white/45 sm:px-8">
          <p>© {new Date().getFullYear()} Fleet Predict</p>
          <p>Example vehicles and companies in the application are synthetic demo data.</p>
        </div>
      </div>
    </footer>
  )
}
