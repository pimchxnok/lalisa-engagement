/**
 * AI line writer. Runs on the server and calls Claude through Netlify AI Gateway,
 * which injects the credentials at runtime — no API key lives in this project.
 */
import { z } from 'zod'

export const lineRequestSchema = z.object({
  mode: z.enum(['comment', 'story']),
  lang: z.enum(['en', 'th']),
  length: z.enum(['short', 'medium', 'long']),
  typeName: z.string().max(80),
  typeDescription: z.string().max(300).default(''),
  platform: z.enum(['tiktok', 'ig-post', 'ig-reel']),
  campaign: z
    .object({ name: z.string().max(120), brand: z.string().max(120), season: z.string().max(80), description: z.string().max(500) })
    .partial()
    .optional(),
  postCaption: z.string().max(600).default(''),
  /** Lines already shown or copied, so the writer doesn't repeat them */
  avoid: z.array(z.string().max(400)).max(12).default([]),
})

export type LineRequest = z.infer<typeof lineRequestSchema>

const lengthGuide = {
  short: 'one short sentence, under 60 characters',
  medium: 'one or two sentences, under 120 characters',
  long: 'two to four sentences, under 280 characters',
}

export async function writeLine(req: LineRequest): Promise<string> {
  const base = process.env.NETLIFY_AI_GATEWAY_BASE_URL
  const key = process.env.NETLIFY_AI_GATEWAY_KEY
  if (!base || !key) throw new Error('AI Gateway is not available')

  const c = req.campaign
  const what = req.mode === 'story' ? 'a caption for sharing this post to an Instagram Story' : `a fan comment for this ${req.platform === 'tiktok' ? 'TikTok' : 'Instagram'} post`
  const length = req.mode === 'story' ? lengthGuide.short : lengthGuide[req.length]
  const prompt = [
    `Write ${what} about LISA (Lalisa Manobal).`,
    `Style: ${req.typeName}${req.typeDescription ? ` — ${req.typeDescription}` : ''}.`,
    c?.name || c?.brand ? `Campaign: ${[c.brand, c.name, c.season].filter(Boolean).join(' · ')}${c.description ? `. ${c.description}` : ''}` : '',
    req.postCaption ? `The post's caption: """${req.postCaption}"""` : '',
    `Language: ${req.lang === 'th' ? 'Thai (natural, casual fan Thai)' : 'English'}. Length: ${length}.`,
    'Sound like a real, warm fan — specific, positive, no spam phrases, no hashtags, no @mentions, no quotation marks. At most two emoji.',
    req.avoid.length ? `Do not repeat or closely paraphrase any of these:\n${req.avoid.map((l) => `- ${l}`).join('\n')}` : '',
    'Reply with the line only.',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await fetch(`${base}/anthropic/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 300, temperature: 1, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`AI Gateway returned ${response.status}`)
  const data = (await response.json()) as { content?: { type: string; text?: string }[] }
  const text = data.content?.find((b) => b.type === 'text')?.text?.trim().replace(/^["“”']+|["“”']+$/g, '').replace(/(^|\s)[#@][^\s#@]+/g, '$1').trim()
  if (!text) throw new Error('Empty reply')
  return text
}
