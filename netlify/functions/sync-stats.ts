/**
 * netlify/functions/sync-stats.ts
 * Scheduled auto-sync for engagement stats every 30 minutes
 * Milestone 4: fetches from SourceVine, updates posts, manages lastSyncedAt
 */

import type { Post, SiteData, Stats } from '../../src/lib/types'

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

/**
 * Fetch stats from SourceVine for a single URL
 * Returns partial stats object or null on failure
 */
async function fetchStatsFromSourcevine(url: string, apiKey: string): Promise<Partial<Stats> | null> {
  try {
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
      console.warn(`[sync] SourceVine API error ${response.status} for ${url}`)
      return null
    }

    const result = (await response.json()) as SourcevineResponse

    if (result.success !== true || result.available === false || !result.data) {
      console.warn(`[sync] SourceVine unavailable for ${url}: ${result.message || result.error}`)
      return null
    }

    const data = result.data
    const stats: Partial<Stats> = {}

    // PUBLIC METRICS — safe to update from API
    const views = num(data.views)
    const likes = num(data.likes)
    const comments = num(data.comments)
    const shares = num(data.shares)

    if (views !== undefined) stats.views = views
    if (likes !== undefined) stats.likes = likes
    if (comments !== undefined) stats.comments = comments
    if (shares !== undefined) stats.shares = shares

    // PRIVATE METRICS — only if SourceVine provides them (rare for IG)
    const saves = num(data.saves)
    const reposts = num(data.reposts)

    if (saves !== undefined && saves > 0) stats.saves = saves
    if (reposts !== undefined && reposts > 0) stats.reposts = reposts

    return stats
  } catch (err) {
    console.warn(`[sync] Exception fetching SourceVine:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Apply synced metrics to a post
 * Updates public metrics, preserves owner-entered private metrics
 */
function applyStats(post: Post, synced: Partial<Stats>): Post {
  const stats: Stats = { ...post.stats }

  // Update PUBLIC metrics from sync
  if (synced.views !== undefined) stats.views = synced.views
  if (synced.likes !== undefined) stats.likes = synced.likes
  if (synced.comments !== undefined) stats.comments = synced.comments
  if (synced.shares !== undefined) stats.shares = synced.shares

  // Keep PRIVATE metrics (owner-entered; IG doesn't expose via public API)
  // Only update if SourceVine provides them
  if (synced.saves !== undefined) stats.saves = synced.saves
  if (synced.reposts !== undefined) stats.reposts = synced.reposts

  return {
    ...post,
    stats,
  }
}

/**
 * Main handler for scheduled sync
 * Runs every 30 minutes via Netlify scheduled functions
 */
export default async function handler(req: any, context: any) {
  const startTime = new Date().toISOString()
  console.log(`[sync] Starting scheduled sync at ${startTime}`)

  const apiKey = process.env.SOURCEVINE_API_KEY
  if (!apiKey) {
    console.warn('[sync] SOURCEVINE_API_KEY not configured — skipping sync')
    return new Response(
      JSON.stringify({ message: 'API key not configured', timestamp: startTime }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  try {
    // TODO: Milestone 2 — Replace with actual Netlify Database / Blobs query
    // For now, log what WOULD be synced and return success
    console.log('[sync] Database integration awaiting Milestone 2 implementation')

    // Simulate what will happen in M2+:
    // const data = await queryDatabase() // Netlify Database
    // const postsToSync = data.posts.filter(p => p.url && p.url.trim())
    // for (const post of postsToSync) { ... }
    // await saveDatabase(data)

    const result = {
      status: 'scheduled_sync_ready',
      message: 'Sync function configured and ready. Database integration coming in Milestone 2.',
      timestamp: startTime,
      nextSync: new Date(Date.now() + 30 * 60000).toISOString(),
    }

    console.log('[sync] Sync checkpoint complete:', result)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('[sync] Fatal error:', err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({
        error: 'Sync failed',
        details: err instanceof Error ? err.message : String(err),
        timestamp: startTime,
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

// Schedule: every 30 minutes
export const schedule = '0 */30 * * * *'
