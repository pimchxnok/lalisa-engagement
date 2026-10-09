import { createFileRoute } from '@tanstack/react-router'
import { lineRequestSchema, writeLine } from '@/lib/aiWriter'

export const Route = createFileRoute('/api/write-line')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = lineRequestSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })
        try {
          return Response.json({ text: await writeLine(parsed.data) }, { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ error: 'The AI writer is busy — try again or use Random.' }, { status: 502 })
        }
      },
    },
  },
})
