import { createFileRoute } from '@tanstack/react-router'
import { CommentComposer } from '@/components/CommentComposer'
import { PostNav } from '@/components/PostNav'
import { EmptyState, GoalBar, OpenPostLink, PostThumb, StatGrid } from '@/components/ui'
import { SyncStatusInfo } from '@/components/SyncStatus'
import { filterPosts, validateListSearch } from '@/lib/filters'
import { platformLabel, postTitle } from '@/lib/platform'
import { useSiteData } from '@/lib/store'

export const Route = createFileRoute('/posts/$postId')({
  validateSearch: validateListSearch,
  component: PostDetail,
})

function PostDetail() {
  const { postId } = Route.useParams()
  const search = Route.useSearch()
  const data = useSiteData()
  const post = data.posts.find((p) => p.id === postId)
  if (!post) return <div className="mx-auto max-w-3xl px-5 pt-16"><EmptyState>This post no longer exists.</EmptyState></div>

  const campaign = data.campaigns.find((c) => c.id === post.campaignId)
  const list = filterPosts(data.posts, 'own', { ...search, campaign: search.campaign ?? post.campaignId })

  return (
    <div className="mx-auto max-w-4xl px-5 pt-10 space-y-6">
      <PostNav list={list} current={post} section="own" search={search} />
      <div className="glass rounded-3xl p-5 md:p-7 grid gap-6 md:grid-cols-[220px_1fr]">
        <PostThumb post={post} className="aspect-[4/5] w-full" />
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold-600">
              {campaign?.name} · {platformLabel[post.platform]} · {post.kind === 'lisa' ? 'LISA post' : 'Brand post'}
            </p>
            <h1 className="font-display text-3xl font-semibold text-gold-900">{postTitle(post)}</h1>
            <p className="mt-1 text-gold-800/80">{post.caption}</p>
            <OpenPostLink url={post.url}>Open on {platformLabel[post.platform]}</OpenPostLink>
          </div>
          <SyncStatusInfo />
          <StatGrid platform={post.platform} stats={post.stats} size="sm" />
          <GoalBar done={post.stats.comments} goal={post.commentGoal ?? 0} label="Comments on the post vs. goal" />
        </div>
      </div>
      <CommentComposer post={post} campaign={campaign} allowCaption />
      <PostNav list={list} current={post} section="own" search={search} />
    </div>
  )
}
