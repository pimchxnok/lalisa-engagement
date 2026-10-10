import { getStore } from '@netlify/blobs'
import type { Platform, Stats } from './types'

type PostMetadata = {
  title?: string
  caption?: string
  thumbnail?: string
  account?: string
  platform?: Platform
  metadataError?: string
}

type Preview = { title?: string; caption?: string; image?: string; account?: string }

// Instagram and TikTok only serve link previews to known crawlers; a plain server fetch gets the login page
const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
// TikTok only embeds a video's full counts in the page it serves to regular browsers
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
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

const readText = async (response: Response) => new TextDecoder().decode(await readBytes(response, 2_000_000))

/** Fetches a TikTok/Instagram page, following redirects only while they stay on those sites */
    async function fetchPage(initial: URL, signal: AbortSignal) {
  let url = initial
  for (let redirects = 0; redirects < 5; redirects++) {
    if (!socialPlatform(url)) throw new Error('Unsupported redirect')
    const response = await fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/html', 'User-Agent': userAgent, 'Accept-Language': 'en' } })
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
    const response = await fetch(url, { method: 'GET', redirect: 'manual', signal, headers: { 'User-Agent': CRAWLER_UA } })
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

function tiktokPost(url: URL) {
  const match = url.pathname.match(/\/@([^/]+)\/(video|photo)\/(\d+)/)
  return match ? { user: match[1], kind: match[2], id: match[3] } : undefined
}

function instagramCode(url: URL) {
  return url.pathname.match(/\/(p|reel|reels|tv)\/([\w-]+)/)?.[2]
}

async function tiktokPreview(url: URL, signal: AbortSignal): Promise<Preview> {
  const post = tiktokPost(url)
  const candidates = post ? [...new Set([`https://www.tiktok.com/@${post.user}/video/${post.id}`, `https://www.tiktok.com/@${post.user}/${post.kind}/${post.id}`])] : [url.toString()]
  for (const candidate of candidates) {
    try {
      const endpoint = new URL('https://www.tiktok.com/oembed')
      endpoint.searchParams.set('url', candidate)
      const response = await fetch(endpoint, { signal, redirect: 'error', headers: { Accept: 'application/json' } })
      const result = JSON.parse(await readText(response)) as { title?: unknown; thumbnail_url?: unknown; author_unique_id?: unknown }
      const caption = typeof result.title === 'string' ? result.title.trim().slice(0, 2000) : undefined
      const image = typeof result.thumbnail_url === 'string' ? result.thumbnail_url : undefined
      if (caption || image) return { caption, title: titleFrom(caption), image, account: typeof result.author_unique_id === 'string' ? `@${result.author_unique_id}` : undefined }
    } catch {
      // Try the next form, then the page itself
    }
  }
  const meta = readMeta((await fetchPage(url, signal)).html)
  const caption = meta['og:description'] || meta['description']
  const ogTitle = meta['og:title'] || meta['twitter:title']
  const title = ogTitle && !/^tiktok\b/i.test(ogTitle) ? titleFrom(ogTitle) : titleFrom(caption)
  return { caption, title, image: meta['og:image'] || meta['twitter:image'], account: post ? `@${post.user}` : undefined }
}

async function instagramPreview(url: URL, signal: AbortSignal): Promise<Preview> {
  const code = instagramCode(url)
  let preview: Preview = {}
  if (code) {
    // The public embed page carries the full caption and the cover image without a login
    try {
      const { html } = await fetchPage(new URL(`https://www.instagram.com/p/${code}/embed/captioned/`), signal)
      const captionHtml = html.match(/<div class="Caption">([\s\S]*?)(?:<div class="CaptionComments"|<\/div>)/)?.[1]
      const account = html.match(/class="CaptionUsername"[^>]*>([^<]+)</)?.[1]
      const caption = captionHtml ? htmlText(captionHtml.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '')) : undefined
      const image = html.match(/class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/)?.[1] ?? html.match(/<img[^>]+\ssrc="([^"]+)"[^>]*class="EmbeddedMediaImage"/)?.[1]
      preview = { caption: caption?.slice(0, 2000), title: titleFrom(caption), image, account: account ? `@${decodeText(account)}` : undefined }
    } catch {
      // Fall back to the post page below
    }
  }
  if (preview.title && preview.image) return preview
  try {
    const meta = readMeta((await fetchPage(url, signal)).html)
    // og:description looks like `123 likes, 4 comments - user on May 1, 2025: "caption"`
    const description = meta['og:description'] || meta['description'] || ''
    const quoted = description.match(/:\s*["“]([\s\S]+)["”]\s*\.?$/)?.[1]
    const pageTitle = (meta['og:title'] || meta['twitter:title'] || '').replace(/\s*[•·]\s*Instagram.*$/i, '').replace(/\s+on Instagram\s*:?\s*$/i, '')
    const caption = preview.caption || quoted
    return {
      caption,
      title: preview.title || titleFrom(caption) || (pageTitle && !/^(instagram|login|log in|sign up)$/i.test(pageTitle) ? pageTitle.slice(0, 180) : undefined),
      image: preview.image || meta['og:image'] || meta['twitter:image'],
      account: preview.account,
    }
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
    if (!platform) return { metadataError: 'Use an HTTPS TikTok or Instagram post link.' }
    const signal = AbortSignal.timeout(15000)
    if (platform === 'tiktok' ? !tiktokPost(url) : !instagramCode(url)) {
      url = await resolveShareLink(url, signal)
      platform = socialPlatform(url) ?? platform
    }
    const preview = platform === 'tiktok' ? await tiktokPreview(url, signal) : await instagramPreview(url, signal)
    const title = preview.title && !/^(instagram|tiktok|login|log in|sign up)(?:\s*[|·•–—-].*)?$/i.test(preview.title) ? preview.title : undefined
    const source = includeCover ? imageUrl(preview.image) : undefined
    const postKey = platform === 'tiktok' ? `tiktok:${tiktokPost(url)?.id ?? url.pathname}` : `instagram:${instagramCode(url) ?? url.pathname}`
    const thumbnail = source ? (await storeCover(source, postKey, signal)) ?? source.toString() : undefined
    if (!title && !thumbnail) return { platform, metadataError: 'This post did not expose a public preview (it may be private, age-restricted or deleted). Enter the title manually; a cover is optional.' }
    return {
      platform,
      account: preview.account,
      title,
      caption: preview.caption?.slice(0, 2000),
      thumbnail,
      ...(!thumbnail && includeCover ? { metadataError: 'No public cover was available. You can upload one or leave it empty.' } : {}),
    }
  } catch {
    return { metadataError: 'Could not read a public preview from this link. Enter the title manually; a cover is optional.' }
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
