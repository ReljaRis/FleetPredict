import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Inbox, Loader2, X } from 'lucide-react'
import { STATUS_LABEL } from '../lib/format'

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean }

export function Button({ variant = 'secondary', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-night text-white border-transparent hover:bg-night-2',
    secondary: 'bg-white text-ink border-line-strong hover:bg-sunken',
    ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-sunken hover:text-ink',
    danger: 'bg-white text-critical border-critical/40 hover:bg-critical-soft',
  }[variant]
  const s = size === 'sm' ? 'h-8 px-3 text-sm gap-1.5' : 'h-10 px-4 text-[15px] gap-2'
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border font-medium transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${v} ${s} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Tags ---------- */
const STATUS_DOT: Record<string, string> = { OPERATIONAL: 'bg-low', IN_SERVICE: 'bg-moderate', OUT_OF_SERVICE: 'bg-ink-3', HIGH_RISK: 'bg-critical' }

export function StatusTag({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm ${status === 'HIGH_RISK' ? 'font-medium text-critical' : 'text-ink-2'}`}>
      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

const RISK: Record<string, { label: string; cls: string }> = {
  LOW: { label: 'Low', cls: 'bg-low-soft text-low' },
  MODERATE: { label: 'Moderate', cls: 'bg-moderate-soft text-moderate' },
  HIGH: { label: 'High', cls: 'bg-high-soft text-high' },
  CRITICAL: { label: 'Critical', cls: 'bg-critical text-white' },
}

export function RiskTag({ category, score }: { category: string; score?: number }) {
  const r = RISK[category]
  return (
    <span className={`num inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-semibold ${r.cls}`}>
      {score !== undefined && <span>{score}</span>}
      {r.label}
    </span>
  )
}

export function DemoTag() {
  return <span className="rounded-sm border border-dashed border-current px-1.5 py-px text-[10px] font-semibold tracking-wide text-amber">DEMO DATA</span>
}

/* ---------- Page states ---------- */
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <div className="h-3 w-14 animate-pulse rounded-sm bg-sunken" />
          <div className="h-3 flex-1 animate-pulse rounded-sm bg-sunken" style={{ maxWidth: `${64 - (i % 3) * 12}%` }} />
          <div className="ml-auto h-3 w-20 animate-pulse rounded-sm bg-sunken" />
        </div>
      ))}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-line-strong px-6 py-12 sm:items-center sm:text-center">
      <Inbox className="size-5 text-ink-3" />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-md text-sm text-ink-3">{body}</p>
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border border-critical/30 bg-critical-soft/50 px-6 py-8">
      <AlertCircle className="size-5 text-critical" />
      <div>
        <p className="font-semibold text-ink">This could not be loaded</p>
        <p className="mt-1 text-sm text-ink-2">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/* ---------- Drawer ---------- */
export function Drawer({ open, onClose, title, sub, children, footer }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-night/60" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-ink-3">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string; kind: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm shadow-lg ${t.kind === 'error' ? 'border-critical/40 bg-white text-critical' : 'border-line bg-night text-white'}`}>
            {t.kind === 'error' ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Severity, fault status and document status tags ---------- */
const SEV: Record<string, string> = { LOW: 'bg-sunken text-ink-2', MEDIUM: 'bg-moderate-soft text-moderate', HIGH: 'bg-high-soft text-high', CRITICAL: 'bg-critical text-white' }
export function SeverityTag({ severity }: { severity: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-semibold ${SEV[severity]}`}>{severity.charAt(0) + severity.slice(1).toLowerCase()}</span>
}

const FSTAT: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Open', cls: 'border border-ink/40 text-ink' },
  UNDER_INSPECTION: { label: 'Under inspection', cls: 'border border-night/50 bg-canvas text-ink' },
  RESOLVED: { label: 'Resolved', cls: 'text-ink-3 line-through decoration-ink-3/40' },
}
export function FaultStatusTag({ status }: { status: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium ${FSTAT[status].cls}`}>{FSTAT[status].label}</span>
}

const DSTAT: Record<string, { label: string; cls: string }> = {
  GREEN: { label: 'Valid', cls: 'bg-low-soft text-low' },
  YELLOW: { label: 'Due soon', cls: 'bg-moderate-soft text-moderate' },
  RED: { label: 'Urgent', cls: 'bg-high-soft text-high' },
  EXPIRED: { label: 'Expired', cls: 'bg-critical text-white' },
}
export function DocStatusTag({ status, days }: { status: string; days?: number }) {
  return (
    <span className={`num inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-semibold ${DSTAT[status].cls}`}>
      {DSTAT[status].label}
      {days !== undefined && status !== 'GREEN' && <span className="font-medium">{days < 0 ? `${-days} d ago` : `${days} d left`}</span>}
    </span>
  )
}
