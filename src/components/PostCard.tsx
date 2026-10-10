import { Link } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import { EngageRibbon } from './EngageStatus'
import { GoalBar, OpenPostLink, PostThumb, StatGrid } from './ui'
import { engageStatus } from '@/lib/engagement'
import type { ListSearch } from '@/lib/filters'
import { useActivity, useSiteData } from '@/lib/store'
import type { Post } from '@/lib/types'
import { postTitle, platformLabel } from '@/lib/platform'

const kindLabel = { lisa: 'LISA', brand: 'Brand', media: 'Media' }

export function PostCard({ post, search }: { post: Post; search: ListSearch }) {
  const data = useSiteData()
  const activity = useActivity()
  const isMedia = post.kind === 'media'
  const tier = data.tiers.find((t) => t.id === post.tierId)

  // Media posts use their comment count as the display goal
  const displayGoal = isMedia ? post.stats.comments : (post.commentGoal ?? 0)

  return (
    <article className="glass relative rounded-3xl p-4 pt-9 flex flex-col gap-4">
      <EngageRibbon post={post} status={engageStatus(activity, post)} />
      <div className="flex gap-4">
        {!isMedia && <PostThumb post={post} className="size-28 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gold-700">
              {kindLabel[post.kind]}
            </span>
            {isMedia && <span className="text-xs text-gold-600">{platformLabel[post.platform]}</span>}
            {tier && (
              <span className="rounded-full border border-gold-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gold-700">
                {tier.name}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-medium text-gold-900 line-clamp-2">{postTitle(post)}</p>
          <p className="text-sm text-gold-700/80 line-clamp-2">{post.caption}</p>
          <div className="mt-1">
            <OpenPostLink url={post.url} />
          </div>
        </div>
      </div>
      <StatGrid platform={post.platform} stats={post.stats} size="sm" />
      <GoalBar done={post.stats.comments} goal={displayGoal} label={isMedia ? 'Comments (live from platform)' : 'Comments on the post vs. goal'} />
      <Link
        to={isMedia ? '/media/$postId' : '/posts/$postId'}
        params={{ postId: post.id }}
        search={search}
        className="btn-gold mt-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
      >
        <MessageCircle className="size-4" /> {isMedia ? 'Engage this post' : 'Comment on this post'}
      </Link>
    </article>
  )
}
