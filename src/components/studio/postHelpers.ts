import type { FetchedStats } from '@/lib/statsFetch'
import { newId } from '@/lib/store'
import type { Post, PostKind, Stats } from '@/lib/types'

export async function fetchLinkStats(url: string, includeCover = true): Promise<FetchedStats> {
  try {
    const res = await fetch(`/api/stats?url=${encodeURIComponent(url)}&cover=${includeCover ? '1' : '0'}`)
    if (!res.ok) throw new Error('Unavailable')
    return await res.json()
  } catch {
    return { stats: {}, missing: [], error: 'Could not reach the platform — try again.' }
  }
}

/** Merges fetched numbers into a post, keeping the owner's own values for metrics the platform hides */
export function applyStats(p: Post, r: FetchedStats): Post {
  const stats: Stats = { ...p.stats }
  for (const [k, v] of Object.entries(r.stats) as [keyof Stats, number | undefined][]) if (v !== undefined) stats[k] = v
  return {
    ...p,
    platform: r.platform ?? p.platform,
    account: p.account || r.account || '',
    title: p.title || r.title,
    caption: p.caption || r.caption || '',
    thumbnail: p.kind === 'media' ? undefined : p.thumbnail || r.thumbnail,
    stats,
  }
}

export function blankPost(campaignId: string, kind: PostKind): Post {
  return {
    id: newId('p'),
    kind,
    campaignId,
    platform: 'ig-post',
    url: '',
    account: '',
    title: '',
    caption: '',
    stats: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, reposts: 0 },
    commentGoal: kind === 'media' ? undefined : 10_000,
    communityComments: 0,
    postedAt: new Date().toISOString().slice(0, 10),
  }
}
