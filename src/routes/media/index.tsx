/**
 * src/routes/media/index.tsx
 * Media list page with sync status
 */

import { createFileRoute } from '@tanstack/react-router'
import { PostCard } from '@/components/PostCard'
import { SectionTitle } from '@/components/ui'
import { SyncStatusBadge } from '@/components/SyncStatus'
import { filterPosts, validateListSearch } from '@/lib/filters'
import { useSiteData } from '@/lib/store'
import { BackLink } from '@/components/PostNav'

export const Route = createFileRoute('/media')({
  validateSearch: validateListSearch,
  component: MediaList,
})

function MediaList() {
  const search = Route.useSearch()
  const data = useSiteData()
  const posts = filterPosts(data.posts, 'media', search, data.tiers.map((t) => t.id))
  const campaign = data.campaigns.find((c) => c.id === search.campaign)

  return (
    <div className="mx-auto max-w-5xl px-5 pt-10">
      <div className="mb-8 flex items-center justify-between">
        <BackLink campaign={search.campaign} />
        <SyncStatusBadge compact />
      </div>
      <SectionTitle eyebrow={campaign?.name || 'Media coverage'} title="Engage media posts about LISA">
        Every like, comment and share on these posts counts toward LISA's exposure. Share to your story, like, comment, repost.
      </SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} search={search} />
        ))}
      </div>
      {posts.length === 0 && <p className="text-center text-gold-600">No media posts found for this campaign.</p>}
    </div>
  )
}
