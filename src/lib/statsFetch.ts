import type { Platform, Stats } from './types'

export type FetchedStats = {
  platform?: Platform
  account?: string
  stats: Partial<Stats>
  /** Metrics the platform doesn't make public for this post */
  missing: (keyof Stats)[]
  error?: string
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

/** Reads the public numbers of a TikTok or Instagram post. Runs on the server only. */
export async function fetchStats(rawUrl: string): Promise<FetchedStats> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { stats: {}, missing: [], error: 'That link is not a valid URL.' }
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host.endsWith('tiktok.com')) return fetchTikTok(url.toString())
  if (host.endsWith('instagram.com')) return fetchInstagram(url)
  return { stats: {}, missing: [], error: 'Only TikTok and Instagram links are supported.' }
}

async function fetchTikTok(link: string): Promise<FetchedStats> {
  const res = await fetch(link, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow' })
  const html = await res.text()
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)
  if (m) {
    try {
      const item = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
      const s = { ...item?.stats, ...item?.statsV2 }
      if (item && s) {
        return {
          platform: 'tiktok',
          account: item.author?.uniqueId ? `@${item.author.uniqueId}` : undefined,
          stats: {
            views: num(s.playCount),
            likes: num(s.diggCount),
            comments: num(s.commentCount),
            saves: num(s.collectCount),
            shares: num(s.shareCount),
          },
          missing: [],
        }
      }
    } catch {
      // Fall through to the error below
    }
  }
  return { platform: 'tiktok', stats: {}, missing: [], error: 'TikTok did not return numbers for this link — try again in a minute.' }
}

async function fetchInstagram(url: URL): Promise<FetchedStats> {
  const parts = url.pathname.split('/').filter(Boolean)
  const i = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p))
  const code = i >= 0 ? parts[i + 1] : undefined
  if (!code) return { stats: {}, missing: [], error: 'Could not find the post code in this Instagram link.' }
  const isReelLink = parts[i] !== 'p'

  // Public GraphQL query used by instagram.com for logged-out post pages
  try {
    const res = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST',
      headers: {
        'user-agent': UA,
        'content-type': 'application/x-www-form-urlencoded',
        'x-ig-app-id': '936619743392459',
        'x-fb-friendly-name': 'PolarisPostActionLoadPostQueryQuery',
      },
      body: new URLSearchParams({ variables: JSON.stringify({ shortcode: code }), doc_id: '8845758582119845' }),
    })
    const media = (await res.json())?.data?.xdt_shortcode_media
    if (media) {
      const reel = media.is_video || media.product_type === 'clips' || isReelLink
      const views = num(media.video_play_count) ?? num(media.video_view_count)
      return {
        platform: reel ? 'ig-reel' : 'ig-post',
        account: media.owner?.username ? `@${media.owner.username}` : undefined,
        stats: {
          ...(reel && views !== undefined ? { views } : {}),
          likes: num(media.edge_media_preview_like?.count) ?? num(media.edge_liked_by?.count),
          comments: num(media.edge_media_to_parent_comment?.count) ?? num(media.edge_media_to_comment?.count),
        },
        missing: ['saves', 'shares', 'reposts'],
      }
    }
  } catch {
    // Try the page meta tags instead
  }

  // Fallback: "1,234 likes, 56 comments - user on …" in the page description
  try {
    const res = await fetch(`https://www.instagram.com/${isReelLink ? 'reel' : 'p'}/${code}/`, { headers: { 'user-agent': UA } })
    const html = await res.text()
    const desc = html.match(/<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]+)"/)?.[1] ?? ''
    const likes = desc.match(/([\d.,]+[KM]?)\s+likes?/i)?.[1]
    const comments = desc.match(/([\d.,]+[KM]?)\s+comments?/i)?.[1]
    const account = desc.match(/-\s*([\w.]+)\s+on\s/)?.[1]
    if (likes || comments) {
      return {
        platform: isReelLink ? 'ig-reel' : 'ig-post',
        account: account ? `@${account}` : undefined,
        stats: { likes: abbrev(likes), comments: abbrev(comments) },
        missing: [...(isReelLink ? (['views'] as const) : []), 'saves', 'shares', 'reposts'],
      }
    }
  } catch {
    // Reported below
  }
  return { stats: {}, missing: [], error: 'Instagram did not return numbers for this link — try again in a minute.' }
}

function abbrev(v?: string) {
  if (!v) return undefined
  const m = v.replace(/,/g, '').match(/^([\d.]+)([KM]?)$/i)
  if (!m) return undefined
  return Math.round(Number(m[1]) * (m[2].toUpperCase() === 'M' ? 1e6 : m[2].toUpperCase() === 'K' ? 1e3 : 1))
}
