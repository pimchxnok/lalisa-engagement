/**
 * Sync status utilities for Milestone 4
 * Provides hooks and helpers for displaying sync timestamps and indicators
 */

import { useMemo } from 'react'
import { useSiteData } from './store'

export type SyncStatus = 'never' | 'recent' | 'stale'

/**
 * Determine if a timestamp is recent (< 2 hours), stale (> 2 hours), or never synced
 */
export function getSyncStatus(lastSyncedAt: string): SyncStatus {
  if (!lastSyncedAt || lastSyncedAt === '') return 'never'

  const lastSync = new Date(lastSyncedAt)
  const now = new Date()
  const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60)

  if (diffMinutes < 120) return 'recent' // < 2 hours
  return 'stale'
}

/**
 * Format sync timestamp for display
 * e.g. "2 hours ago", "Yesterday", "Oct 9, 08:30"
 */
export function formatSyncTime(lastSyncedAt: string): string {
  if (!lastSyncedAt) return 'Never synced'

  const lastSync = new Date(lastSyncedAt)
  const now = new Date()
  const diffMs = now.getTime() - lastSync.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return lastSync.toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Hook: Get current sync status and formatted time
 */
export function useSyncStatus() {
  const { settings } = useSiteData()

  return useMemo(
    () => ({
      status: getSyncStatus(settings.lastSyncedAt),
      formattedTime: formatSyncTime(settings.lastSyncedAt),
      timestamp: settings.lastSyncedAt,
    }),
    [settings.lastSyncedAt]
  )
}

/**
 * Color scheme for sync status badge
 */
export const syncStatusColors = {
  never: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-600', border: 'border-amber-300' },
  recent: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-600', border: 'border-emerald-300' },
  stale: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-600', border: 'border-yellow-300' },
}
