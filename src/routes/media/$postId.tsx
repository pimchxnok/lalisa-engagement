import { createFileRoute } from '@tanstack/react-router'
import { PostEngage } from '@/components/PostEngage'
import { PostNav } from '@/components/PostNav'
import { EmptyState, OpenPostLink } from '@/components/ui'
import { filterPosts, validateListSearch } from '@/lib/filters'
import { platformLabel, postTitle } from '@/lib/platform'
import { useSiteData } from '@/lib/store'

export const Route = createFileRoute('/media/$postId')({
  validateSearch: validateListSearch,
  component: MediaDetail,
})

function MediaDetail() {
  const { postId } = Route.useParams()
  const search = Route.useSearch()
  const data = useSiteData()
  const post = data.posts.find((p) => p.id === postId)
  if (!post) return <div className="mx-auto max-w-3xl px-5 pt-16"><EmptyState>This post no longer exists.</EmptyState></div>

  const campaign = data.campaigns.find((c) => c.id === post.campaignId)
  const tier = data.tiers.find((t) => t.id === post.tierId)
  const list = filterPosts(data.posts, 'media', { ...search, campaign: search.campaign ?? post.campaignId }, data.tiers)

  // Stats are already on the Media list, so the detail page goes straight to commenting and sharing
  return (
    <div className="mx-auto max-w-4xl px-5 pt-10 space-y-6">
      <PostNav list={list} current={post} section="media" search={search} />
      <div className="glass rounded-3xl p-5 md:p-7">
        <p className="text-xs uppercase tracking-[0.25em] text-gold-600">
          {campaign?.name} · {platformLabel[post.platform]} · {tier?.name ?? 'No tier'}
        </p>
        <h1 className="font-display text-3xl font-semibold text-gold-900">{postTitle(post)}</h1>
        <p className="mt-1 text-gold-800/80">{post.caption}</p>
        <OpenPostLink url={post.url}>Open on {platformLabel[post.platform]}</OpenPostLink>
      </div>
      <PostEngage key={post.id} post={post} campaign={campaign} allowCaption={false} />
      <PostNav list={list} current={post} section="media" search={search} />
    </div>
  )
}
