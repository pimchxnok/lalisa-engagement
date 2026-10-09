import type { Platform, Post, Stats, TipCategory } from './types'

export const tipCategories: TipCategory[] = ['EMV', 'MIV', 'Like', 'Share', 'Comment', 'Repost']

export const platformLabel: Record<Platform, string> = {
  tiktok: 'TikTok',
  'ig-post': 'Instagram Post',
  'ig-reel': 'Instagram Reel',
}

export const platforms: Platform[] = ['tiktok', 'ig-post', 'ig-reel']

type MetricKey = keyof Stats

export const metricLabel: Record<MetricKey, string> = {
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  reposts: 'Reposts',
  saves: 'Saves',
  shares: 'Shares',
}

/** Metrics each platform exposes, in display order */
export const platformMetrics: Record<Platform, MetricKey[]> = {
  tiktok: ['views', 'likes', 'comments', 'saves', 'shares'],
  'ig-post': ['likes', 'comments', 'reposts', 'saves', 'shares'],
  'ig-reel': ['views', 'likes', 'comments', 'reposts', 'saves', 'shares'],
}

export function formatNum(n: number | undefined) {
  if (n === undefined) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.0+$/, '')}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return n.toLocaleString('en-US')
}

export function sumStats(posts: Post[]): Stats {
  const s: Stats = { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, reposts: 0 }
  for (const p of posts) {
    for (const k of Object.keys(s) as MetricKey[]) s[k] = (s[k] ?? 0) + (p.stats[k] ?? 0)
  }
  return s
}

/** Reads platform, post type and account handle from a pasted TikTok / Instagram link */
export function parsePostUrl(raw: string): { platform?: Platform; account?: string } {
  try {
    const u = new URL(raw.trim())
    const host = u.hostname.replace(/^www\./, '')
    const parts = u.pathname.split('/').filter(Boolean)
    if (host.endsWith('tiktok.com')) {
      const handle = parts.find((p) => p.startsWith('@'))
      return { platform: 'tiktok', account: handle }
    }
    if (host.endsWith('instagram.com')) {
      const i = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p))
      const account = i > 0 ? `@${parts[i - 1]}` : undefined
      return { platform: parts[i]?.startsWith('reel') || parts[i] === 'tv' ? 'ig-reel' : 'ig-post', account }
    }
  } catch {
    // Not a URL yet
  }
  return {}
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Serves site-hosted images through the Netlify Image CDN; external & uploaded images pass through */
export function imageSrc(src: string, w: number) {
  return src.startsWith('/') ? `/.netlify/images?url=${encodeURIComponent(src)}&w=${w}&fm=webp` : src
}
