import { getStore } from '@netlify/blobs'
import { createFileRoute } from '@tanstack/react-router'
import { isOwnerPassword } from '@/lib/owner'

const MAX_BYTES = 5 * 1024 * 1024

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOwnerPassword(request.headers.get('x-studio-password')))) return new Response('Unauthorized', { status: 401 })
        const type = request.headers.get('content-type') ?? ''
        if (!type.startsWith('image/')) return new Response('Images only', { status: 415 })
        const body = await request.arrayBuffer()
        if (!body.byteLength || body.byteLength > MAX_BYTES) return new Response('Image too large', { status: 413 })
        const key = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
        await getStore('post-images').set(key, body, { metadata: { type } })
        return Response.json({ url: `/api/images/${key}` })
      },
    },
  },
})
