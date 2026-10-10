import { createFileRoute } from '@tanstack/react-router'
import { isOwnerPassword } from '@/lib/owner'
import { clearLines, generateLines, generateSchema, getLines } from '@/lib/styles.server'

export const Route = createFileRoute('/api/style-lines')({
  server: {
    handlers: {
      /** The saved bank for one style, language and length */
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams
        const style = q.get('style') ?? ''
        const lang = q.get('lang') ?? ''
        const length = q.get('length') ?? ''
        if (!style || !['en', 'th'].includes(lang) || !['short', 'medium', 'long'].includes(length)) return Response.json({ lines: [] }, { status: 400 })
        try {
          return Response.json({ lines: await getLines(style, lang, length) }, { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ lines: [], error: 'The comment bank is unavailable right now.' }, { status: 503 })
        }
      },
      /** Owner only: writes one more batch of lines into a bank */
      POST: async ({ request }) => {
        if (!(await isOwnerPassword(request.headers.get('x-studio-password')))) return new Response('Unauthorized', { status: 401 })
        const body = generateSchema.safeParse(await request.json().catch(() => null))
        if (!body.success) return Response.json({ error: 'Invalid request' }, { status: 400 })
        try {
          return Response.json(await generateLines(body.data))
        } catch {
          return Response.json({ error: 'The line writer is unavailable right now.' }, { status: 502 })
        }
      },
      /** Owner only: empties a style's bank */
      DELETE: async ({ request }) => {
        if (!(await isOwnerPassword(request.headers.get('x-studio-password')))) return new Response('Unauthorized', { status: 401 })
        const style = new URL(request.url).searchParams.get('style')
        if (!style) return new Response('Missing style', { status: 400 })
        await clearLines(style)
        return Response.json({ ok: true })
      },
    },
  },
})
