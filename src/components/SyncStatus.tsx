/**
 * Sync Status Badge Component
 * Display last sync time and health indicator on Home page and studio
 */

import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatSyncTime, syncStatusColors, useSyncStatus } from '@/lib/syncStatus'

export function SyncStatusBadge({
  showAction,
  compact,
}: {
  showAction?: () => void
  compact?: boolean
}) {
  const { status, formattedTime } = useSyncStatus()
  const colors = syncStatusColors[status]

  if (compact) {
    return (
      <span
        className={`inline-block size-2.5 rounded-full ${colors.dot}`}
        title={`Stats last synced ${formattedTime}`}
        role="img"
        aria-label={`Sync status: ${formattedTime}`}
      />
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}
    >
      <span className={`inline-block size-2 rounded-full ${colors.dot}`} />
      <span>Last synced: {formattedTime}</span>
      {showAction && (
        <button
          onClick={showAction}
          className="ml-1 inline-flex items-center gap-1 rounded-full hover:opacity-70 transition-opacity"
          title="Refresh stats now (manual)"
        >
          <RefreshCw className="size-3" />
        </button>
      )}
    </div>
  )
}

/**
 * Sync Status Info Line: For detail pages
 * "Last synced: 2 hours ago · 156 comments on this post"
 */
export function SyncStatusInfo({ children }: { children?: ReactNode }): ReactNode {
  const { formattedTime } = useSyncStatus()

  return (
    <p className="text-xs text-gold-600 uppercase tracking-[0.2em]">
      Last synced: {formattedTime}
      {children && <> · {children}</> }
    </p>
  )
}
