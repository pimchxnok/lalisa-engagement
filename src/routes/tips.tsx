import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { EmptyState, OpenPostLink, SectionTitle } from '@/components/ui'
import { useSiteData } from '@/lib/store'
import { tipCategories } from '@/lib/platform'
import type { TipCategory } from '@/lib/types'

export const Route = createFileRoute('/tips')({
  component: TipsPage,
})

function TipsPage() {
  const { tips } = useSiteData()
  const [cat, setCat] = useState<TipCategory | 'all'>('all')
  const list = tips.filter((t) => cat === 'all' || t.category === cat)

  return (
    <div className="mx-auto max-w-5xl px-5 pt-12">
      <SectionTitle eyebrow="Engage smarter" title="Engagement Tips">
        How EMV and MIV work, and how to make every like, share, comment and repost count.
      </SectionTitle>
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {(['all', ...tipCategories] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? 'chip-on' : 'border-gold-200 bg-white/50 text-gold-700'}`}
          >
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {list.map((t) => (
          <article key={t.id} className="glass rounded-3xl p-6">
            <span className="rounded-full bg-gold-100 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-gold-700">{t.category}</span>
            <h2 className="mt-3 font-display text-2xl font-semibold text-gold-900">{t.title}</h2>
            <p className="mt-2 whitespace-pre-line text-gold-800/85 leading-relaxed">{t.body}</p>
            {t.link && (
              <div className="mt-3">
                <OpenPostLink url={t.link}>Read more</OpenPostLink>
              </div>
            )}
          </article>
        ))}
      </div>
      {!list.length && <EmptyState>Tips for this topic are coming soon.</EmptyState>}
    </div>
  )
}
