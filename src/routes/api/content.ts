import { createFileRoute } from '@tanstack/react-router'
import { loadContent, saveContent } from '@/lib/liveContent.server'
import { isOwnerPassword } from '@/lib/owner'
import type { SiteData } from '@/lib/types'

const MAX_BYTES = 4 * 1024 * 1024

function isSiteData(value: unknown): value is SiteData {
  const d = value as SiteData
  return !!d && typeof d === 'object' && !!d.settings && typeof d.settings === 'object' && ['campaigns', 'tiers', 'posts', 'lineTypes', 'customLines', 'tips'].every((k) => Array.isArray(d[k as keyof SiteData]))
}

export const Route = createFileRoute('/api/content')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await loadContent(), { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ error: 'Content is unavailable right now.' }, { status: 503 })
        }
      },
      PUT: async ({ request }) => {
        if (!(await isOwnerPassword(request.headers.get('x-studio-password')))) return new Response('Unauthorized', { status: 401 })
        const text = await request.text()
        if (text.length > MAX_BYTES) return new Response('Content too large', { status: 413 })
        let body: unknown
        try {
          body = JSON.parse(text)
        } catch {
          return new Response('Invalid JSON', { status: 400 })
        }
        if (!isSiteData(body)) return new Response('Invalid content', { status: 400 })
        return Response.json({ updatedAt: await saveContent(body) })
      },
    },
  },
})
