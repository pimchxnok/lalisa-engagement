/**
 * src/routes/api/sync/manual.ts
 * Manual sync endpoint for Owner Studio
 * Allows testing sync before full DB integration
 */

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/sync/manual')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.SOURCEVINE_API_KEY
          if (!apiKey) {
            return Response.json(
              { error: 'SOURCEVINE_API_KEY not configured' },
              { status: 400 }
            )
          }

          const body = await request.json() as { urls: string[] }
          const urls = body.urls || []

          if (!Array.isArray(urls) || urls.length === 0) {
            return Response.json(
              { error: 'urls array required' },
              { status: 400 }
            )
          }

          console.log(`[sync/manual] Syncing ${urls.length} URLs`)

          const results = []
          for (const url of urls) {
            try {
              const endpoint = url.includes('tiktok')
                ? 'https://api.sourcevine.io/v1/tiktok/stats'
                : 'https://api.sourcevine.io/v1/instagram/stats'

              const apiUrl = new URL(endpoint)
              apiUrl.searchParams.set('url', url)

              const res = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  Accept: 'application/json',
                },
                signal: AbortSignal.timeout(15000),
              })

              if (res.ok) {
                const data = await res.json()
                results.push({ url, success: true, data })
              } else {
                results.push({ url, success: false, status: res.status })
              }
            } catch (err) {
              results.push({ url, success: false, error: (err as Error).message })
            }
          }

          return Response.json(
            {
              synced: results.filter(r => r.success).length,
              failed: results.filter(r => !r.success).length,
              total: urls.length,
              results,
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          )
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          )
        }
      },
    },
  },
})
