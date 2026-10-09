import { getStore } from '@netlify/blobs'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/images/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const entry = await getStore('post-images').getWithMetadata(params.key, { type: 'arrayBuffer' })
        if (!entry) return new Response('Not found', { status: 404 })
        return new Response(entry.data, {
          headers: {
            'content-type': String(entry.metadata.type ?? 'image/jpeg'),
            'cache-control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
