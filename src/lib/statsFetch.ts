import type { Platform, Stats } from './types'
import { fetchPage, fetchPostMetadata, instagramCode, readMeta, resolveShareLink, socialPlatform, tiktokPost } from './postMetadata'
import { platformMetrics } from './platform'

export type FetchedStats = {
  platform?: Platform
  account?: string
  title?: string
  caption?: string
  thumbnail?: string
  metadataError?: string
  stats: Partial<Stats>
  missing: (keyof Stats)[]
  error?: string
}

type Metrics = { platform: Platform; account?: string; stats: Partial<Stats> }

// TikTok only embeds post data for regular browsers; the crawler agent gets a bare preview page
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''))
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed)
  }
  return undefined
}

/** Reads display counts such as `60,279,252`, `1.2M` or `45.3K` */
function countText(value?: string): number | undefined {
  const match = value?.trim().match(/^([\d.,]+)\s*([KMB])?$/i)
  if (!match) return undefined
  const scale = { K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase() as 'K' | 'M' | 'B'] ?? 1
  const base = scale === 1 ? Number(match[1].replace(/[.,]/g, '')) : Number(match[1].replace(/,/g, ''))
  return Number.isFinite(base) ? Math.round(base * scale) : undefined
}

function compact(stats: Partial<Stats>): Partial<Stats> {
  return Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== undefined)) as Partial<Stats>
}

/** TikTok post pages embed the full item, including its counters, as JSON for the app to hydrate */
async function readTikTok(url: URL, signal: AbortSignal): Promise<Metrics> {
  const post = tiktokPost(url)
  const pageUrl = post ? new URL(`https://www.tiktok.com/@${post.user}/${post.kind}/${post.id}`) : url
  const { html } = await fetchPage(pageUrl, signal, BROWSER_UA)
  type Item = { author?: { uniqueId?: string }; stats?: Record<string, unknown>; statsV2?: Record<string, unknown> }
  let item: Item | undefined
  const universal = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (universal) {
    const scope = JSON.parse(universal)?.__DEFAULT_SCOPE__ ?? {}
    item = scope['webapp.video-detail']?.itemInfo?.itemStruct ?? scope['webapp.photo-detail']?.itemInfo?.itemStruct
  }
  const sigi = !item && html.match(/<script[^>]+id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (sigi) {
    const modules = JSON.parse(sigi)?.ItemModule ?? {}
    item = (post && modules[post.id]) || Object.values(modules)[0]
  }
  if (!item?.stats && !item?.statsV2) throw new Error('No post data')
  // statsV2 holds exact string counts; stats can be rounded on very large posts
  const read = (key: string) => num(item.statsV2?.[key]) ?? num(item.stats?.[key])
  return {
    platform: 'tiktok',
    account: item.author?.uniqueId ? `@${item.author.uniqueId}` : post ? `@${post.user}` : undefined,
    stats: compact({
      views: read('playCount'),
      likes: read('diggCount'),
      comments: read('commentCount'),
      saves: read('collectCount'),
      shares: read('shareCount'),
    }),
  }
}

/** Matches `"key":123` in plain or escaped JSON inside a page */
function jsonCount(html: string, keys: string[]) {
  for (const key of keys) {
    const direct = html.match(new RegExp(`\\\\?"${key}\\\\?"\\s*:\\s*(\\d+)`))?.[1]
    if (direct) return Number(direct)
    const edge = html.match(new RegExp(`\\\\?"${key}\\\\?"\\s*:\\s*\\{\\s*\\\\?"count\\\\?"\\s*:\\s*(\\d+)`))?.[1]
    if (edge) return Number(edge)
  }
  return undefined
}

/**
 * Instagram's public embed page shows exact like and comment counts (and views on videos);
 * the post page's preview tags carry rounded likes and comments as a fallback.
 * Saves, shares and reposts are only visible to the account owner.
 */
async function readInstagram(url: URL, signal: AbortSignal): Promise<Metrics> {
  const code = instagramCode(url)
  const reel = /\/(reel|reels|tv)\//.test(url.pathname)
  const stats: Partial<Stats> = {}
  let video = reel
  if (code) {
    try {
      const { html } = await fetchPage(new URL(`https://www.instagram.com/p/${code}/embed/captioned/`), signal)
      stats.likes = countText(html.match(/>\s*([\d.,]+[KMB]?)\s+likes?\s*</i)?.[1]) ?? jsonCount(html, ['like_count', 'edge_liked_by', 'edge_media_preview_like'])
      stats.comments =
        countText(html.match(/>\s*View all\s+([\d.,]+[KMB]?)\s+comments?\s*</i)?.[1]) ??
        jsonCount(html, ['comment_count', 'edge_media_to_parent_comment', 'edge_media_to_comment'])
      stats.views = countText(html.match(/>\s*([\d.,]+[KMB]?)\s+(?:views|plays)\s*</i)?.[1]) ?? jsonCount(html, ['video_view_count', 'play_count', 'view_count'])
      video ||= /"is_video\\?"\s*:\s*true|class="[^"]*EmbedVideo/i.test(html)
    } catch {
      // Fall back to the preview tags below
    }
  }
  if (stats.likes === undefined || stats.comments === undefined) {
    try {
      const meta = readMeta((await fetchPage(url, signal)).html)
      // og:description looks like `60M likes, 4M comments - user on January 4, 2019: "caption"`
      const description = meta['og:description'] || meta['description'] || ''
      stats.likes ??= countText(description.match(/([\d.,]+[KMB]?)\s+likes?\b/i)?.[1])
      stats.comments ??= countText(description.match(/([\d.,]+[KMB]?)\s+comments?\b/i)?.[1])
      video ||= /video/i.test(meta['og:type'] ?? '') || !!meta['og:video']
    } catch {
      // Whatever the embed page gave is returned below
    }
  }
  const platform: Platform = video ? 'ig-reel' : 'ig-post'
  if (platform === 'ig-post') delete stats.views
  return { platform, stats: compact(stats) }
}

type SourcevineResponse = {
  success?: boolean
  available?: boolean
  data?: Record<string, number | string | null | undefined> & { channelName?: string }
}

/** Optional paid provider for the numbers public pages don't show; only used when SOURCEVINE_API_KEY is set */
async function readSourcevine(url: URL, platform: Platform, signal: AbortSignal): Promise<Partial<Metrics> | undefined> {
  // This runs on the server. Never expose this key to browser code.
  const apiKey = process.env.SOURCEVINE_API_KEY
  if (!apiKey) return undefined
  try {
    const apiUrl = new URL(`https://api.sourcevine.io/v1/${platform === 'tiktok' ? 'tiktok' : 'instagram'}/stats`)
    apiUrl.searchParams.set('url', url.toString())
    const response = await fetch(apiUrl, { signal, headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } })
    if (!response.ok) return undefined
    const result = (await response.json()) as SourcevineResponse
    const data = result.data
    if (result.success !== true || result.available === false || !data) return undefined
    return {
      account: data.channelName ? `@${data.channelName}` : undefined,
      stats: compact({
        views: num(data.views),
        likes: num(data.likes),
        comments: num(data.comments),
        shares: num(data.shares),
        saves: num(data.saves ?? data.collects),
        reposts: num(data.reposts),
      }),
    }
  } catch {
    return undefined
  }
}

async function fetchMetrics(rawUrl: string): Promise<FetchedStats> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { stats: {}, missing: [], error: 'That link is not a valid URL.' }
  }
  let platform = socialPlatform(url)
  if (!platform) return { stats: {}, missing: [], error: 'Use an HTTPS TikTok or Instagram post link.' }

  const signal = AbortSignal.timeout(15000)
  let metrics: Metrics | undefined
  try {
    if (platform === 'tiktok' ? !tiktokPost(url) : !instagramCode(url)) {
      url = await resolveShareLink(url, signal)
      platform = socialPlatform(url) ?? platform
    }
    metrics = platform === 'tiktok' ? await readTikTok(url, signal) : await readInstagram(url, signal)
  } catch {
    // A provider may still have the numbers
  }

  const provider = await readSourcevine(url, metrics?.platform ?? platform, signal)
  const resolved = metrics?.platform ?? platform
  // Public page numbers win; the provider only fills metrics the page didn't show
  const stats = compact({ ...provider?.stats, ...metrics?.stats })
  const missing = platformMetrics[resolved].filter((key) => stats[key] === undefined)
  return {
    platform: resolved,
    account: metrics?.account ?? provider?.account,
    stats,
    missing,
    ...(Object.keys(stats).length ? {} : { error: 'This post did not show public numbers (it may be private, age-restricted or deleted). Enter them manually.' }),
  }
}

export async function fetchStats(rawUrl: string, includeCover = true): Promise<FetchedStats> {
  const [metrics, metadata] = await Promise.all([fetchMetrics(rawUrl), fetchPostMetadata(rawUrl, includeCover)])
  return { ...metrics, ...metadata, account: metrics.account ?? metadata.account, platform: metadata.platform === 'ig-reel' ? metadata.platform : metrics.platform ?? metadata.platform }
}
