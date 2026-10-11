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
import { STORY_STYLE_ID, setKey, setKeys, systemLengths, type BuildResult, type CommentStyle, type LineSet, type StyleLine } from './styles'

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
    /** The keywords for this build job; the style's saved keywords are used when left out */
    keywords: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
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

/** Character ranges a line must fall in to count as the chosen length; lines outside are dropped, not trimmed */
const lengthRange = {
  story: { en: [4, 70], th: [4, 70] },
  short: { en: [15, 110], th: [10, 90] },
  medium: { en: [60, 240], th: [35, 200] },
} as const

function prompt(style: typeof commentStyles.$inferSelect, keywords: string[], set: LineSet, n: number, avoid: string[]) {
  const story = set.system === 'story'
  return `You write ${story ? 'Instagram Story captions' : 'comments'} that fans of LISA (Lalisa Manobal) post on social media to support her.

Topic: ${style.name}
Keywords (the ONLY source of subject matter): ${keywords.join(', ')}
Owner's instructions on tone: ${style.prompt || '(none)'}

Write ${n} different ${story ? 'captions' : 'comments'}.
- Every line MUST contain the word "LISA" written exactly like that, in capital Latin letters (also in Thai lines).
- Every line MUST contain at least one of the keywords above, written exactly as given (keep English keywords in English inside Thai lines).
- Build each line only around the keywords. Do not add facts, names, brands, products, places, dates, events, numbers or claims that are not in the keywords or the topic. No off-topic lines.
- A line does not need every keyword; spread them across lines and use them naturally, never as a list.
- The lines are reused on many posts, so do not mention a specific post.
- Language: ${set.lang === 'th' ? 'natural, casual Thai as Thai fans write online (LISA, English names and brand names stay in English)' : 'natural, casual English as real fans write online'}.
- Length: ${story ? 'very short, 2–8 words' : lengthRule[set.length as keyof typeof lengthRule]}.
- Each line may end with 1–3 fitting emojis. No hashtags and no @mentions (they are added separately).
- Every line must sound like a different real person; vary openings and wording. No numbering, no quotes around lines.
${avoid.length ? `- Do not repeat or closely paraphrase these existing lines:\n${avoid.map((l) => `  • ${l}`).join('\n')}\n` : ''}
Reply with only a JSON array of strings.`
}

function parseLines(raw: string) {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end < start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.trim().replace(/^["“]|["”]$/g, '').replace(/(^|\s)[#@][^\s#@]+/g, '$1').replace(/\s+/g, ' ').trim())
}

/** Comparison form for duplicate checks: case, spacing, punctuation and emoji don't make a line new */
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * Writes one batch of new lines into exactly one set (style × system × language × length), using the job's keywords
 * as the only subject matter. Each line must name LISA, contain a keyword and fit the length; lines that repeat any
 * saved line of the style in this language are skipped. Existing lines are never touched. The set's target grows when
 * the bank passes it so the Studio configuration matches what was built. Returns what was added and why the rest wasn't.
 */
export async function generateLines(req: z.infer<typeof generateSchema>): Promise<BuildResult> {
  const [style] = await db.select().from(commentStyles).where(eq(commentStyles.id, req.styleId))
  if (!style) throw new BuildError('Style not found')
  const keywords = [...new Set((req.keywords ?? style.keywords).map((k) => k.trim()).filter(Boolean))]
  if (!keywords.length) throw new BuildError('Add at least one keyword for this build — lines are written only from your keywords.')
  const set: LineSet = { system: req.system, lang: req.lang, length: req.length }
  const where = inSet(style.id, set)
  const [{ n: haveRaw }] = await db.select({ n: count() }).from(styleLines).where(where)
  const have = Number(haveRaw)
  const want = Math.min(req.count, MAX_SET_LINES - have)
  const skipped = { duplicate: 0, offKeyword: 0, length: 0, invalid: 0 }
  if (want <= 0) return { added: 0, total: have, skipped, capped: true }

  // Every saved line of this style in this language, across its sets, so nothing already written comes back
  const existing = await db
    .select({ text: styleLines.text })
    .from(styleLines)
    .where(and(eq(styleLines.styleId, style.id), eq(styleLines.lang, set.lang)))
  const seen = new Set(existing.map((r) => normalize(r.text)))
  const recent = await db.select({ text: styleLines.text }).from(styleLines).where(where).orderBy(desc(styleLines.id)).limit(40)

  const message = await new Anthropic().messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt(style, keywords, set, want, recent.map((r) => r.text)) }],
  })
  const raw = message.content.map((part) => (part.type === 'text' ? part.text : '')).join('')
  const [min, max] = lengthRange[set.system === 'story' ? 'story' : req.length][set.lang]
  const lowered = keywords.map((k) => k.toLowerCase())
  const fresh: string[] = []
  for (const line of parseLines(raw)) {
    if (fresh.length >= want) break
    const key = normalize(line)
    if (!key || !line.includes('LISA')) skipped.invalid++
    else if (line.length < min || line.length > max) skipped.length++
    else if (!lowered.some((k) => line.toLowerCase().includes(k))) skipped.offKeyword++
    else if (seen.has(key)) skipped.duplicate++
    else {
      seen.add(key)
      fresh.push(line)
    }
  }
  // The unique index is the last guard: a line saved by a parallel build is skipped, never overwritten
  const inserted = fresh.length
    ? (await db.insert(styleLines).values(fresh.map((text) => ({ styleId: style.id, ...set, text }))).onConflictDoNothing().returning({ id: styleLines.id })).length
    : 0
  skipped.duplicate += fresh.length - inserted
  const total = have + inserted
  const key = setKey(set)
  if (total > (style.targets[key] ?? 0)) {
    await db.update(commentStyles).set({ targets: { ...style.targets, [key]: total } }).where(eq(commentStyles.id, style.id))
  }
  return { added: inserted, total, skipped, capped: want < req.count }
}

/** A build problem the owner can fix (shown as is), as opposed to the writer being down */
export class BuildError extends Error {}
