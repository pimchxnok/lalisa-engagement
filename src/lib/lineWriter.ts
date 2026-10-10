/**
 * AI-written lines that follow the owner's type name & description and the post's own title & caption.
 * Lines are fetched in small batches from /api/lines and kept per (type, language, length, post) in memory.
 * Ids are `a:<hash>` so copied lines join `usedLines` like generated (`g:`) and owner (`u:`) lines.
 * When the writer can't be reached, the built-in phrase bank in generator.ts takes over.
 */
import { fillTemplate, pickLine, type PickedLine } from './generator'
import type { Campaign, CustomLine, Lang, LineLength, LineType, Post } from './types'

export type LineRecipe = {
  type: LineType
  lang: Lang
  length: LineLength
  post: Post
  campaign?: Campaign
  customLines: CustomLine[]
  used: Record<string, true>
  exclude?: string
}

const pools = new Map<string, string[]>()
const pending = new Map<string, Promise<void>>()

function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

export const writtenLineId = (text: string) => `a:${hash(text)}`

function key(r: LineRecipe) {
  const length = r.type.style === 'story' ? 'short' : r.length
  return [r.type.id, r.type.name, r.type.description, r.type.style === 'story', r.lang, length, r.post.id, r.post.title, r.post.caption, r.campaign?.id].join('\u0001')
}

function fill(r: LineRecipe) {
  const k = key(r)
  const running = pending.get(k)
  if (running) return running
  const pool = pools.get(k) ?? []
  const job = fetch('/api/lines', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      typeName: r.type.name,
      typeDescription: r.type.description,
      story: r.type.style === 'story',
      lang: r.lang,
      length: r.type.style === 'story' ? 'short' : r.length,
      platform: r.post.platform,
      kind: r.post.kind,
      account: r.post.account,
      postTitle: r.post.title ?? '',
      postCaption: r.post.caption,
      campaign: r.campaign && { name: r.campaign.name, brand: r.campaign.brand, season: r.campaign.season, description: r.campaign.description },
      avoid: pool.slice(-30),
      count: 10,
    }),
  })
    .then((res) => (res.ok ? res.json() : { lines: [] }))
    .then(({ lines }: { lines?: string[] }) => {
      if (lines?.length) pools.set(k, [...new Set([...(pools.get(k) ?? []), ...lines])])
    })
    .catch(() => undefined)
    .finally(() => pending.delete(k))
  pending.set(k, job)
  return job
}

function unused(r: LineRecipe) {
  return (pools.get(key(r)) ?? []).filter((t) => !r.used[writtenLineId(t)] && writtenLineId(t) !== r.exclude)
}

/** Next line for a recipe: owner lines first half the time, then AI-written lines, then the built-in bank */
export async function nextLine(r: LineRecipe): Promise<PickedLine | null> {
  const customs = r.customLines.filter((l) => l.typeId === r.type.id && l.lang === r.lang && !r.used[`u:${l.id}`] && `u:${l.id}` !== r.exclude)
  if (customs.length && Math.random() < 0.5) {
    const l = customs[Math.floor(Math.random() * customs.length)]
    return { id: `u:${l.id}`, text: fillTemplate(l.text, r.campaign), custom: true }
  }
  let fresh = unused(r)
  if (!fresh.length) {
    await fill(r)
    fresh = unused(r)
  }
  // Top up quietly so the next tap of Random is instant
  if (fresh.length <= 3) void fill(r)
  if (fresh.length) {
    const text = fresh[Math.floor(Math.random() * fresh.length)]
    return { id: writtenLineId(text), text, custom: false }
  }
  return pickLine(r)
}
