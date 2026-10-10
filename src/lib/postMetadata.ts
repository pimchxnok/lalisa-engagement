import { getStore } from '@netlify/blobs'
import type { Platform, Stats } from './types'

export type PostMetadata = {
  title?: string
  caption?: string
  thumbnail?: string
  account?: string
  platform?: Platform
  /** Public numbers read from the post page itself */
  stats: Partial<Stats>
  metadataError?: string
}

type Preview = { title?: string; caption?: string; image?: string; account?: string; platform?: Platform; stats: Partial<Stats> }

// Instagram only serves link previews to known crawlers; a plain server fetch gets the login page
const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

// TikTok embeds the full post data (caption, cover, counts) only in the page it serves to browsers
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_HOSTS = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tiktokv.com', 'tiktokv.us', 'ibytedtos.com', 'byteoversea.com', 'muscdn.com', 'cdninstagram.com', 'fbcdn.net', 'instagram.com']

function safeUrl(url: URL) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
}

function socialPlatform(url: URL): Platform | undefined {
  if (!safeUrl(url)) return undefined
  const host = url.hostname.toLowerCase()
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    return /\/(reel|reels|tv)\//.test(url.pathname) ? 'ig-reel' : 'ig-post'
  }
  return undefined
}

function decodeText(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code: string) => {
    const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
    if (!code.startsWith('#')) return named[code.toLowerCase()] ?? entity
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
  }).trim()
}

/** Turns an HTML fragment into plain text, keeping line breaks */
function htmlText(html: string) {
  return decodeText(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim()
}

function imageUrl(value: unknown) {
  if (typeof value !== 'string' || !value) return undefined
  try {
    const url = new URL(decodeText(value))
    if (safeUrl(url) && IMAGE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return url
  } catch {
    return undefined
  }
  return undefined
}

/** A short headline from a caption: first line, hashtags dropped unless that leaves nothing */
function titleFrom(text?: string) {
  const line = text?.split('\n').map((l) => l.trim()).find(Boolean)
  if (!line) return undefined
  const clean = line.replace(/(^|\s)#[^\s#]+/g, '').replace(/\s{2,}/g, ' ').trim()
  return (clean || line).slice(0, 180)
}

/** Whole counts from numbers or numeric strings, including "2.9M" / "12,345" / "1.2K" */
function count(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined
  if (typeof value !== 'string') return undefined
  const match = value.trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/i)
  if (!match) return undefined
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase() as 'k' | 'm' | 'b'] ?? 1
  return Math.round(Number(match[1]) * scale)
}

function pickStats(entries: [keyof Stats, unknown][]): Partial<Stats> {
  const out: Partial<Stats> = {}
  for (const [key, value] of entries) {
    const n = count(value)
    if (n !== undefined) out[key] = n
  }
  return out
}

/** Fills gaps in `base` from `extra` without overwriting what base already has */
function mergePreview(base: Preview, extra: Partial<Preview>): Preview {
  return {
    title: base.title || extra.title,
    caption: base.caption || extra.caption,
    image: base.image || extra.image,
    account: base.account || extra.account,
    platform: base.platform || extra.platform,
    stats: { ...extra.stats, ...base.stats },
  }
}

const complete = (p: Preview) => !!(p.caption && p.image && p.stats.likes !== undefined && p.stats.comments !== undefined)

async function readBytes(response: Response, limit: number) {
  if (!response.ok || !response.body) throw new Error('Unavailable')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) throw new Error('Response too large')
      chunks.push(chunk.value)
    }
  } finally {
    await reader.cancel()
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

const readText = async (response: Response) => new TextDecoder().decode(await readBytes(response, 3_000_000))

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One retry after a short pause when the platform throttles or hiccups */
async function fetchRetry(url: URL, init: RequestInit) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, init)
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await response.body?.cancel()
        await wait(900)
        continue
      }
      return response
    } catch (error) {
      if (attempt > 0 || (init.signal as AbortSignal | undefined)?.aborted) throw error
      await wait(900)
    }
  }
}

/** Fetches a TikTok/Instagram page, following redirects only while they stay on those sites */
    async function fetchPage(initial: URL, signal: AbortSignal) {
  let url = initial
  for (let redirects = 0; redirects < 5; redirects++) {
    if (!socialPlatform(url)) throw new Error('Unsupported redirect')

    const response = await fetchRetry(url, { redirect: 'manual', signal, headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': userAgent, 'Accept-Language': 'en-US,en;q=0.9' } })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('Invalid redirect')
      url = new URL(location, url)
      continue
    }
    if (!response.headers.get('content-type')?.includes('text/html')) {
      await response.body?.cancel()
      throw new Error('Unavailable')
    }
    return { html: await readText(response), url }
  }
  throw new Error('Too many redirects')
}

/** Follows share links (vt.tiktok.com, tiktok.com/t/…, instagram.com/share/…) to the real post address */
async function resolveShareLink(initial: URL, signal: AbortSignal) {
  let url = initial
  
  for (let redirects = 0; redirects < 5; redirects++) {
    if (!socialPlatform(url)) throw new Error('Unsupported redirect')
    const response = await fetchRetry(url, { method: 'GET', redirect: 'manual', signal, headers: { 'User-Agent': url.hostname.includes('tiktok') ? BROWSER_UA : CRAWLER_UA } })
    await response.body?.cancel()
    const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null
    if (!location) return url
    url = new URL(location, url)
    if (tiktokPost(url) || instagramCode(url)) return url
  }
  return url
}

function readMeta(html: string) {
  const meta: Record<string, string> = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes: Record<string, string> = {}
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes[match[1].toLowerCase()] = decodeText(match[2] ?? match[3] ?? match[4] ?? '')
    }
    const key = attributes.property || attributes.name
    if (key && attributes.content && !meta[key.toLowerCase()]) meta[key.toLowerCase()] = attributes.content
  }
  return meta
}

/** Parses the JSON inside `<script id="…">` */
function scriptJson(html: string, id: string): unknown {
  const match = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`))
  if (!match) return undefined
  try {
    return JSON.parse(match[1])
  } catch {
    return undefined
  }
}

function tiktokPost(url: URL) {
  const match = url.pathname.match(/\/@([^/]+)\/(video|photo)\/(\d+)/)
  return match ? { user: match[1], kind: match[2], id: match[3] } : undefined
}

function instagramCode(url: URL) {
  return url.pathname.match(/\/(p|reel|reels|tv)\/([\w-]+)/)?.[2]
}

type TikTokItem = {
  id?: string
  desc?: string
  author?: { uniqueId?: string } | string
  video?: { originCover?: string; cover?: string; zoomCover?: Record<string, string> }
  imagePost?: { cover?: { imageURL?: { urlList?: string[] } }; images?: { imageURL?: { urlList?: string[] } }[] }
  stats?: Record<string, unknown>
  statsV2?: Record<string, unknown>
}

/** Reads the post data TikTok ships inside its page (current and older page formats) */
function tiktokItem(html: string, id?: string): TikTokItem | undefined {
  const universal = scriptJson(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__') as { __DEFAULT_SCOPE__?: Record<string, { itemInfo?: { itemStruct?: TikTokItem } }> } | undefined
  const fromUniversal = universal?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
  if (fromUniversal?.id) return fromUniversal
  const sigi = (scriptJson(html, 'SIGI_STATE') ?? scriptJson(html, 'sigi-persisted-data')) as { ItemModule?: Record<string, TikTokItem> } | undefined
  const items = sigi?.ItemModule
  return items ? (id && items[id]) || Object.values(items)[0] : undefined
}

function tiktokItemPreview(item: TikTokItem): Preview {
  const s = { ...item.stats, ...item.statsV2 }
  const author = typeof item.author === 'string' ? item.author : item.author?.uniqueId
  const caption = item.desc?.trim().slice(0, 2000) || undefined
  return {
    caption,
    title: titleFrom(caption),
    image:
      item.video?.originCover || item.video?.cover || item.video?.zoomCover?.['720'] ||
      item.imagePost?.cover?.imageURL?.urlList?.[0] || item.imagePost?.images?.[0]?.imageURL?.urlList?.[0],
    account: author ? `@${author}` : undefined,
    platform: 'tiktok',
    stats: pickStats([['views', s.playCount], ['likes', s.diggCount], ['comments', s.commentCount], ['saves', s.collectCount], ['shares', s.shareCount]]),
  }
}

async function tiktokPreview(url: URL, signal: AbortSignal): Promise<Preview> {
  const post = tiktokPost(url)
  let preview: Preview = { platform: 'tiktok', account: post ? `@${post.user}` : undefined, stats: {} }
  // 1. The post page: caption, cover and every public count
  for (const userAgent of [BROWSER_UA, `${BROWSER_UA} Edg/130.0.0.0`]) {
    try {
      const item = tiktokItem((await fetchPage(url, signal, userAgent)).html, post?.id)
      if (item) {
        preview = mergePreview(tiktokItemPreview(item), preview)
        break
      }
    } catch {
      // Try once more, then the oEmbed endpoint
    }
  }
  if (complete(preview)) return preview
  // 2. oEmbed: caption, cover and author, no numbers
  const candidates = post ? [...new Set([`https://www.tiktok.com/@${post.user}/video/${post.id}`, `https://www.tiktok.com/@${post.user}/${post.kind}/${post.id}`])] : [url.toString()]
  for (const candidate of candidates) {
    try {
      const endpoint = new URL('https://www.tiktok.com/oembed')
      endpoint.searchParams.set('url', candidate)
      const response = await fetchRetry(endpoint, { signal, redirect: 'error', headers: { Accept: 'application/json' } })
      const result = JSON.parse(await readText(response)) as { title?: unknown; thumbnail_url?: unknown; author_unique_id?: unknown }
      const caption = typeof result.title === 'string' ? result.title.trim().slice(0, 2000) : undefined
      const image = typeof result.thumbnail_url === 'string' ? result.thumbnail_url : undefined
      if (caption || image) {
        preview = mergePreview(preview, { caption, title: titleFrom(caption), image, account: typeof result.author_unique_id === 'string' ? `@${result.author_unique_id}` : undefined })
        break
      }
    } catch {
      // Try the next form, then the crawler preview
    }
  }
  if (preview.caption && preview.image) return preview
  // 3. Link-preview tags
  try {
    const meta = readMeta((await fetchPage(url, signal)).html)
    const caption = meta['og:description'] || meta['description']
    const ogTitle = meta['og:title'] || meta['twitter:title']
    const title = ogTitle && !/^tiktok\b/i.test(ogTitle) ? titleFrom(ogTitle) : /^tiktok\b/i.test(caption ?? '') ? undefined : titleFrom(caption)
    return mergePreview(preview, { title, image: meta['og:image'] || meta['twitter:image'] })
  } catch {
    return preview
  }
}

type InstagramMedia = {
  __typename?: string
  is_video?: boolean
  product_type?: string
  display_url?: string
  thumbnail_src?: string
  video_view_count?: unknown
  video_play_count?: unknown
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] }
  edge_media_to_comment?: { count?: unknown }
  edge_media_preview_comment?: { count?: unknown }
  edge_liked_by?: { count?: unknown }
  edge_media_preview_like?: { count?: unknown }
  owner?: { username?: string }
}

/** The embed page carries the post as JSON in a `"contextJSON":"…"` string */
function instagramMedia(html: string): InstagramMedia | undefined {
  const marker = html.indexOf('"contextJSON":"')
  if (marker < 0) return undefined
  const start = marker + '"contextJSON":'.length
  // Walk to the closing quote of the JSON string literal
  let end = start + 1
  while (end < html.length && html[end] !== '"') end += html[end] === '\\' ? 2 : 1
  try {
    const context = JSON.parse(JSON.parse(html.slice(start, end + 1))) as { gql_data?: { shortcode_media?: InstagramMedia } | null }
    return context.gql_data?.shortcode_media ?? undefined
  } catch {
    return undefined
  }
}

function instagramMediaPreview(media: InstagramMedia): Preview {
  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text?.trim().slice(0, 2000) || undefined
  const reel = media.product_type === 'clips' || media.product_type === 'igtv' || (media.is_video && media.__typename === 'GraphVideo')
  return {
    caption,
    title: titleFrom(caption),
    image: media.display_url || media.thumbnail_src,
    account: media.owner?.username ? `@${media.owner.username}` : undefined,
    platform: reel ? 'ig-reel' : undefined,
    stats: pickStats([
      ['likes', media.edge_liked_by?.count ?? media.edge_media_preview_like?.count],
      ['comments', media.edge_media_to_comment?.count ?? media.edge_media_preview_comment?.count],
      ['views', media.video_view_count ?? media.video_play_count],
    ]),
  }
}

/** Fallback for embed pages without the JSON: caption, cover and author straight from the markup */
function instagramEmbedHtml(html: string): Preview {
  const captionHtml = html.match(/<div class="Caption">([\s\S]*?)(?:<div class="CaptionComments"|<\/div>)/)?.[1]
  const account = html.match(/class="CaptionUsername"[^>]*>([^<]+)</)?.[1] ?? html.match(/class="UsernameText"[^>]*>([^<]+)</)?.[1]
  const caption = captionHtml ? htmlText(captionHtml.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '')) : undefined
  const image = html.match(/class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/)?.[1] ?? html.match(/<img[^>]+\ssrc="([^"]+)"[^>]*class="EmbeddedMediaImage"/)?.[1]
  const escaped = (key: string) => html.match(new RegExp(`${key}\\\\*"\\s*:\\s*\\{\\\\*"count\\\\*"\\s*:\\s*(\\d+)`))?.[1]
  return {
    caption: caption?.slice(0, 2000) || undefined,
    title: titleFrom(caption),
    image: image ? decodeText(image) : undefined,
    account: account ? `@${decodeText(account)}` : undefined,
    stats: pickStats([['likes', escaped('edge_liked_by')], ['comments', escaped('edge_media_to_comment')]]),
  }
}

async function instagramPreview(url: URL, signal: AbortSignal): Promise<Preview> {
  const code = instagramCode(url)
  let preview: Preview = { stats: {} }
  if (code) {
    // The public embed page carries the full caption, cover, likes, comments and reel views without a login
    for (const path of [`p/${code}/embed/captioned/`, `p/${code}/embed/`]) {
      try {
        const { html } = await fetchPage(new URL(`https://www.instagram.com/${path}`), signal)
        const media = instagramMedia(html)
        preview = mergePreview(preview, media ? mergePreview(instagramMediaPreview(media), instagramEmbedHtml(html)) : instagramEmbedHtml(html))
        if (complete(preview)) return preview
      } catch {
        // Try the plain embed, then the post page below
      }
    }
  }
  try {
    const meta = readMeta((await fetchPage(url, signal)).html)
    // og:description looks like `123 likes, 4 comments - user on May 1, 2025: "caption"`
    const description = meta['og:description'] || meta['description'] || ''
    const quoted = description.match(/:\s*["“]([\s\S]+)["”]\s*\.?$/)?.[1]
    const numbers = description.match(/^([\d.,]+[KMB]?)\s+likes?,\s*([\d.,]+[KMB]?)\s+comments?/i)
    const user = description.match(/comments?\s*-\s*([\w.]+)\s+on\s/i)?.[1]
    const rawTitle = meta['og:title'] || meta['twitter:title'] || ''
    const pageTitle = /photos and videos/i.test(rawTitle) ? '' : rawTitle.replace(/\s*[•·]\s*Instagram.*$/i, '').replace(/\s+on Instagram\s*:?\s*$/i, '')
    return mergePreview(preview, {
      caption: quoted,
      title: titleFrom(quoted) || (pageTitle && !/^(instagram|login|log in|sign up)$/i.test(pageTitle) ? pageTitle.slice(0, 180) : undefined),
      image: meta['og:image'] || meta['twitter:image'],
      account: user ? `@${user}` : undefined,
      stats: numbers ? pickStats([['likes', numbers[1]], ['comments', numbers[2]]]) : {},
    })
  } catch {
    return preview
  }
}

/** Copies a platform cover into site storage, since TikTok and Instagram image links expire within days */
async function storeCover(source: URL, postKey: string, signal: AbortSignal) {
  try {
    const response = await fetch(source, { signal, redirect: 'follow', headers: { 'User-Agent': CRAWLER_UA, Accept: 'image/*' } })
    const type = response.headers.get('content-type')?.split(';')[0] ?? ''
    if (!type.startsWith('image/')) {
      await response.body?.cancel()
      throw new Error('Not an image')
    }
    const bytes = await readBytes(response, MAX_IMAGE_BYTES)
    if (!bytes.byteLength) throw new Error('Empty image')
    const digest = async (data: BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (b) => b.toString(16).padStart(2, '0')).join('')
    const key = `cover-${(await digest(new TextEncoder().encode(postKey))).slice(0, 16)}-${(await digest(bytes)).slice(0, 10)}`
    await getStore('post-images').set(key, bytes.buffer as ArrayBuffer, { metadata: { type, source: postKey } })
    return `/api/images/${key}`
  } catch {
    return undefined
  }
}

export async function fetchPostMetadata(rawUrl: string, includeCover = true): Promise<PostMetadata> {
  try {
    let url = new URL(rawUrl.trim())
    let platform = socialPlatform(url)
    if (!platform) return { stats: {}, metadataError: 'Use an HTTPS TikTok or Instagram post link.' }
    const signal = AbortSignal.timeout(20000)
    if (platform === 'tiktok' ? !tiktokPost(url) : !instagramCode(url)) {
      url = await resolveShareLink(url, signal)
      platform = socialPlatform(url) ?? platform
    }
    const preview = platform === 'tiktok' ? await tiktokPreview(url, signal) : await instagramPreview(url, signal)
    if (preview.platform) platform = preview.platform
    const title = preview.title && !/^(instagram|tiktok|login|log in|sign up)(?:\s*[|·•–—-].*)?$/i.test(preview.title) ? preview.title : undefined
    const source = includeCover ? imageUrl(preview.image) : undefined
    const postKey = platform === 'tiktok' ? `tiktok:${tiktokPost(url)?.id ?? url.pathname}` : `instagram:${instagramCode(url) ?? url.pathname}`
    const thumbnail = source ? (await storeCover(source, postKey, signal)) ?? source.toString() : undefined
    const hasNumbers = Object.keys(preview.stats).length > 0
    if (!title && !thumbnail && !hasNumbers) return { platform, stats: {}, metadataError: 'This post did not expose a public preview (it may be private, age-restricted or deleted). Enter the title manually; a cover is optional.' }
    return {
      platform,
      account: preview.account,
      title,
      caption: preview.caption?.slice(0, 2000),
      thumbnail,
      stats: preview.stats,
      ...(!thumbnail && includeCover ? { metadataError: 'No public cover was available. You can upload one or leave it empty.' } : {}),
    }
  } catch {
    return { stats: {}, metadataError: 'Could not read a public preview from this link. Enter the title manually; a cover is optional.' }
  }
}

/** Reads "1,234" / "1.2K" / "3M" style counts */
function count(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const match = value.trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/i)
  if (!match) return undefined
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase() as 'k' | 'm' | 'b'] ?? 1
  return Math.round(Number(match[1]) * scale)
}

function compact(stats: Partial<Record<keyof Stats, number | undefined>>): Partial<Stats> {
  return Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== undefined)) as Partial<Stats>
}

/** TikTok video pages carry `"statsV2":{"diggCount":"…","playCount":"…",…}` for the video itself */
function tiktokCounts(html: string): Partial<Stats> {
  for (const match of html.matchAll(/"stats(?:V2)?":(\{[^{}]*\})/g)) {
    try {
      const s = JSON.parse(match[1]) as Record<string, unknown>
      if (!('playCount' in s)) continue
      return compact({ views: count(s.playCount), likes: count(s.diggCount), comments: count(s.commentCount), shares: count(s.shareCount), saves: count(s.collectCount) })
    } catch {
      // Keep looking
    }
  }
  return {}
}

/** Instagram previews describe a post as `1,234 likes, 56 comments - user on …` */
function instagramCounts(html: string): Partial<Stats> {
  const meta = readMeta(html)
  const description = meta['og:description'] || meta['description'] || ''
  const likes = description.match(/([\d.,]+\s*[KMB]?)\s+likes?\b/i)?.[1]
  const comments = description.match(/([\d.,]+\s*[KMB]?)\s+comments?\b/i)?.[1]
  const views = html.match(/"(?:video_view_count|play_count|view_count)":(\d+)/)?.[1]
  return compact({ likes: count(likes), comments: count(comments), views: count(views) })
}

/** Public numbers read straight from the post page, used when no metrics service is configured or it misses a number */
export async function fetchPublicCounts(rawUrl: string): Promise<Partial<Stats>> {
  try {
    let url = new URL(rawUrl.trim())
    let platform = socialPlatform(url)
    if (!platform) return {}
    const signal = AbortSignal.timeout(12000)
    if (platform === 'tiktok' ? !tiktokPost(url) : !instagramCode(url)) {
      url = await resolveShareLink(url, signal)
      platform = socialPlatform(url) ?? platform
    }
    if (platform === 'tiktok') return tiktokCounts((await fetchPage(url, signal, BROWSER_UA)).html)
    return instagramCounts((await fetchPage(url, signal)).html)
  } catch {
    return {}
  }
}
