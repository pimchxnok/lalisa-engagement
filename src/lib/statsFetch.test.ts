import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMetrics, readSourcevine } from './statsFetch'

const REEL = 'https://www.instagram.com/reel/DeO60IcN_Pb/?vrfl=abc123&igsh=xyz'

const sourcevineOk = {
  success: true,
  available: true,
  data: { postId: 'DeO60IcN_Pb', username: 'louisvuitton', views: 6953505, likes: 111716, comments: 2313, saves: null, mediaType: 'video' },
}

// Embed page with stale/rounded public numbers, as Instagram shows them
const embedHtml = '<div class="EmbedVideo"></div><span> 98K likes </span><a> View all 2,001 comments </a><span> 1.2M views </span>'

type Route = (url: URL) => Response | Promise<Response>

function mockFetch(sourcevine: Route, page: Route = () => html(embedHtml)) {
  const calls: URL[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    calls.push(url)
    return url.hostname === 'api.sourcevine.io' ? sourcevine(url) : page(url)
  }))
  return calls
}

const html = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.stubEnv('SOURCEVINE_API_KEY', 'test-key')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('readSourcevine', () => {
  const signal = () => AbortSignal.timeout(5000)

  it('sends the canonical Reel URL without query params and keeps the Reel ID', async () => {
    const calls = mockFetch(() => json(sourcevineOk))
    await readSourcevine(new URL(REEL), 'ig-reel', signal())
    const api = calls.find((u) => u.hostname === 'api.sourcevine.io')!
    expect(api.pathname).toBe('/v1/instagram/stats')
    expect(api.searchParams.get('url')).toBe('https://www.instagram.com/reel/DeO60IcN_Pb/')
  })

  it('normalizes /reels/ links to /reel/', async () => {
    const calls = mockFetch(() => json(sourcevineOk))
    await readSourcevine(new URL('https://instagram.com/reels/DeO60IcN_Pb/?vrfl=1'), 'ig-reel', signal())
    expect(calls[0].searchParams.get('url')).toBe('https://www.instagram.com/reel/DeO60IcN_Pb/')
  })

  it('parses views, likes and comments from a successful response', async () => {
    mockFetch(() => json(sourcevineOk))
    const result = await readSourcevine(new URL(REEL), 'ig-reel', signal())
    expect(result?.stats).toEqual({ views: 6953505, likes: 111716, comments: 2313 })
  })

  it('leaves null or absent metrics out instead of reporting zero', async () => {
    mockFetch(() => json({ success: true, available: true, data: { views: 500, likes: null } }))
    const result = await readSourcevine(new URL(REEL), 'ig-reel', signal())
    expect(result?.stats).toEqual({ views: 500 })
    expect(result?.stats).not.toHaveProperty('likes')
    expect(result?.stats).not.toHaveProperty('comments')
    expect(result?.stats).not.toHaveProperty('saves')
  })

  it('returns nothing and makes no request when the API key is missing', async () => {
    vi.stubEnv('SOURCEVINE_API_KEY', '')
    const calls = mockFetch(() => json(sourcevineOk))
    expect(await readSourcevine(new URL(REEL), 'ig-reel', signal())).toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  it.each([401, 402, 429, 500])('returns nothing on HTTP %i (bad key, no credits, rate limit, outage)', async (status) => {
    mockFetch(() => json({ success: false, error: 'nope' }, status))
    expect(await readSourcevine(new URL(REEL), 'ig-reel', signal())).toBeUndefined()
  })

  it.each([
    ['success false', { success: false, data: { views: 1 } }],
    ['unavailable', { success: true, available: false, data: { views: 1 } }],
    ['no data', { success: true, available: true }],
  ])('returns nothing when the response is %s', async (_, body) => {
    mockFetch(() => json(body))
    expect(await readSourcevine(new URL(REEL), 'ig-reel', signal())).toBeUndefined()
  })

  it('returns nothing when the request throws or the body is not JSON', async () => {
    mockFetch(() => { throw new Error('network down') })
    expect(await readSourcevine(new URL(REEL), 'ig-reel', signal())).toBeUndefined()
    mockFetch(() => new Response('<html>gateway</html>', { status: 200 }))
    expect(await readSourcevine(new URL(REEL), 'ig-reel', signal())).toBeUndefined()
  })
})

describe('fetchMetrics for Instagram Reels', () => {
  it('prefers SourceVine numbers over the public embed page', async () => {
    mockFetch(() => json(sourcevineOk))
    const result = await fetchMetrics(REEL)
    expect(result.platform).toBe('ig-reel')
    expect(result.stats).toMatchObject({ views: 6953505, likes: 111716, comments: 2313 })
    expect(result.missing).not.toContain('views')
  })

  it('fills only the gaps SourceVine left from the public page', async () => {
    mockFetch(() => json({ success: true, available: true, data: { views: 6953505, likes: null } }))
    const result = await fetchMetrics(REEL)
    // Rounded `98K likes` is not an exact count, so only the exact comment count is filled
    expect(result.stats).toEqual({ views: 6953505, comments: 2001 })
  })

  it('keeps Reel views missing and explains why when SourceVine is out of credits', async () => {
    mockFetch(() => json({ success: false, error: { code: 'credits_exhausted' } }, 402))
    const result = await fetchMetrics(REEL)
    expect(result.stats).toEqual({ comments: 2001 })
    expect(result.missing).toContain('views')
    expect(result.notice).toMatch(/out of credits/)
  })

  it('reports metrics as missing, not zero, when no source has them', async () => {
    mockFetch(() => json({ success: true, available: true, data: { views: 10 } }), () => html('<html></html>'))
    const result = await fetchMetrics(REEL)
    expect(result.stats).toEqual({ views: 10 })
    expect(result.missing).toEqual(expect.arrayContaining(['likes', 'comments']))
  })
})

describe('fetchMetrics for other platforms', () => {
  it('does not call SourceVine for regular Instagram posts', async () => {
    const calls = mockFetch(() => json(sourcevineOk), () => html('<span> 5 likes </span>'))
    const result = await fetchMetrics('https://www.instagram.com/p/ABC123/')
    expect(result.platform).toBe('ig-post')
    expect(result.stats).toEqual({ likes: 5 })
    expect(calls.some((u) => u.hostname === 'api.sourcevine.io')).toBe(false)
  })

  it('does not call SourceVine for TikTok', async () => {
    const calls = mockFetch(() => json(sourcevineOk), () => html('<html></html>'))
    await fetchMetrics('https://www.tiktok.com/@user/video/1234567890')
    expect(calls.some((u) => u.hostname === 'api.sourcevine.io')).toBe(false)
  })
})
