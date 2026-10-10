/**
 * src/routes/posts/index.tsx — Add sync status on list page
 */

import { createFileRoute } from '@tanstack/react-router'
import { PostCard } from '@/components/PostCard'
import { SectionTitle } from '@/components/ui'
import { SyncStatusBadge } from '@/components/SyncStatus'
import { filterPosts, validateListSearch } from '@/lib/filters'
import { useSiteData } from '@/lib/store'
import { BackLink } from '@/components/PostNav'

export const Route = createFileRoute('/posts/')({
  validateSearch: validateListSearch,
  component: PostsList,
})

function PostsList() {
  const search = Route.useSearch()
  const data = useSiteData()
  const posts = filterPosts(data.posts, 'own', search)
  const campaign = data.campaigns.find((c) => c.id === search.campaign)

  return (
    <div className="mx-auto max-w-5xl px-5 pt-10">
      <div className="mb-8 flex items-center justify-between">
        <BackLink campaign={search.campaign} />
        <SyncStatusBadge compact />
      </div>
      <SectionTitle eyebrow={campaign?.name} title="Comment on LISA & Brand posts">
        Help these posts reach their comment goals. The owner sets each goal—let's make them happen together.
      </SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} search={search} />
        ))}
      </div>
      {posts.length === 0 && <p className="text-center text-gold-600">No posts found for this campaign.</p>}
    </div>
  )
}
