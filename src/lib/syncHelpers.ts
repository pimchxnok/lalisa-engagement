import { updateData, useSiteData } from '@/lib/store'

/**
 * Apply synced metrics to a post, preserving owner-entered private metrics
 * Public: views, likes, comments, shares (from SourceVine API)
 * Private: saves, reposts (owner-entered; not exposed by IG public API)
 */
export function mergePostStats(
  existing: Record<string, any>,
  synced: Partial<Record<string, number>>
) {
  const stats = { ...existing.stats }

  // Update PUBLIC metrics from sync
  if (synced.views !== undefined) stats.views = synced.views
  if (synced.likes !== undefined) stats.likes = synced.likes
  if (synced.comments !== undefined) stats.comments = synced.comments
  if (synced.shares !== undefined) stats.shares = synced.shares

  // Keep PRIVATE metrics (owner-entered; IG doesn't expose via public API)
  // Only update if SourceVine provides AND they're > 0
  if (synced.saves !== undefined && synced.saves > 0) stats.saves = synced.saves
  if (synced.reposts !== undefined && synced.reposts > 0) stats.reposts = synced.reposts

  return stats
}

/**
 * Update lastSyncedAt in settings
 */
export function updateSyncTimestamp() {
  updateData((d) => ({
    ...d,
    settings: {
      ...d.settings,
      lastSyncedAt: new Date().toISOString(),
    },
  }))
}

/**
 * Batch sync posts from localStorage (for owner manual sync in Studio)
 * Returns count of successfully synced posts
 */
export async function syncPostsFromLinks(postIds: string[] = []): Promise<number> {
  const data = useSiteData()
  let synced = 0

  const targets = postIds.length > 0 
    ? data.posts.filter(p => postIds.includes(p.id) && p.url)
    : data.posts.filter(p => p.url)

  for (const post of targets) {
    try {
      // Fetch from our own /api/stats endpoint
      const res = await fetch(`/api/stats?url=${encodeURIComponent(post.url)}&cover=0`)
      if (!res.ok) continue

      const fetched = await res.json()
      if (fetched.error || !fetched.stats) continue

      // Apply stats and update post
      updateData((d) => ({
        ...d,
        posts: d.posts.map(p =>
          p.id === post.id
            ? {
                ...p,
                stats: mergePostStats(p, fetched.stats),
              }
            : p
        ),
      }))

      synced++
    } catch (err) {
      console.warn(`[sync] Failed to sync ${post.id}:`, err)
    }
  }

  // Update timestamp after sync completes
  updateSyncTimestamp()
  return synced
}
