import { createFileRoute } from '@tanstack/react-router'
import { isOwnerPassword } from '@/lib/owner'
import { BuildError, clearSet, generateLines, generateSchema, getLines, lineSetQuery } from '@/lib/styles.server'

/** Reads `system` (defaults to comment, as before sets existed), `lang` and `length` from the query string */
function setFrom(q: URLSearchParams) {
  return lineSetQuery.safeParse({ system: q.get('system') ?? 'comment', lang: q.get('lang'), length: q.get('length') })
}

export const Route = createFileRoute('/api/style-lines')({
  server: {
    handlers: {
      /** The saved bank for one style and set */
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams
        const style = q.get('style') ?? ''
        const set = setFrom(q)
        if (!style || !set.success) return Response.json({ lines: [] }, { status: 400 })
        try {
          return Response.json({ lines: await getLines(style, set.data) }, { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ lines: [], error: 'The comment bank is unavailable right now.' }, { status: 503 })
        }
      },
      /** Owner only: writes one more batch of lines into exactly one set */
      POST: async ({ request }) => {
        if (!(await isOwnerPassword(request.headers.get('x-studio-password')))) return new Response('Unauthorized', { status: 401 })
        const body = generateSchema.safeParse(await request.json().catch(() => null))
        if (!body.success) return Response.json({ error: 'Invalid request' }, { status: 400 })
        try {
          return Response.json(await generateLines(body.data))
        } catch (e) {
          if (e instanceof BuildError) return Response.json({ error: e.message }, { status: 400 })
          return Response.json({ error: 'The line writer is unavailable right now.' }, { status: 502 })
        }
      },
      /** Owner only: empties one set of a style */
      DELETE: async ({ request }) => {
        if (!(await isOwnerPassword(request.headers.get('x-studio-password')))) return new Response('Unauthorized', { status: 401 })
        const q = new URL(request.url).searchParams
        const style = q.get('style')
        const set = setFrom(q)
        if (!style || !set.success) return new Response('Missing style or set', { status: 400 })
        await clearSet(style, set.data)
        return Response.json({ ok: true })
      },
    },
  },
})
