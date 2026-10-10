import type { Activity, Post } from './types'

export type EngageStatus = { commented: boolean; shared: boolean }
export type EngageLevel = 'done' | 'partial' | 'none'

/**
 * Engagement status is keyed by the post itself rather than the card id, so a
 * post listed in both LISA & Brand and Media shows one shared status.
 * Instagram /p/ and /reel/ links of the same shortcode count as one post.
 */
export function engageKey(post: Pick<Post, 'id' | 'url'>) {
  const raw = post.url.trim()
  if (!raw) return `id:${post.id}`
  // Instagram shortcodes are case-sensitive, so only the rest of the link is lowercased
  const ig = raw.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reels?|tv)\/([\w-]+)/i)
  if (ig) return `ig:${ig[1]}`
  const tt = raw.match(/tiktok\.com\/.*?\/(?:video|photo)\/(\d+)/i)
  if (tt) return `tt:${tt[1]}`
  return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^(www\.|m\.)/, '').replace(/[?#].*$/, '').replace(/\/+$/, '')
}

/** Story sharing is an Instagram feature, so TikTok posts only need a comment */
export const canShareStory = (post: Pick<Post, 'platform'>) => post.platform !== 'tiktok'

export function engageStatus(a: Activity, post: Post): EngageStatus {
  const s = a.status[engageKey(post)]
  return { commented: !!s?.commented, shared: !!s?.shared }
}

export function engageLevel(post: Post, s: EngageStatus): EngageLevel {
  const needed = canShareStory(post) ? [s.commented, s.shared] : [s.commented]
  const done = needed.filter(Boolean).length
  return done === needed.length ? 'done' : done > 0 ? 'partial' : 'none'
}
