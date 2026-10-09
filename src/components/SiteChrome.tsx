import { Link } from '@tanstack/react-router'
import { KeyRound, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useSiteData } from '@/lib/store'

const nav = [
  { to: '/', label: 'Home' },
  { to: '/posts', label: 'LISA & Brand Post' },
  { to: '/media', label: 'Media Post' },
  { to: '/tips', label: 'Engagement Tips' },
] as const

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-gold-200/60 bg-ivory/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === '/' }}
              className="rounded-full px-4 py-2 text-sm tracking-wide text-gold-800 hover:bg-gold-100/70"
              activeProps={{ className: 'btn-gold !text-white' }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button className="md:hidden p-2 text-gold-800" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link to="/" className="ml-auto font-display text-lg font-semibold tracking-[0.25em] gold-text">
          LISA ENGAGEMENT
        </Link>
      </div>
      {open && (
        <nav className="md:hidden border-t border-gold-200/60 px-5 py-3 flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: n.to === '/' }}
              className="rounded-xl px-4 py-2.5 text-gold-800"
              activeProps={{ className: 'bg-gold-100' }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}

export function SiteFooter() {
  const { settings } = useSiteData()
  return (
    <footer className="mt-20 border-t border-gold-200/60 bg-white/30 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center">
        <p className="font-display text-xl tracking-[0.3em] gold-text">LISA ENGAGEMENT</p>
        <p className="text-xs text-gold-700/80 max-w-xl">{settings.credits}</p>
        <Link
          to="/studio"
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-gold-300 px-4 py-1.5 text-xs text-gold-700 hover:bg-gold-100/70"
        >
          <KeyRound className="size-3.5" /> Owner Studio
        </Link>
      </div>
    </footer>
  )
}
