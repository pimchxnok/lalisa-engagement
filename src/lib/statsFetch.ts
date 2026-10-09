import type { Stats } from './types'

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

export type Platform = 'tiktok' | 'ig-post' | 'ig-reel'

export function normalizeFetchedStats(stats: Partial<Stats>) {
  const next: Partial<Stats> = {}

  if (stats.views !== undefined) next.views = stats.views
  if (stats.likes !== undefined) next.likes = stats.likes
  if (stats.comments !== undefined) next.comments = stats.comments
  if (stats.shares !== undefined) next.shares = stats.shares
  if (stats.saves !== undefined) next.saves = stats.saves
  if (stats.reposts !== undefined) next.reposts = stats.reposts

  return next
}
