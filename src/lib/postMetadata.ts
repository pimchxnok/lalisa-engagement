import type { Platform } from './types'

type PostMetadata = {
  title?: string
  caption?: string
  thumbnail?: string
  platform?: Platform
  metadataError?: string
}

function socialPlatform(url: URL): Platform | undefined {
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined
  const host = url.hostname.toLowerCase()
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
  if (['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(host)) {
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

function publicImage(value: unknown) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(decodeText(value))
    const hosts = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com', 'ibytedtos.com', 'byteoversea.com', 'muscdn.com', 'cdninstagram.com', 'fbcdn.net', 'instagram.com']
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return url.toString()
  } catch {
    return undefined
  }
  return undefined
}

async function readLimited(response: Response) {
  if (!response.ok || !response.body) throw new Error('Unavailable')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 1_000_000) throw new Error('Response too large')
      text += decoder.decode(chunk.value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    await reader.cancel()
  }
}

async function fetchPage(initial: URL, signal: AbortSignal) {
  let url = initial
  for (let redirects = 0; redirects < 4; redirects++) {
    if (!socialPlatform(url)) throw new Error('Unsupported redirect')
    const response = await fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/html' } })
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
    return { html: await readLimited(response), url }
  }
  throw new Error('Too many redirects')
}

function readMeta(html: string) {
  const meta: Record<string, string> = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes: Record<string, string> = {}
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes[match[1].toLowerCase()] = decodeText(match[2] ?? match[3] ?? match[4] ?? '')
    }
    const key = attributes.property || attributes.name
    if (key && attributes.content) meta[key.toLowerCase()] = attributes.content
  }
  return meta
}

export async function fetchPostMetadata(rawUrl: string, includeCover = true): Promise<PostMetadata> {
  try {
    const initial = new URL(rawUrl.trim())
    let platform = socialPlatform(initial)
    if (!platform) return { metadataError: 'Use an HTTPS TikTok or Instagram post link.' }
    const signal = AbortSignal.timeout(10000)
    let url = initial
    let meta: Record<string, string> = {}
    if (platform !== 'tiktok' || !/\/@[^/]+\/video\/\d+/.test(initial.pathname)) {
      const page = await fetchPage(initial, signal)
      url = page.url
      platform = socialPlatform(url) ?? platform
      meta = readMeta(page.html)
    }
    if (platform === 'tiktok') {
      try {
        const endpoint = new URL('https://www.tiktok.com/oembed')
        endpoint.searchParams.set('url', url.toString())
        const response = await fetch(endpoint, { signal, redirect: 'error', headers: { Accept: 'application/json' } })
        const result = JSON.parse(await readLimited(response)) as { title?: unknown; thumbnail_url?: unknown }
        const title = typeof result.title === 'string' ? result.title.trim().slice(0, 2000) : undefined
        const thumbnail = includeCover ? publicImage(result.thumbnail_url) : undefined
        if (title || thumbnail) return { platform, title: title?.split('\n')[0].slice(0, 180), caption: title, thumbnail }
      } catch {
        if (!Object.keys(meta).length) meta = readMeta((await fetchPage(url, signal)).html)
      }
    }
    const caption = meta['og:description'] || meta['description']
    const candidate = meta['og:title'] || meta['twitter:title'] || caption
    const title = candidate && !/^(instagram|tiktok|login|log in|sign up)(?:\s*[|·•–—-].*)?$/i.test(candidate) ? candidate.split('\n')[0].slice(0, 180) : undefined
    const thumbnail = includeCover ? publicImage(meta['og:image'] || meta['twitter:image']) : undefined
    if (!title && !thumbnail) return { platform, metadataError: 'This platform did not expose a public preview. Enter the post title manually; a cover is optional.' }
    return { platform, title, caption: caption?.slice(0, 2000), thumbnail, ...(!thumbnail && includeCover ? { metadataError: 'No public cover was available. You can add one manually or leave it empty.' } : {}) }
  } catch {
    return { metadataError: 'Could not read a public preview from this link. Enter the title manually; a cover is optional.' }
  }
}
