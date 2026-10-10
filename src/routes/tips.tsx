/**
 * src/routes/tips.tsx
 * Engagement tips page with sync badge
 */

import { createFileRoute } from '@tanstack/react-router'
import { SectionTitle } from '@/components/ui'
import { SyncStatusBadge } from '@/components/SyncStatus'
import { useSiteData } from '@/lib/store'
import { tipCategories } from '@/lib/platform'

export const Route = createFileRoute('/tips')({
  component: Tips,
})

function Tips() {
  const data = useSiteData()
  const categories = tipCategories

  return (
    <div className="mx-auto max-w-4xl px-5 pt-10">
      <div className="mb-8 flex justify-end">
        <SyncStatusBadge compact />
      </div>
      <SectionTitle title="Engagement Tips" eyebrow="How to help">
        Learn what drives engagement and how your efforts matter.
      </SectionTitle>
      {categories.map((cat) => {
        const tips = data.tips.filter((t) => t.category === cat)
        return (
          <section key={cat} className="mb-12">
            <h2 className="font-display text-2xl font-semibold text-gold-800 mb-4">{cat}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {tips.map((tip) => (
                <div key={tip.id} className="glass rounded-2xl p-5">
                  <h3 className="font-medium text-gold-900 mb-2">{tip.title}</h3>
                  <p className="text-sm text-gold-800/80 mb-3">{tip.body}</p>
                  {tip.link && (
                    <a href={tip.link} target="_blank" rel="noreferrer" className="text-xs text-gold-700 hover:text-gold-900 underline">
                      Learn more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
