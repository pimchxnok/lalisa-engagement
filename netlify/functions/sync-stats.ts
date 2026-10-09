/**
 * Scheduled Netlify Function: Auto-sync engagement stats every 30 minutes
 * - Fetches latest metrics from SourceVine API for all posts with URLs
 * - Updates post stats and lastSyncedAt timestamp
 * - Keeps owner-entered values for private metrics (saves, shares, reposts)
 *
 * Schedule: "0 */30 * * * *" (every 30 minutes)
 * Docs: https://docs.netlify.com/functions/scheduled-functions/
 */

import type { Post, SiteData, Stats } from '../src/lib/types'

interface SourcevineResponse {
  success?: boolean
  available?: boolean
  error?: string
  message?: string
  data?: {
    views?: number | string | null
    likes?: number | string | null
    comments?: number | string | null
    shares?: number | string | null
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

async function fetchStatsFromSourcevine(url: string): Promise<Partial<Stats> | null> {
  try {
    const apiKey = process.env.SOURCEVINE_API_KEY
    if (!apiKey) return null

    const endpoint = url.includes('tiktok') 
      ? 'https://api.sourcevine.io/v1/tiktok/stats'
      : 'https://api.sourcevine.io/v1/instagram/stats'

    const apiUrl = new URL(endpoint)
    apiUrl.searchParams.set('url', url)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.warn(`[sync-stats] SourceVine API error for ${url}: ${response.status}`)
      return null
    }

    const result = (await response.json()) as SourcevineResponse

    if (result.success !== true || result.available === false || !result.data) {
      console.warn(`[sync-stats] SourceVine unavailable for ${url}: ${result.message || result.error}`)
      return null
    }

    const data = result.data
    const stats: Partial<Stats> = {}

    // Public metrics — safe to update
    const views = num(data.views)
    const likes = num(data.likes)
    const comments = num(data.comments)
    const shares = num(data.shares)

    if (views !== undefined) stats.views = views
    if (likes !== undefined) stats.likes = likes
    if (comments !== undefined) stats.comments = comments
    if (shares !== undefined) stats.shares = shares

    // Private metrics (Instagram doesn't expose these)
    // — only update if SourceVine provides them AND they're non-zero
    const saves = num(data.saves)
    const reposts = num(data.reposts)

    if (saves !== undefined && saves > 0) stats.saves = saves
    if (reposts !== undefined && reposts > 0) stats.reposts = reposts

    return stats
  } catch (err) {
    console.warn(`[sync-stats] Exception fetching from SourceVine:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Apply synced stats to a post, keeping owner's values for private metrics
 */
function applyStats(post: Post, synced: Partial<Stats>): Post {
  const stats: Stats = { ...post.stats }

  // Update public metrics
  if (synced.views !== undefined) stats.views = synced.views
  if (synced.likes !== undefined) stats.likes = synced.likes
  if (synced.comments !== undefined) stats.comments = synced.comments
  if (synced.shares !== undefined) stats.shares = synced.shares

  // Only update private metrics if provided (IG usually doesn't expose these)
  if (synced.saves !== undefined) stats.saves = synced.saves
  if (synced.reposts !== undefined) stats.reposts = synced.reposts

  return {
    ...post,
    stats,
    lastSyncedAt: new Date().toISOString(),
  }
}

/**
 * Media posts use their comment count as the de-facto goal
 * (commentGoal field is only for LISA & Brand posts)
 */
function updateMediaGoal(post: Post): Post {
  if (post.kind === 'media') {
    return {
      ...post,
      // For media, the current comment count IS the engagement target
      // No separate commentGoal — just display stats.comments
    }
  }
  return post
}

export default async function handler(req: any, context: any) {
  const startTime = new Date().toISOString()
  console.log(`[sync-stats] Starting scheduled sync at ${startTime}`)

  const apiKey = process.env.SOURCEVINE_API_KEY
  if (!apiKey) {
    console.warn('[sync-stats] SOURCEVINE_API_KEY not configured — skipping sync')
    return new Response(
      JSON.stringify({ message: 'API key not configured' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  try {
    // TODO: Milestone 2 — Load data from Netlify Database / Blobs instead of fixtures
    // For now, this is a placeholder that logs what WOULD be synced
    const data = {
      posts: [],
      settings: {
        lastSyncedAt: startTime,
      },
    } as any

    const postsToSync = data.posts?.filter((p: Post) => p.url && p.url.trim()) || []
    console.log(`[sync-stats] Would sync ${postsToSync.length} posts (waiting for Milestone 2 DB integration)`)

    let synced = 0
    let failed = 0

    for (const post of postsToSync) {
      const fetched = await fetchStatsFromSourcevine(post.url)
      if (!fetched) {
        failed++
        continue
      }

      // Apply synced stats and update media goals
      const updated = updateMediaGoal(applyStats(post, fetched))
      const idx = data.posts.findIndex((p: Post) => p.id === post.id)
      if (idx >= 0) {
        data.posts[idx] = updated
        synced++
        console.log(`[sync-stats] Synced post ${post.id}: ${synced} done`)
      }
    }

    data.settings.lastSyncedAt = new Date().toISOString()

    // TODO: Milestone 2 — Save data.posts and settings back to Netlify Database

    const result = {
      synced,
      failed,
      total: postsToSync.length,
      lastSyncedAt: data.settings.lastSyncedAt,
      message: 'Sync complete (DB integration pending)',
    }

    console.log(`[sync-stats] Sync complete:`, result)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('[sync-stats] Fatal error:', err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({
        error: 'Sync failed',
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

export const schedule = '0 */30 * * * *' // Every 30 minutes
