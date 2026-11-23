import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Check, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react'
import { SiteFooter } from '../components/SiteFooter'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

type Mode = 'login' | 'register'
type Values = { company: string; name: string; email: string; password: string }

const COPY = {
  login: { title: 'Welcome back', sub: 'Sign in to see which trucks need attention.', submit: 'Sign in', alt: ['New to Fleet Predict?', 'Create a company account', '/register'] },
  register: { title: 'Create your company account', sub: 'Set up your fleet in a few minutes. You become the Owner.', submit: 'Create account', alt: ['Already have an account?', 'Sign in', '/login'] },
} as const

/** The two screens mirror each other: the form switches sides and the dark panel carries different content. */
export default function AuthPage({ mode }: { mode: Mode }) {
  const { session, loading, login, register } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<Values>({ company: '', name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const c = COPY[mode]
  const isLogin = mode === 'login'

  if (!loading && session) return <Navigate to="/app" replace />

  function localValidate() {
    const e: Record<string, string> = {}
    if (!isLogin) {
      if (values.company.trim().length < 2) e.company = 'Enter the company name.'
      if (values.name.trim().length < 2) e.name = 'Enter your name.'
    }
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) e.email = 'Enter a valid email address.'
    if (isLogin ? values.password.length < 1 : values.password.length < 8) e.password = isLogin ? 'Enter your password.' : 'Use at least 8 characters.'
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setFormError(null)
    const e = localValidate()
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      if (isLogin) await login(values.email.trim(), values.password)
      else await register({ ...values, company: values.company.trim(), name: values.name.trim(), email: values.email.trim() })
      navigate('/app', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {})
        if (!err.fields || Object.keys(err.fields).length === 0) setFormError(err.message)
      } else setFormError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const field = (name: keyof Values, label: string, icon: ReactNode, type = 'text', autoComplete?: string, hint?: string) => {
    const isPw = name === 'password'
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-medium text-ink">{label}</label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-3">{icon}</span>
          <input
            id={name}
            name={name}
            type={isPw && show ? 'text' : type}
            autoComplete={autoComplete}
            value={values[name]}
            onChange={(e) => {
              setValues((v) => ({ ...v, [name]: e.target.value }))
              if (errors[name]) setErrors((x) => ({ ...x, [name]: '' }))
            }}
            aria-invalid={!!errors[name]}
            aria-describedby={errors[name] ? `${name}-err` : undefined}
            className={`h-12 w-full rounded-lg border bg-white pl-11 text-[15px] text-ink shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-none focus:transition-[border-color,box-shadow] focus:duration-150 placeholder:text-ink-3 hover:border-line-strong focus:border-night focus:outline-none focus:ring-4 focus:ring-amber/25 ${isPw ? 'pr-12' : 'pr-4'} ${errors[name] ? 'border-critical focus:ring-critical/15' : 'border-line'}`}
          />
          {isPw && (
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          )}
        </div>
        {errors[name] ? <p id={`${name}-err`} className="mt-1.5 text-sm text-critical">{errors[name]}</p> : hint ? <p className="mt-1.5 text-xs text-ink-3">{hint}</p> : null}
      </div>
    )
  }

  const formPanel = (
    <main className={`flex items-center justify-center bg-canvas text-ink px-6 py-12 sm:px-12 ${isLogin ? 'auth-from-right' : 'auth-from-left'}`}>
      <div className="w-full max-w-[26rem]">
        <h1 className="font-display text-[clamp(2.4rem,4vw,3.4rem)] font-bold leading-[0.95] tracking-tight">{c.title}</h1>
        <p className="mt-3 text-[16px] text-ink-2">{c.sub}</p>

        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          {!isLogin && field('company', 'Company name', <Building2 className="size-[18px]" />, 'text', 'organization')}
          {!isLogin && field('name', 'Your name', <User className="size-[18px]" />, 'text', 'name')}
          {field('email', 'Work email', <Mail className="size-[18px]" />, 'email', 'email')}
          {field('password', 'Password', <Lock className="size-[18px]" />, 'password', isLogin ? 'current-password' : 'new-password', isLogin ? undefined : 'At least 8 characters.')}
          {formError && (
            <p role="alert" className="rounded-lg border border-critical/30 bg-critical/5 px-3.5 py-2.5 text-sm text-critical">{formError}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-night text-[16px] font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-night-2 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {c.submit}
          </button>
        </form>


        <p className="mt-8 text-[15px] text-ink-2">
          {c.alt[0]}{' '}
          <Link to={c.alt[2]} className="group inline-flex items-center gap-1 font-semibold text-ink">
            {c.alt[1]}
          </Link>
        </p>
      </div>
    </main>
  )

  const contentPanel = (
    <aside className={`flex items-center justify-center bg-[#0d1013] px-6 py-14 text-white sm:px-12 ${isLogin ? 'auth-from-left' : 'auth-from-right'}`}>
      <div className="w-full max-w-[30rem]">{isLogin ? <SignInContent /> : <SignUpContent />}</div>
    </aside>
  )

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col bg-night">
      {/* On small screens only the form is shown. From lg up the panels sit side by side and swap sides between the two pages. */}
      <div className="grid flex-1 lg:grid-cols-2">
        {isLogin ? (
          <>
            {formPanel}
            <div className="hidden lg:contents">{contentPanel}</div>
          </>
        ) : (
          <>
            <div className="hidden lg:contents">{contentPanel}</div>
            {formPanel}
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}

/* ---------------- Content for the dark panel ---------------- */

function SignInContent() {
  return (
    <>
      <h2 className="font-display text-[clamp(2.4rem,4vw,3.6rem)] font-bold leading-[0.95] tracking-tight">Your fleet, ranked by what needs a workshop first.</h2>
      <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/60">
        Every score shows the records behind it, and every cost estimate shows its arithmetic.
      </p>
      <dl className="mt-10 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10">
        {[
          ['10', 'components scored for every truck'],
          ['0–100', 'priority score, with the reasons listed'],
          ['1', 'dossier per vehicle for service, faults and documents'],
        ].map(([n, t]) => (
          <div key={n} className="px-4 py-5 first:pl-0 last:pr-0">
            <dt className="num font-display text-4xl font-bold leading-none text-amber">{n}</dt>
            <dd className="mt-2 text-sm leading-snug text-white/50">{t}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function SignUpContent() {
  const steps = [
    ['Add your trucks', 'Make, model and engine can be picked from a catalogue of European truck models, or typed in.'],
    ['Enter what has happened to them', 'Service records, driver fault reports, odometer and engine hours, trips and documents.'],
    ['Read the ranked list', 'Each component gets a score from 0 to 100, the reasons behind it and what to inspect.'],
  ]
  return (
    <>
      <p className="text-[15px] font-medium text-amber">Set up in three steps</p>
      <h2 className="mt-3 font-display text-[clamp(2.2rem,3.6vw,3.2rem)] font-bold leading-[0.95] tracking-tight">From an empty fleet to a maintenance plan.</h2>
      <ol className="mt-8 divide-y divide-white/10 border-y border-white/10">
        {steps.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 py-4">
            <span className="num font-display text-2xl font-bold text-amber">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="block text-[17px] font-medium">{t}</span>
              <span className="mt-0.5 block text-[15px] text-white/60">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <ul className="mt-8 space-y-3 text-[15px] text-white/75">
        {['You become the Owner and can add managers, mechanics and drivers later.', 'No payment details are asked for.', 'Scores rank maintenance priority. They are not failure probabilities.'].map((t) => (
          <li key={t} className="flex gap-3"><Check className="mt-0.5 size-[18px] shrink-0 text-amber" /> {t}</li>
        ))}
      </ul>
    </>
  )
}
