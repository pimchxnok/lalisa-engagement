import { createFileRoute } from '@tanstack/react-router'
import { PostCard } from '@/components/PostCard'
import { CampaignPicker, EmptyState, GoalBar, PlatformIcon, PlatformTabs, SectionTitle } from '@/components/ui'
import { filterPosts, validateListSearch } from '@/lib/filters'
import { formatNum, metricLabel, platformLabel, platforms, sumStats } from '@/lib/platform'
import { useActivity, useSiteData } from '@/lib/store'

export const Route = createFileRoute('/media/')({
  validateSearch: validateListSearch,
  component: MediaPage,
})

function MediaPage() {
  const data = useSiteData()
  const activity = useActivity()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const campaign = search.campaign ?? data.campaigns[0]?.id
  const s = { ...search, campaign }
  const tierOrder = data.tiers.map((t) => t.id)
  const season = filterPosts(data.posts, 'media', { campaign })
  const list = filterPosts(data.posts, 'media', s, tierOrder)
  const counts = Object.fromEntries([['all', season.length], ...platforms.map((p) => [p, season.filter((x) => x.platform === p).length])])
  const engaged = season.filter((p) => activity.engaged[p.id]).length
  const shared = season.filter((p) => activity.shared[p.id]).length

  const set = (patch: Partial<typeof s>) => navigate({ search: { ...s, ...patch }, replace: true, resetScroll: false })

  return (
    <div className="mx-auto max-w-6xl px-5 pt-12">
      <SectionTitle eyebrow="Media dashboard" title="Media Post">
        Every media outlet talking about LISA this season — engage, comment and share them to your story.
      </SectionTitle>
      <CampaignPicker campaigns={data.campaigns} value={campaign} onChange={(id) => set({ campaign: id, tier: undefined })} />

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-semibold text-gold-800">Overview</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {platforms.map((pl) => {
            const ps = season.filter((p) => p.platform === pl)
            const st = sumStats(ps)
            return (
              <button
                key={pl}
                onClick={() => set({ platform: pl })}
                className={`glass rounded-3xl p-5 text-left transition hover:-translate-y-0.5 ${s.platform === pl ? 'ring-2 ring-gold-400' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gold-800 font-medium">
                    <PlatformIcon platform={pl} /> {platformLabel[pl]}
                  </span>
                  <span className="font-display text-3xl font-semibold text-gold-800">{ps.length}</span>
                </div>
                <p className="text-xs text-gold-600 mb-3">media posts</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gold-800">
                  {(pl === 'ig-post' ? (['likes', 'comments', 'shares'] as const) : (['views', 'likes', 'comments'] as const)).map((k) => (
                    <span key={k}>
                      <b className="font-semibold">{formatNum(st[k])}</b> <span className="text-gold-600">{metricLabel[k]}</span>
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
        <div className="glass mt-4 grid gap-4 rounded-3xl p-5 md:grid-cols-2">
          <GoalBar done={engaged} goal={season.length} label="Reviewed progress · engaged" />
          <GoalBar done={shared} goal={season.length} label="Reviewed progress · shared to story" />
        </div>
      </section>

      <div className="mt-10 flex flex-col items-center gap-3">
        <PlatformTabs value={s.platform ?? 'all'} onChange={(p) => set({ platform: p })} counts={counts} />
        <div className="flex flex-wrap justify-center gap-2">
          <TierChip on={!s.tier} onClick={() => set({ tier: undefined })} label="All tiers" />
          {data.tiers.map((t) => (
            <TierChip
              key={t.id}
              on={s.tier === t.id}
              onClick={() => set({ tier: t.id })}
              label={`${t.name} · ${season.filter((p) => p.tierId === t.id).length}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <PostCard key={p.id} post={p} search={s} />
        ))}
      </div>
      {!list.length && <EmptyState>No media posts match these filters yet.</EmptyState>}
    </div>
  )
}

function TierChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm ${on ? 'chip-on' : 'border-gold-200 bg-white/50 text-gold-700 hover:border-gold-400'}`}
    >
      {label}
    </button>
  )
}
