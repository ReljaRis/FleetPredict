export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="1" y="13" width="4" height="8" fill="currentColor" />
        <rect x="7" y="9" width="4" height="12" fill="currentColor" />
        <rect x="13" y="5" width="4" height="16" fill="currentColor" />
        <rect x="19" y="1" width="3" height="20" fill="var(--color-amber)" />
      </svg>
      <span className="font-display text-[22px] font-semibold tracking-tight">Fleet Predict</span>
    </span>
  )
}
