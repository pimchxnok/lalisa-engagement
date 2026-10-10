/**
 * src/routes/media/index.tsx
 * Media list page with sync status
 */

import { createFileRoute } from '@tanstack/react-router'
import { PostCard } from '@/components/PostCard'

import { CampaignPicker, EmptyState, GoalBar, PlatformIcon, PlatformTabs, SectionTitle } from '@/components/ui'
import { SyncStatusBadge } from '@/components/SyncStatus'
import { filterPosts, tiersFor, validateListSearch } from '@/lib/filters'
import { formatNum, metricLabel, platformLabel, platforms, sumStats } from '@/lib/platform'
import { useActivity, useSiteData } from '@/lib/store'
import type { Platform } from '@/lib/types'
import { BackLink } from '@/components/PostNav'


export const Route = createFileRoute('/media')({
  validateSearch: validateListSearch,
  component: MediaList,
})

function MediaList() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const data = useSiteData()
  const activity = useActivity()
  const campaign = search.campaign ?? data.campaigns[0]?.id
  const s = { ...search, campaign }
  const season = filterPosts(data.posts, 'media', { campaign })
  const list = filterPosts(data.posts, 'media', s, data.tiers)
  const activePlatform: Platform | undefined =
    s.platform && s.platform !== 'all' ? s.platform : undefined
  const counts = Object.fromEntries([
    ['all', season.length],
    ...platforms.map((p) => [
      p,
      season.filter((post) => post.platform === p).length,
    ]),
  ])
  const engaged = season.filter((post) => activity.engaged[post.id]).length
  const shared = season.filter((post) => activity.shared[post.id]).length
  const set = (patch: Partial<typeof s>) =>
    navigate({
      search: { ...s, ...patch },
      replace: true,
      resetScroll: false,
    })
  return (
    <div className="mx-auto max-w-6xl px-5 pt-12">
      <div className="mb-8 flex items-center justify-between">
        <BackLink campaign={campaign} />
        <SyncStatusBadge compact />
      </div>
      <SectionTitle eyebrow="Media dashboard" title="Media Post">
        Every media outlet talking about LISA this season — engage, comment and share them to your story.
      </SectionTitle>
      <CampaignPicker
        campaigns={data.campaigns}
        value={campaign}
        onChange={(id) => set({ campaign: id, tier: undefined })}
      />
      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-semibold text-gold-800">
          Overview
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {platforms.map((pl) => {
            const ps = season.filter((post) => post.platform === pl)
            const st = sumStats(ps)
            return (
              <button
                key={pl}
                onClick={() => set({ platform: pl, tier: undefined })}
                className={`glass rounded-3xl p-5 text-left transition hover:-translate-y-0.5 ${
                  s.platform === pl ? 'ring-2 ring-gold-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gold-800 font-medium">
                    <PlatformIcon platform={pl} /> {platformLabel[pl]}
                  </span>
                  <span className="font-display text-3xl font-semibold text-gold-800">
                    {ps.length}
                  </span>
                </div>
                <p className="text-xs text-gold-600 mb-3">media posts</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gold-800">
                  {(pl === 'ig-post'
                    ? (['likes', 'comments', 'shares'] as const)
                    : (['views', 'likes', 'comments'] as const)
                  ).map((k) => (
                    <span key={k}>
                      <b className="font-semibold">{formatNum(st[k])}</b>{' '}
                      <span className="text-gold-600">{metricLabel[k]}</span>
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
        <div className="glass mt-4 grid gap-4 rounded-3xl p-5 md:grid-cols-2">
          <GoalBar
            done={engaged}
            goal={season.length}
            label="Reviewed progress · engaged"
          />
          <GoalBar
            done={shared}
            goal={season.length}
            label="Reviewed progress · shared to story"
          />
        </div>
      </section>
      <div className="mt-10 flex flex-col items-center gap-3">
        <PlatformTabs
          value={s.platform ?? 'all'}
          onChange={(p) => set({ platform: p, tier: undefined })}
          counts={counts}
        />
        <div className="flex flex-col items-center gap-2">
          {(activePlatform ? [activePlatform] : platforms).map((pl: Platform) => {
            const tiers = tiersFor(data.tiers, pl)
            return (
              <div
                key={pl}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {!activePlatform && (
                  <span className="flex w-36 items-center justify-end gap-1.5 text-xs text-gold-600">
                    <PlatformIcon platform={pl} className="size-3.5" />
                    {platformLabel[pl]}
                  </span>
                )}
                {activePlatform && (
                  <TierChip
                    on={!s.tier}
                    onClick={() => set({ tier: undefined })}
                    label="All tiers"
                  />
                )}
                {tiers.map((t) => (
                  <TierChip
                    key={t.id}
                    on={s.tier === t.id}
                    onClick={() => set({ platform: pl, tier: t.id })}
                    label={`${t.name} · ${
                      season.filter((post) => post.tierId === t.id).length
                    }`}
                  />
                ))}
                {!tiers.length && (
                  <span className="text-xs text-gold-500">
                    No tiers set for {platformLabel[pl]} yet
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <SectionTitle
        eyebrow={data.campaigns.find((item) => item.id === campaign)?.name || 'Media coverage'}
        title="Engage media posts about LISA"
      >
        Every like, comment and share on these posts counts toward LISA's exposure. Share to your story, like, comment, repost.
      </SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        {list.map((post) => (
          <PostCard key={post.id} post={post} search={s} />
        ))}
      </div>
      {list.length === 0 && (
        <p className="text-center text-gold-600">
          No media posts found for this campaign.
        </p>
      )}
    </div>
  )
}
    
