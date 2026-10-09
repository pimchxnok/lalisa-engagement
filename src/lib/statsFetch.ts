
import type { Platform, Stats } from './types'
import { fetchPostMetadata } from './postMetadata'

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

type SourcevineResponse = {
  success?: boolean
  available?: boolean
  error?: string
  message?: string
  data?: {
    url?: string
    channelName?: string
    channelLink?: string
    contentType?: string
    views?: number | string | null
    likes?: number | string | null
    comments?: number | string | null
    shares?: number | string | null
    collects?: number | string | null
    saves?: number | string | null
    reposts?: number | string | null
  }
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function isPlatformHost(host: string, platform: 'tiktok' | 'instagram') {
  const hostname = host.toLowerCase().replace(/^www\./, '')
  if (platform === 'tiktok') {
    return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')
  }
  return hostname === 'instagram.com' || hostname.endsWith('.instagram.com')
}

async function fetchMetrics(rawUrl: string): Promise<FetchedStats> {
  let url: URL

  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { stats: {}, missing: [], error: 'That link is not a valid URL.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { stats: {}, missing: [], error: 'Please use a public post link.' }
  }

  const isTikTok = isPlatformHost(url.hostname, 'tiktok')
  const isInstagram = isPlatformHost(url.hostname, 'instagram')

  if (!isTikTok && !isInstagram) {
    return {
      stats: {},
      missing: [],
      error: 'Only TikTok and Instagram links are supported.',
    }
  }

  const endpoint = isTikTok
    ? 'https://api.sourcevine.io/v1/tiktok/stats'
    : 'https://api.sourcevine.io/v1/instagram/stats'

  const platform: Platform = isTikTok ? 'tiktok' : 'ig-post'

  // This function runs on the server. Never expose this key to browser code.
  const apiKey = process.env.SOURCEVINE_API_KEY

  if (!apiKey) {
    return {
      platform,
      stats: {},
      missing: [],
      error: 'Stats service is not configured yet.',
    }
  }

  try {
    const apiUrl = new URL(endpoint)
    apiUrl.searchParams.set('url', url.toString())

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return {
        platform,
        stats: {},
        missing: [],
        error:
          response.status === 429
            ? 'Too many requests. Please try again later.'
            : 'Could not fetch stats for this post. Please try again.',
      }
    }

    const result = (await response.json()) as SourcevineResponse

    if (result.success !== true || result.available === false || !result.data) {
      return {
        platform,
        stats: {},
        missing: [],
        error: result.message || result.error || 'Stats are not available for this link.',
      }
    }

    const data = result.data
    const views = num(data.views)
    const likes = num(data.likes)
    const comments = num(data.comments)
    const shares = num(data.shares)
    const saves = num(data.saves ?? data.collects)
    const reposts = num(data.reposts)

    const stats: Partial<Stats> = {
      ...(views !== undefined ? { views } : {}),
      ...(likes !== undefined ? { likes } : {}),
      ...(comments !== undefined ? { comments } : {}),
      ...(shares !== undefined ? { shares } : {}),
      ...(saves !== undefined ? { saves } : {}),
      ...(reposts !== undefined ? { reposts } : {}),
    }

    const keys: (keyof Stats)[] = [
      'views',
      'likes',
      'comments',
      'shares',
      'saves',
      'reposts',
    ]

    return {
      platform:
        isTikTok
          ? 'tiktok'
          : data.contentType?.toLowerCase().includes('video')
            ? 'ig-reel'
            : 'ig-post',
      account: data.channelName ? `@${data.channelName}` : undefined,
      stats,
      missing: keys.filter((key) => stats[key] === undefined),
    }
  } catch {
    return {
      platform,
      stats: {},
      missing: [],
      error: 'Could not reach the stats service. Please try again.',
    }
  }
}

export async function fetchStats(rawUrl: string, includeCover = true): Promise<FetchedStats> {
  const [metrics, metadata] = await Promise.all([fetchMetrics(rawUrl), fetchPostMetadata(rawUrl, includeCover)])
  return { ...metrics, ...metadata, account: metrics.account ?? metadata.account, platform: metadata.platform === 'ig-reel' ? metadata.platform : metrics.platform ?? metadata.platform }
}
