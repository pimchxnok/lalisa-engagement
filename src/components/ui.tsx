import { ExternalLink, ImageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatNum, metricLabel, platformLabel, platformMetrics, platforms } from '@/lib/platform'
import type { Campaign, Platform, Post, Stats } from '@/lib/types'

export function PlatformIcon({ platform, className = 'size-4' }: { platform: Platform; className?: string }) {
  if (platform === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1 0-5.2c.27 0 .53.04.78.12V9.66a5.73 5.73 0 0 0-.78-.05 5.69 5.69 0 1 0 5.69 5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="text-center mb-10">
      {eyebrow && <p className="uppercase tracking-[0.35em] text-[11px] text-gold-600 mb-3">{eyebrow}</p>}
      <h1 className="font-display text-4xl md:text-5xl font-semibold gold-text leading-tight">{title}</h1>
      {children && <p className="mt-4 text-gold-800/80 max-w-2xl mx-auto">{children}</p>}
      <div className="gold-rule w-40 mx-auto mt-6" />
    </div>
  )
}

export function CampaignPicker({
  campaigns,
  value,
  onChange,
}: {
  campaigns: Campaign[]
  value?: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {campaigns.map((c) => {
        const on = c.id === value
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={`group rounded-2xl px-5 py-3 text-left transition-all border ${
              on ? 'btn-gold border-transparent' : 'glass hover:-translate-y-0.5 hover:border-gold-400'
            }`}
          >
            <span className={`block font-display text-xl font-semibold ${on ? '' : 'text-gold-800'}`}>{c.name}</span>
            <span className={`block text-xs tracking-wide ${on ? 'text-white/85' : 'text-gold-700/70'}`}>
              {c.brand} · {c.season}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function PlatformTabs({
  value,
  onChange,
  counts,
}: {
  value: Platform | 'all'
  onChange: (p: Platform | 'all') => void
  counts?: Partial<Record<Platform | 'all', number>>
}) {
  const items: (Platform | 'all')[] = ['all', ...platforms]
  return (
    <div className="glass inline-flex flex-wrap justify-center gap-1 rounded-full p-1">
      {items.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
            value === p ? 'btn-gold' : 'text-gold-800 hover:bg-gold-100/70'
          }`}
        >
          {p !== 'all' && <PlatformIcon platform={p} />}
          {p === 'all' ? 'All platforms' : platformLabel[p]}
          {counts?.[p] !== undefined && <span className="text-xs opacity-70">{counts[p]}</span>}
        </button>
      ))}
    </div>
  )
}

export function StatGrid({ platform, stats, size = 'md' }: { platform: Platform; stats: Stats; size?: 'sm' | 'md' }) {
  const keys = platformMetrics[platform]
  return (
    <div className={`grid gap-2 ${size === 'sm' ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'}`}>
      {keys.map((k) => (
        <div key={k} className="rounded-xl bg-white/50 border border-gold-200/70 px-2 py-2 text-center">
          <div className={`font-display font-semibold text-gold-800 ${size === 'sm' ? 'text-lg' : 'text-2xl'}`}>
            {formatNum(stats[k])}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-600">{metricLabel[k]}</div>
        </div>
      ))}
    </div>
  )
}

export function PostThumb({ post, className = '' }: { post: Post; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-gold-100 via-white to-gold-200 ${className}`}>
      {post.thumbnail ? (
        <img src={post.thumbnail} alt={post.caption || post.account} referrerPolicy="no-referrer" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gold-500">
          <ImageIcon className="size-7" strokeWidth={1.3} />
          <span className="text-[10px] uppercase tracking-[0.2em]">No cover yet</span>
        </div>
      )}
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[10px] font-medium text-gold-800 backdrop-blur">
        <PlatformIcon platform={post.platform} className="size-3" />
        {platformLabel[post.platform]}
      </span>
    </div>
  )
}

export function GoalBar({ done, goal, label }: { done: number; goal: number; label: string }) {
  const pct = goal > 0 ? Math.min(100, (done / goal) * 100) : 0
  const reached = goal > 0 && done >= goal
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gold-700">{label}</span>
        <span className={`font-medium ${reached ? 'text-emerald-600' : 'text-gold-800'}`}>
          {done.toLocaleString('en-US')} / {goal.toLocaleString('en-US')}
          {reached ? ' · Goal reached ✓' : ` · ${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gold-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-400' : 'bg-gradient-to-r from-gold-300 to-gold-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function OpenPostLink({ url, children = 'Open post' }: { url: string; children?: ReactNode }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-gold-700 hover:text-gold-900 underline-offset-4 hover:underline"
    >
      {children} <ExternalLink className="size-3.5" />
    </a>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="glass rounded-2xl p-10 text-center text-gold-700">{children}</div>
}
