import { createFileRoute } from '@tanstack/react-router'
import { syncStale } from '@/lib/liveContent.server'

// Open pages call this about once a minute; each post is read at most once per window however many visitors are online
export const Route = createFileRoute('/api/live-sync')({
  server: {
    handlers: {
      POST: async () => {
        try {
          const refreshed = await syncStale({ maxAgeMs: 2 * 60 * 1000, budgetMs: 8000 })
          return Response.json({ refreshed }, { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ refreshed: 0 })
        }
      },
    },
  },
})
