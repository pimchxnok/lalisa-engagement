import { createFileRoute } from '@tanstack/react-router'
import { PostCard } from '@/components/PostCard'
import { CampaignPicker, EmptyState, PlatformTabs, SectionTitle } from '@/components/ui'
import { filterPosts, validateListSearch } from '@/lib/filters'
import { platforms } from '@/lib/platform'
import { useSiteData } from '@/lib/store'

export const Route = createFileRoute('/posts/')({
  validateSearch: validateListSearch,
  component: PostsPage,
})

function PostsPage() {
  const data = useSiteData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const campaign = search.campaign ?? data.campaigns[0]?.id
  const s = { ...search, campaign }
  const list = filterPosts(data.posts, 'own', s)
  const base = filterPosts(data.posts, 'own', { campaign, kind: s.kind })
  const counts = Object.fromEntries([['all', base.length], ...platforms.map((p) => [p, base.filter((x) => x.platform === p).length])])

  const set = (patch: Partial<typeof s>) => navigate({ search: { ...s, ...patch }, replace: true, resetScroll: false })

  return (
    <div className="mx-auto max-w-6xl px-5 pt-12">
      <SectionTitle eyebrow="Comment one post at a time" title="LISA & Brand Post">
        Pick a campaign and platform, open a post, grab a ready-made comment and log it when you’re done.
      </SectionTitle>
      <CampaignPicker campaigns={data.campaigns} value={campaign} onChange={(id) => set({ campaign: id })} />
      <div className="mt-6 flex flex-col items-center gap-3">
        <PlatformTabs value={s.platform ?? 'all'} onChange={(p) => set({ platform: p })} counts={counts} />
        <div className="inline-flex rounded-full border border-gold-200 bg-white/50 p-0.5 text-sm">
          {(['all', 'lisa', 'brand'] as const).map((k) => (
            <button
              key={k}
              onClick={() => set({ kind: k })}
              className={`rounded-full px-4 py-1.5 ${(s.kind ?? 'all') === k ? 'bg-gold-500 text-white' : 'text-gold-700'}`}
            >
              {k === 'all' ? 'All posts' : k === 'lisa' ? 'LISA posts' : 'Brand posts'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <PostCard key={p.id} post={p} search={s} />
        ))}
      </div>
      {!list.length && <EmptyState>No posts here yet — the owner can add them from Owner Studio.</EmptyState>}
    </div>
  )
}
