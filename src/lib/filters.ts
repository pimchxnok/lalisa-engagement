import type { Platform, Post, PostKind } from './types'

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
export function filterPosts(posts: Post[], section: 'own' | 'media', s: ListSearch, tierOrder: string[] = []) {
  const list = posts.filter(
    (p) =>
      (section === 'media' ? p.kind === 'media' : p.kind !== 'media') &&
      (!s.campaign || p.campaignId === s.campaign) &&
      (!s.platform || s.platform === 'all' || p.platform === s.platform) &&
      (!s.kind || s.kind === 'all' || p.kind === s.kind) &&
      (!s.tier || p.tierId === s.tier),
  )
  if (section === 'media') {
    const rank = (p: Post) => {
      const i = tierOrder.indexOf(p.tierId ?? '')
      return i === -1 ? 99 : i
    }
    list.sort((a, b) => rank(a) - rank(b))
  }
  return list
}
