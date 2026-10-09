import { createFileRoute } from '@tanstack/react-router'
import { fetchStats } from '@/lib/statsFetch'

export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url).searchParams.get('url') ?? ''
        try {
          return Response.json(await fetchStats(url), { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ stats: {}, missing: [], error: 'Could not reach the platform — try again.' })
        }
      },
    },
  },
})
