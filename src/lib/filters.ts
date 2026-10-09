import type { Platform, Post, PostKind, Tier } from './types'

export type ListSearch = {
  campaign?: string
  platform?: Platform | 'all'
  kind?: PostKind | 'all'
  tier?: string
}

const isPlatform = (v: unknown): v is Platform => v === 'tiktok' || v === 'ig-post' || v === 'ig-reel'

export function validateListSearch(s: Record<string, unknown>): ListSearch {
  return {
    campaign: typeof s.campaign === 'string' ? s.campaign : undefined,
    platform: isPlatform(s.platform) ? s.platform : undefined,
    kind: s.kind === 'lisa' || s.kind === 'brand' ? s.kind : undefined,
    tier: typeof s.tier === 'string' ? s.tier : undefined,
  }
}

/** Posts in the order a list page shows them — also drives next / previous on detail pages */
/** Tiers of one platform, in the owner's order */
export function tiersFor(tiers: Tier[], platform: Platform) {
  return tiers.filter((t) => t.platform === platform)
}

export function filterPosts(posts: Post[], section: 'own' | 'media', s: ListSearch, tiers: Tier[] = []) {
  const list = posts.filter(
    (p) =>
      (section === 'media' ? p.kind === 'media' : p.kind !== 'media') &&
      (!s.campaign || p.campaignId === s.campaign) &&
      (!s.platform || s.platform === 'all' || p.platform === s.platform) &&
      (!s.kind || s.kind === 'all' || p.kind === s.kind) &&
      (!s.tier || p.tierId === s.tier),
  )
  if (section === 'media') {
    // Rank by position within the post's own platform, so Tier 1 of every platform comes first
    const rank = (p: Post) => {
      const i = tiersFor(tiers, p.platform).findIndex((t) => t.id === p.tierId)
      return i === -1 ? 99 : i
    }
    list.sort((a, b) => rank(a) - rank(b))
  }
  return list
}
