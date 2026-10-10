import Anthropic from '@anthropic-ai/sdk'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const text = (max: number) => z.string().max(4000).transform((s) => s.trim().slice(0, max)).optional().default('')

const Body = z.object({
  typeName: text(80),
  typeDescription: text(500),
  story: z.boolean().optional().default(false),
  lang: z.enum(['en', 'th']),
  length: z.enum(['short', 'medium', 'long']),
  platform: z.enum(['tiktok', 'ig-post', 'ig-reel']),
  kind: z.enum(['lisa', 'brand', 'media']),
  account: text(60),
  postTitle: text(200),
  postCaption: text(1200),
  campaign: z.object({ name: text(80), brand: text(80), season: text(80), description: text(400) }).optional(),
  avoid: z.array(z.string().max(400)).max(40).optional().default([]),
  count: z.number().int().min(1).max(12).optional().default(10),
})

type LineBody = z.infer<typeof Body>

const lengthRule: Record<LineBody['length'], string> = {
  short: 'one short sentence (about 6–14 words; in Thai about 15–45 characters)',
  medium: 'one or two sentences (about 18–30 words; in Thai about 50–100 characters)',
  long: 'three or four sentences (about 40–60 words; in Thai about 120–200 characters)',
}

function prompt(b: LineBody) {
  const post = [
    `Platform: ${b.platform === 'tiktok' ? 'TikTok' : b.platform === 'ig-reel' ? 'Instagram Reel' : 'Instagram post'}`,
    `Posted by: ${b.account || 'unknown'} (${b.kind === 'lisa' ? "LISA's own post" : b.kind === 'brand' ? 'the brand' : 'a media outlet'})`,
    b.postTitle && `Post title: ${b.postTitle}`,
    b.postCaption && `Post caption / description: ${b.postCaption}`,
    b.campaign?.name && `Campaign: ${b.campaign.name}${b.campaign.brand ? ` by ${b.campaign.brand}` : ''}${b.campaign.season ? ` (${b.campaign.season})` : ''}`,
    b.campaign?.description && `Campaign notes: ${b.campaign.description}`,
  ].filter(Boolean).join('\n')

  return `You write ${b.story ? 'Instagram Story captions' : 'comments'} that fans of LISA (Lalisa Manobal) post on social media to support her.

The site owner defined this ${b.story ? 'caption' : 'comment'} type:
Type name: ${b.typeName || 'Fan comment'}
Type description: ${b.typeDescription || '(none)'}

The post being ${b.story ? 'shared to Story' : 'commented on'}:
${post}

Write ${b.count} different ${b.story ? 'captions' : 'comments'}.
- Follow the type name and description closely: they set the tone, angle and style.
- Refer to what this specific post is about (its title and caption) so each line clearly fits it. Do not invent facts that are not in the post details.
- Language: ${b.lang === 'th' ? 'natural, casual Thai as Thai fans write online (English names and brand names may stay in English)' : 'natural, casual English as real fans write online'}.
- Length: ${b.story ? 'very short, 2–8 words' : lengthRule[b.length]}.
- Each line may end with 1–3 fitting emojis. No hashtags and no @mentions (they are added separately).
- Every line must sound like a different real person; vary openings and wording. No numbering, no quotes around lines.
${b.avoid.length ? `- Do not repeat or closely paraphrase these existing lines:\n${b.avoid.map((l) => `  • ${l}`).join('\n')}\n` : ''}
Reply with only a JSON array of strings.`
}

function parseLines(raw: string) {
  const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) return []
  return [...new Set(parsed.filter((l): l is string => typeof l === 'string').map((l) => l.trim().replace(/^["“]|["”]$/g, '')).filter((l) => l.length > 1 && l.length <= 600))]
}

export const Route = createFileRoute('/api/lines')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = Body.safeParse(await request.json().catch(() => null))
        if (!body.success) return Response.json({ lines: [], error: 'Invalid request' }, { status: 400 })
        try {
          const message = await new Anthropic().messages.create({
            model: 'claude-haiku-5-5',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt(body.data) }],
          })
          const raw = message.content.map((part) => (part.type === 'text' ? part.text : '')).join('')
          return Response.json({ lines: parseLines(raw) }, { headers: { 'cache-control': 'no-store' } })
        } catch {
          return Response.json({ lines: [], error: 'The line writer is unavailable right now.' }, { status: 502 })
        }
      },
    },
  },
})
