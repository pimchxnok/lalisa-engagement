import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { CommentComposer } from '@/components/CommentComposer'
import { PostNav } from '@/components/PostNav'
import { StorySharePanel } from '@/components/StorySharePanel'
import { EmptyState, GoalBar, OpenPostLink, PostThumb, StatGrid } from '@/components/ui'
import { filterPosts, validateListSearch } from '@/lib/filters'
import { platformLabel } from '@/lib/platform'
import { updateActivity, useActivity, useSiteData } from '@/lib/store'

export const Route = createFileRoute('/media/$postId')({
  validateSearch: validateListSearch,
  component: MediaDetail,
})

function MediaDetail() {
  const { postId } = Route.useParams()
  const search = Route.useSearch()
  const data = useSiteData()
  const activity = useActivity()
  const post = data.posts.find((p) => p.id === postId)
  if (!post) return <div className="mx-auto max-w-3xl px-5 pt-16"><EmptyState>This post no longer exists.</EmptyState></div>

  const campaign = data.campaigns.find((c) => c.id === post.campaignId)
  const tier = data.tiers.find((t) => t.id === post.tierId)
  const list = filterPosts(data.posts, 'media', { ...search, campaign: search.campaign ?? post.campaignId }, data.tiers.map((t) => t.id))
  const engaged = !!activity.engaged[post.id]
  const done = post.communityComments + (activity.myComments[post.id] ?? 0)

  return (
    <div className="mx-auto max-w-4xl px-5 pt-10 space-y-6">
      <PostNav list={list} current={post} section="media" search={search} />
      <div className="glass rounded-3xl p-5 md:p-7 grid gap-6 md:grid-cols-[220px_1fr]">
        <PostThumb post={post} className="aspect-[4/5] w-full" />
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold-600">
              {campaign?.name} · {platformLabel[post.platform]} · {tier?.name ?? 'No tier'}
            </p>
            <h1 className="font-display text-3xl font-semibold text-gold-900">{post.account}</h1>
            <p className="mt-1 text-gold-800/80">{post.caption}</p>
            <OpenPostLink url={post.url}>Open on {platformLabel[post.platform]}</OpenPostLink>
          </div>
          <StatGrid platform={post.platform} stats={post.stats} size="sm" />
          <GoalBar done={done} goal={post.stats.comments} label="Fan comments vs. comments on the post" />
          <button
            onClick={() => updateActivity((a) => ({ ...a, engaged: { ...a.engaged, [post.id]: !engaged } }))}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow ${
              engaged ? 'bg-white text-emerald-700 border border-emerald-300' : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            <Check className="size-4" /> {engaged ? 'Engaged — undo' : 'I liked & engaged this post ✓'}
          </button>
        </div>
      </div>
      <CommentComposer post={post} campaign={campaign} allowCaption={false} />
      {post.platform !== 'tiktok' && <StorySharePanel post={post} campaign={campaign} />}
      <PostNav list={list} current={post} section="media" search={search} />
    </div>
  )
}
