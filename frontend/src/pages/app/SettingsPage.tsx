import { useEffect, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button, ErrorState, LoadingRows, useToast } from '../../components/ui'
import { FormDrawer, type Field } from '../../components/FormDrawer'
import CostsTab from './CostsTab'
import { api, ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { useAuth, type Role } from '../../lib/auth'
import { can } from '../../lib/permissions'
import { fmtDate } from '../../lib/format'
import type { CompanyInfo, UserRow } from '../../lib/types'

type Tab = 'company' | 'notifications' | 'costs' | 'users' | 'account'
const input = 'mt-2 block h-11 w-full max-w-md rounded-md border bg-white px-3 text-[15px] focus:outline-2 focus:outline-offset-1 focus:outline-amber disabled:bg-sunken disabled:text-ink-2'
const ROLE: Record<Role, string> = { OWNER: 'Owner', MANAGER: 'Manager', MECHANIC: 'Mechanic', DRIVER: 'Driver' }
const ROLE_NOTE: Record<Role, string> = {
  OWNER: 'Everything, including company settings and users.',
  MANAGER: 'Fleet, maintenance, documents, routes and cost assumptions.',
  MECHANIC: 'Maintenance records, fault reports and readings.',
  DRIVER: 'Their assigned vehicle and fault reporting.',
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {sub && <p className="mt-1 max-w-3xl text-sm text-ink-3">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Labeled({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {children}
      </label>
      {hint && !error && <p className="mt-2 text-xs text-ink-3">{hint}</p>}
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
    </div>
  )
}

/** Runs a save request and maps server field errors to the form. */
function useSave() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  async function run(fn: () => Promise<unknown>, ok: string): Promise<boolean> {
    setBusy(true)
    setErrors({})
    try {
      await fn()
      toast(ok)
      return true
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields ?? {})
        toast(e.fields && Object.keys(e.fields).length ? 'Some fields need attention.' : e.message, 'error')
      } else toast('Something went wrong.', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, errors, run }
}

/* ---------------- Company ---------------- */
function CompanyTab() {
  const { session } = useAuth()
  const canWrite = can(session?.user.role, 'company:write')
  const { data, loading, error, reload } = useApi<{ company: CompanyInfo }>('/company')
  const [v, setV] = useState({ name: '', country: '', vatId: '' })
  const { busy, errors, run } = useSave()
  useEffect(() => { if (data) setV({ name: data.company.name, country: data.company.country, vatId: data.company.vatId }) }, [data])
  if (loading && !data) return <LoadingRows rows={3} />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />
  return (
    <Section title="Company" sub={canWrite ? undefined : 'Only the owner can change company details.'}>
      <form className="space-y-6" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/company', { method: 'PUT', body: v }), 'Company details saved.')) window.location.reload() }}>
        <Labeled label="Company name" error={errors.name}><input value={v.name} disabled={!canWrite} onChange={(e) => setV({ ...v, name: e.target.value })} className={`${input} ${errors.name ? 'border-critical' : 'border-line'}`} /></Labeled>
        <Labeled label="Country"><input value={v.country} disabled={!canWrite} onChange={(e) => setV({ ...v, country: e.target.value })} className={`${input} border-line`} /></Labeled>
        <Labeled label="VAT ID"><input value={v.vatId} disabled={!canWrite} onChange={(e) => setV({ ...v, vatId: e.target.value })} className={`${input} border-line`} /></Labeled>
        {canWrite && <Button type="submit" variant="primary" loading={busy}>Save company details</Button>}
      </form>
    </Section>
  )
}

/* ---------------- Notifications ---------------- */
const REMINDERS: [number, string][] = [[90, '90 days before'], [60, '60 days before'], [30, '30 days before'], [14, '14 days before'], [7, '7 days before'], [3, '3 days before'], [1, '1 day before'], [0, 'When it expires']]

function NotificationsTab() {
  const { session } = useAuth()
  const canWrite = can(session?.user.role, 'document:write')
  const { data, loading, error, reload } = useApi<{ company: CompanyInfo; emailConfigured: boolean }>('/company')
  const [email, setEmail] = useState(true)
  const [inApp, setInApp] = useState(true)
  const [th, setTh] = useState<number[]>([])
  const { busy, errors, run } = useSave()
  useEffect(() => { if (data) { setEmail(data.company.notifyEmail); setInApp(data.company.notifyInApp); setTh(data.company.notifyThresholds) } }, [data])
  if (loading && !data) return <LoadingRows rows={4} />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />
  const toggle = (n: number) => setTh((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))
  return (
    <Section title="Notifications" sub="Document reminders go to the owner and managers. Each reminder is sent once per document. Critical maintenance alerts appear in the app.">
      <form className="space-y-8" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api('/company/notifications', { method: 'PUT', body: { notifyEmail: email, notifyInApp: inApp, notifyThresholds: th } }), 'Notification settings saved.')) reload() }}>
        <fieldset disabled={!canWrite} className="space-y-4">
          <legend className="text-sm font-medium">Remind me about expiring documents</legend>
          <div className="grid max-w-md grid-cols-2 gap-x-6 gap-y-3">
            {REMINDERS.map(([n, l]) => (
              <label key={n} className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={th.includes(n)} onChange={() => toggle(n)} className="size-4 accent-night" /> {l}</label>
            ))}
          </div>
          {errors.notifyThresholds && <p className="text-sm text-critical">{errors.notifyThresholds}</p>}
        </fieldset>
        <fieldset disabled={!canWrite} className="space-y-4">
          <legend className="text-sm font-medium">Where</legend>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} className="size-4 accent-night" /> In the app (bell icon)</label>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="size-4 accent-night" /> By email</label>
          {email && !data.emailConfigured && <p className="max-w-lg border-l-2 border-moderate pl-3 text-sm text-ink-2">Email delivery is not set up on this server (no SMTP settings), so reminders are shown in the app only. The server needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM to send them.</p>}
        </fieldset>
        {canWrite ? <Button type="submit" variant="primary" loading={busy}>Save notification settings</Button> : <p className="text-sm text-ink-3">Only owners and managers can change these settings.</p>}
      </form>
    </Section>
  )
}

/* ---------------- Users and roles ---------------- */
const userFields: Field[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, span: true },
  { name: 'email', label: 'Email', type: 'text', required: true, span: true },
  { name: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'MANAGER', label: 'Manager' }, { value: 'MECHANIC', label: 'Mechanic' }, { value: 'DRIVER', label: 'Driver' }] },
  { name: 'password', label: 'Temporary password', type: 'text', required: true, hint: 'At least 8 characters. Share it with the person; they can change it under Account.' },
]

function UsersTab() {
  const { session } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi<UserRow[]>('/company/users')
  const [adding, setAdding] = useState(false)
  async function patch(u: UserRow, body: Record<string, unknown>, ok: string) {
    try {
      await api(`/company/users/${u.id}`, { method: 'PATCH', body })
      toast(ok)
      reload()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    }
  }
  if (loading && !data) return <LoadingRows rows={4} />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />
  return (
    <Section title="Users and roles" sub="Permissions are enforced by the server for every action, not only in the screens.">
      <div className="mb-4"><Button variant="primary" onClick={() => setAdding(true)}><Plus className="size-4" /> Add user</Button></div>
      <ul className="divide-y divide-line border-y border-line bg-white">
        {data.map((u) => {
          const self = u.id === session?.user.id
          return (
            <li key={u.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_11rem_auto] ${u.active ? '' : 'opacity-60'}`}>
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}{self && <span className="ml-2 text-sm font-normal text-ink-3">(you)</span>}{!u.active && <span className="ml-2 text-sm font-normal text-ink-3">Deactivated</span>}</p>
                <p className="truncate text-sm text-ink-3">{u.email} · added {fmtDate(u.createdAt)}</p>
              </div>
              {u.role === 'OWNER' || self ? (
                <span className="text-[15px] text-ink-2">{ROLE[u.role]}</span>
              ) : (
                <select aria-label={`Role of ${u.name}`} value={u.role} onChange={(e) => patch(u, { role: e.target.value }, 'Role updated.')} className="h-9 rounded-md border border-line-strong bg-white px-2 text-[15px]">
                  {(['MANAGER', 'MECHANIC', 'DRIVER'] as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
                </select>
              )}
              {u.role === 'OWNER' || self ? <span /> : <Button size="sm" variant={u.active ? 'ghost' : 'secondary'} onClick={() => patch(u, { active: !u.active }, u.active ? 'User deactivated. They can no longer sign in.' : 'User reactivated.')}>{u.active ? 'Deactivate' : 'Reactivate'}</Button>}
            </li>
          )
        })}
      </ul>
      <dl className="mt-6 grid max-w-3xl gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        {(Object.keys(ROLE) as Role[]).map((r) => (
          <div key={r} className="contents"><dt className="font-medium">{ROLE[r]}</dt><dd className="text-ink-3">{ROLE_NOTE[r]}</dd></div>
        ))}
      </dl>
      <FormDrawer open={adding} onClose={() => setAdding(false)} title="Add user" sub="The person signs in with this email and password." fields={userFields} initial={{ name: '', email: '', role: 'MANAGER', password: '' }} submitLabel="Add user" successText="User added." onSubmit={(v) => api('/company/users', { body: v })} onDone={reload} />
    </Section>
  )
}

/* ---------------- Account ---------------- */
function AccountTab() {
  const { session } = useAuth()
  const [name, setName] = useState(session?.user.name ?? '')
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })
  const profile = useSave()
  const password = useSave()
  if (!session) return null
  return (
    <div className="space-y-16">
      <Section title="Profile">
        <form className="space-y-6" onSubmit={async (e) => { e.preventDefault(); if (await profile.run(() => api('/auth/profile', { method: 'PUT', body: { name } }), 'Profile saved.')) window.location.reload() }}>
          <Labeled label="Name" error={profile.errors.name}><input value={name} onChange={(e) => setName(e.target.value)} className={`${input} ${profile.errors.name ? 'border-critical' : 'border-line'}`} /></Labeled>
          <Labeled label="Email"><input value={session.user.email} disabled className={`${input} border-line`} /></Labeled>
          <p className="text-sm text-ink-3">Role: {ROLE[session.user.role]}. {ROLE_NOTE[session.user.role]}</p>
          <Button type="submit" variant="primary" loading={profile.busy}>Save profile</Button>
        </form>
      </Section>
      <Section title="Change password">
        <form className="space-y-6" onSubmit={async (e) => { e.preventDefault(); if (await password.run(() => api('/auth/password', { body: pw }), 'Password changed.')) setPw({ currentPassword: '', newPassword: '' }) }}>
          <Labeled label="Current password" error={password.errors.currentPassword}><input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className={`${input} ${password.errors.currentPassword ? 'border-critical' : 'border-line'}`} /></Labeled>
          <Labeled label="New password" error={password.errors.newPassword} hint="At least 8 characters."><input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className={`${input} ${password.errors.newPassword ? 'border-critical' : 'border-line'}`} /></Labeled>
          <Button type="submit" variant="primary" loading={password.busy}>Change password</Button>
        </form>
      </Section>
    </div>
  )
}

export default function SettingsPage() {
  const { session } = useAuth()
  const role = session?.user.role
  const tabs: [Tab, string][] = [['company', 'Company'], ['notifications', 'Notifications'], ['costs', 'Costs and intervals'], ...(can(role, 'users:write') ? ([['users', 'Users and roles']] as [Tab, string][]) : []), ['account', 'Account']]
  const [tab, setTab] = useState<Tab>('company')
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-none tracking-tight">Settings</h1>
      <div role="tablist" className="mt-6 flex overflow-x-auto border-b border-line">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[15px] ${tab === k ? 'border-night font-semibold' : 'border-transparent text-ink-3 hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-8">
        {tab === 'company' && <CompanyTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'costs' && <CostsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'account' && <AccountTab />}
      </div>
    </div>
  )
}
