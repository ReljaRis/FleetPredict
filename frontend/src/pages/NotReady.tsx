import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

export default function NotReady({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center gap-4 bg-night px-8 text-white sm:items-center sm:text-center">
      <Logo />
      <h1 className="font-display text-4xl font-semibold">{title}</h1>
      <p className="max-w-md text-white/70">The address you opened does not exist.</p>
      <Link to="/" className="text-amber underline underline-offset-4">
        Back to the start page
      </Link>
    </main>
  )
}
