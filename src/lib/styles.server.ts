/**
 * Built-in comment styles and their pre-written line banks, stored in Netlify Database.
 * The owner sets each style's topic, keywords, prompt and how many lines each set (system × language × length)
 * should hold. Each build request writes into exactly one set, in small batches; nothing else is created or removed.
 */
import Anthropic from '@anthropic-ai/sdk'
import { and, asc, count, desc, eq, notInArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index'
import { commentStyles, styleLines } from '../../db/schema'
import { STORY_STYLE_ID, setKey, setKeys, systemLengths, type CommentStyle, type LineSet, type StyleLine } from './styles'

/** Most lines one set can hold */
export const MAX_SET_LINES = 2000

export const styleSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[\w-]+$/),
  name: z.string().trim().min(1).max(80),
  keywords: z.array(z.string().trim().min(1).max(60)).max(40),
  prompt: z.string().max(1500),
  /** Unknown keys (e.g. an old "long" set) are dropped */
  targets: z
    .record(z.string(), z.number().int().min(0).max(MAX_SET_LINES))
    .transform((t) => Object.fromEntries(Object.entries(t).filter(([k, n]) => setKeys.includes(k) && n > 0))),
})

const setSchema = z
  .object({
    system: z.enum(['comment', 'story']),
    lang: z.enum(['en', 'th']),
    length: z.enum(['short', 'medium']),
  })
  .refine((s) => systemLengths[s.system].includes(s.length), { message: 'Story captions only come in Short' })

export const generateSchema = setSchema.and(
  z.object({
    styleId: z.string().min(1).max(60),
    count: z.number().int().min(1).max(25).default(20),
  }),
)

export const lineSetQuery = setSchema

export async function listStyles(): Promise<CommentStyle[]> {
  const rows = await db.select().from(commentStyles).orderBy(asc(commentStyles.position), asc(commentStyles.name))
  const counts = await db
    .select({ styleId: styleLines.styleId, system: styleLines.system, lang: styleLines.lang, length: styleLines.length, n: count() })
    .from(styleLines)
    .groupBy(styleLines.styleId, styleLines.system, styleLines.lang, styleLines.length)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keywords: r.keywords,
    prompt: r.prompt,
    targets: r.targets,
    story: r.id === STORY_STYLE_ID,
    counts: Object.fromEntries(counts.filter((c) => c.styleId === r.id).map((c) => [`${c.system}:${c.lang}:${c.length}`, Number(c.n)])),
  }))
}

/**
 * Saves the whole ordered list of styles and their set targets. Styles left out are deleted with their banks
 * (the Story style always stays). Lowering a target never removes lines — use `clearSet` for that.
 */
export async function saveStyles(styles: z.infer<typeof styleSchema>[]) {
  const ids = styles.map((s) => s.id)
  if (!ids.includes(STORY_STYLE_ID)) throw new Error('The Story caption style cannot be deleted')
  const now = new Date()
  for (const [position, s] of styles.entries()) {
    const values = { name: s.name, keywords: s.keywords, prompt: s.prompt, targets: s.targets, position, updatedAt: now }
    await db.insert(commentStyles).values({ id: s.id, ...values }).onConflictDoUpdate({ target: commentStyles.id, set: values })
  }
  await db.delete(commentStyles).where(notInArray(commentStyles.id, ids))
  await db.delete(styleLines).where(notInArray(styleLines.styleId, ids))
}

const inSet = (styleId: string, set: LineSet) =>
  and(eq(styleLines.styleId, styleId), eq(styleLines.system, set.system), eq(styleLines.lang, set.lang), eq(styleLines.length, set.length))

export async function getLines(styleId: string, set: LineSet): Promise<StyleLine[]> {
  const rows = await db.select({ id: styleLines.id, text: styleLines.text }).from(styleLines).where(inSet(styleId, set))
  return rows.map((r) => ({ id: `s:${r.id}`, text: r.text }))
}

/** Empties one set of a style */
export async function clearSet(styleId: string, set: LineSet) {
  await db.delete(styleLines).where(inSet(styleId, set))
}

const lengthRule = {
  short: 'one short sentence (about 6–14 words; in Thai about 15–45 characters)',
  medium: 'one or two sentences (about 18–30 words; in Thai about 50–100 characters)',
}

function prompt(style: typeof commentStyles.$inferSelect, story: boolean, lang: 'en' | 'th', length: keyof typeof lengthRule, n: number, avoid: string[]) {
  return `You write ${story ? 'Instagram Story captions' : 'comments'} that fans of LISA (Lalisa Manobal) post on social media to support her.

Topic: ${style.name}
${style.keywords.length ? `Keywords for this topic: ${style.keywords.join(', ')}` : ''}
Owner's instructions: ${style.prompt || '(none)'}

Write ${n} different ${story ? 'captions' : 'comments'}.
- Every line MUST contain the word "LISA" written exactly like that, in capital Latin letters (also in Thai lines).
- Every line must clearly fit the topic and follow the owner's instructions.
- Use the keywords naturally where they fit. A line does not need every keyword; spread them across lines and never force or list them.
- The lines are reused on many posts, so do not mention a specific post, date, place or event unless the topic or instructions name it.
- Language: ${lang === 'th' ? 'natural, casual Thai as Thai fans write online (LISA, English names and brand names stay in English)' : 'natural, casual English as real fans write online'}.
- Length: ${story ? 'very short, 2–8 words' : lengthRule[length]}.
- Each line may end with 1–3 fitting emojis. No hashtags and no @mentions (they are added separately).
- Every line must sound like a different real person; vary openings and wording. No numbering, no quotes around lines.
${avoid.length ? `- Do not repeat or closely paraphrase these existing lines:\n${avoid.map((l) => `  • ${l}`).join('\n')}\n` : ''}
Reply with only a JSON array of strings.`
}

function parseLines(raw: string) {
  const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) return []
  return [
    ...new Set(
      parsed
        .filter((l): l is string => typeof l === 'string')
        .map((l) => l.trim().replace(/^["“]|["”]$/g, '').replace(/(^|\s)[#@][^\s#@]+/g, '$1').trim())
        // Every bank line has to name LISA
        .filter((l) => l.length > 1 && l.length <= 600 && l.includes('LISA')),
    ),
  ]
}

/**
 * Writes one batch of new lines into exactly one set (style × system × language × length). Duplicates of lines already
 * in the set are skipped, existing lines are never touched, and the set's target grows when the bank passes it so the
 * Studio configuration always matches what was built. Returns how many were added and the set's new size.
 */
export async function generateLines(req: z.infer<typeof generateSchema>) {
  const [style] = await db.select().from(commentStyles).where(eq(commentStyles.id, req.styleId))
  if (!style) throw new Error('Style not found')
  const set: LineSet = { system: req.system, lang: req.lang, length: req.length }
  const where = inSet(style.id, set)
  const [{ n: have }] = await db.select({ n: count() }).from(styleLines).where(where)
  const want = Math.min(req.count, MAX_SET_LINES - Number(have))
  if (want <= 0) return { added: 0, total: Number(have) }

  const recent = await db.select({ text: styleLines.text }).from(styleLines).where(where).orderBy(desc(styleLines.id)).limit(40)
  const message = await new Anthropic().messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt(style, set.system === 'story', req.lang, req.length, want, recent.map((r) => r.text)) }],
  })
  const raw = message.content.map((part) => (part.type === 'text' ? part.text : '')).join('')
  const lines = parseLines(raw).slice(0, want)
  const added = lines.length
    ? (await db.insert(styleLines).values(lines.map((text) => ({ styleId: style.id, ...set, text }))).onConflictDoNothing().returning({ id: styleLines.id })).length
    : 0
  const total = Number(have) + added
  const key = setKey(set)
  if (total > (style.targets[key] ?? 0)) {
    await db.update(commentStyles).set({ targets: { ...style.targets, [key]: total } }).where(eq(commentStyles.id, style.id))
  }
  return { added, total }
}
