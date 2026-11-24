/**
 * The brand image already contains the name, so it is used on its own.
 * It is a transparent PNG with a white truck, so it is meant for dark surfaces.
 */
const HEIGHT = { md: 'h-14', lg: 'h-16', nav: 'h-16' }

export function Logo({ className = '', size = 'md' }: { className?: string; size?: 'md' | 'lg' | 'nav' }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img src="/logo.png" alt="Fleet Predict" className={`w-auto ${HEIGHT[size]}`} />
    </span>
  )
}
