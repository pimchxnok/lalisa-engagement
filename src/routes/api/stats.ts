import { createFileRoute } from '@tanstack/react-router'
import { fetchStats } from '@/lib/statsFetch'

export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const url = params.get('url') ?? ''
        try {
          return Response.json(await fetchStats(url, params.get('cover') !== '0'), { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ stats: {}, missing: [], error: 'Could not reach the platform — try again.' })
        }
      },
    },
  },
})
