import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { isOwnerPassword } from '@/lib/owner'
import { listStyles, saveStyles, styleSchema } from '@/lib/styles.server'

export const Route = createFileRoute('/api/styles')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json({ styles: await listStyles() }, { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ error: 'Styles are unavailable right now.' }, { status: 503 })
        }
      },
      /** Replaces the owner's ordered list of styles */
      PUT: async ({ request }) => {
        if (!(await isOwnerPassword(request.headers.get('x-studio-password')))) return new Response('Unauthorized', { status: 401 })
        const body = z.object({ styles: z.array(styleSchema).min(1).max(100) }).safeParse(await request.json().catch(() => null))
        if (!body.success) return Response.json({ error: 'Invalid styles' }, { status: 400 })
        if (new Set(body.data.styles.map((s) => s.id)).size !== body.data.styles.length) return Response.json({ error: 'Duplicate style ids' }, { status: 400 })
        try {
          await saveStyles(body.data.styles)
          return Response.json({ styles: await listStyles() })
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : 'Could not save styles' }, { status: 400 })
        }
      },
    },
  },
})
