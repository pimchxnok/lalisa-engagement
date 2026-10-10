/**
 * Shared site content and live post numbers, stored in Netlify Database.
 * The owner's content is one document; live numbers sit in their own table so
 * the sync job and Studio edits never overwrite each other.
 * Imported by the API routes and the scheduled sync function — keep imports relative.
 */
import { and, eq, inArray, lt, notInArray } from 'drizzle-orm'
import { db } from '../../db/index'
import { postLive, siteContent } from '../../db/schema'
import { defaultData } from '../data/fixtures'
import { fetchPostMetadata } from './postMetadata'
import { fetchLiveStats } from './statsFetch'
import type { Post, SiteData, Stats } from './types'

const CONTENT_ID = 'main'
/** Captions and covers change rarely; re-read them a few times a day */
const META_MAX_AGE_MS = 6 * 60 * 60 * 1000

type LiveRow = typeof postLive.$inferSelect

export type ContentResponse = { data: SiteData; published: boolean; updatedAt?: string }

async function readContent(): Promise<{ data: SiteData; published: boolean; updatedAt?: Date }> {
  const [row] = await db.select().from(siteContent).where(eq(siteContent.id, CONTENT_ID))
  if (!row) return { data: defaultData, published: false }
  return { data: { ...defaultData, ...(row.data as SiteData) }, published: true, updatedAt: row.updatedAt }
}

/** Placeholder links in the sample content can never be read */
function syncable(post: Post) {
  return !!post.url && !/SAMPLE-|\/0{10,}/.test(post.url)
}

/** Owner uploads win over auto-read covers; auto-read covers are stored under cover-… keys */
function isOwnerUpload(src?: string) {
  return !!src && !src.startsWith('/api/images/cover-') && (src.startsWith('/api/images/') || src.startsWith('data:'))
}

function mergeLive(post: Post, live?: LiveRow): Post {
  if (!live || live.url !== post.url || !live.syncedAt && !live.metaSyncedAt) return post
  return {
    ...post,
    stats: { ...post.stats, ...(live.stats as Partial<Stats>) },
    caption: live.caption || post.caption,
    thumbnail: post.kind === 'media' ? undefined : isOwnerUpload(post.thumbnail) ? post.thumbnail : live.thumbnail || post.thumbnail,
    syncedAt: live.syncedAt?.toISOString(),
  }
}

/** Site content as visitors see it: owner content with the latest live numbers applied */
export async function loadContent(): Promise<ContentResponse> {
  const { data, published, updatedAt } = await readContent()
  const live = await db.select().from(postLive)
  const byId = new Map(live.map((row) => [row.postId, row]))
  const posts = data.posts.map((p) => mergeLive(p, byId.get(p.id)))
  const latest = live.reduce((max, row) => (row.syncedAt && row.syncedAt.getTime() > max ? row.syncedAt.getTime() : max), 0)
  return {
    data: { ...data, posts, settings: { ...data.settings, lastSyncedAt: latest ? new Date(latest).toISOString() : data.settings.lastSyncedAt } },
    published,
    updatedAt: updatedAt?.toISOString(),
  }
}

export async function saveContent(data: SiteData) {
  const now = new Date()
  // Live fields are recomputed on every read, so only the owner's own values are stored
  const clean: SiteData = { ...data, posts: data.posts.map(({ syncedAt: _, ...p }) => p) }
  await db
    .insert(siteContent)
    .values({ id: CONTENT_ID, data: clean, updatedAt: now })
    .onConflictDoUpdate({ target: siteContent.id, set: { data: clean, updatedAt: now } })
  return now.toISOString()
}

/** Makes sure every linked post has a live row, and drops rows for deleted posts or changed links */
async function ensureRows(posts: Post[]) {
  const ids = posts.map((p) => p.id)
  if (ids.length) await db.delete(postLive).where(notInArray(postLive.postId, ids))
  else await db.delete(postLive)
  if (!ids.length) return
  const existing = await db.select({ postId: postLive.postId, url: postLive.url }).from(postLive)
  const known = new Map(existing.map((r) => [r.postId, r.url]))
  const epoch = new Date(0)
  for (const p of posts) {
    const url = known.get(p.id)
    if (url === p.url) continue
    if (url === undefined) {
      await db.insert(postLive).values({ postId: p.id, url: p.url, claimedAt: epoch }).onConflictDoNothing()
    } else {
      await db.update(postLive).set({ url: p.url, stats: {}, caption: null, thumbnail: null, error: null, syncedAt: null, metaSyncedAt: null, claimedAt: epoch }).where(eq(postLive.postId, p.id))
    }
  }
}

/** Claims up to `limit` posts not refreshed within `maxAgeMs`. Concurrent callers never claim the same post. */
async function claim(ids: string[], maxAgeMs: number, limit: number) {
  const cutoff = new Date(Date.now() - maxAgeMs)
  const candidates = await db
    .select({ postId: postLive.postId })
    .from(postLive)
    .where(and(inArray(postLive.postId, ids), lt(postLive.claimedAt, cutoff)))
    .orderBy(postLive.claimedAt)
    .limit(limit)
  if (!candidates.length) return []
  return db
    .update(postLive)
    .set({ claimedAt: new Date() })
    .where(and(inArray(postLive.postId, candidates.map((c) => c.postId)), lt(postLive.claimedAt, cutoff)))
    .returning()
}

async function refreshOne(post: Post, row: LiveRow) {
  const metaStale = !row.metaSyncedAt || Date.now() - row.metaSyncedAt.getTime() > META_MAX_AGE_MS
  const [stats, meta] = await Promise.all([
    fetchLiveStats(post.url),
    metaStale ? fetchPostMetadata(post.url, post.kind !== 'media') : Promise.resolve(undefined),
  ])
  const now = new Date()
  const got = Object.keys(stats.stats).length > 0
  await db
    .update(postLive)
    .set({
      stats: { ...(row.stats as Partial<Stats>), ...stats.stats },
      error: got ? null : stats.error ?? 'No numbers available',
      ...(got ? { syncedAt: now } : {}),
      ...(meta ? { metaSyncedAt: now, caption: meta.caption || row.caption, thumbnail: meta.thumbnail || row.thumbnail } : {}),
    })
    .where(eq(postLive.postId, post.id))
}

/**
 * Refreshes posts whose numbers are older than `maxAgeMs`, a few at a time, until `budgetMs` runs out.
 * Returns how many posts were refreshed.
 */
export async function syncStale({ maxAgeMs, budgetMs, batch = 4 }: { maxAgeMs: number; budgetMs: number; batch?: number }) {
  const start = Date.now()
  const { data } = await readContent()
  const posts = data.posts.filter(syncable)
  await ensureRows(posts)
  const byId = new Map(posts.map((p) => [p.id, p]))
  const ids = [...byId.keys()]
  let done = 0
  while (ids.length && Date.now() - start < budgetMs) {
    const rows = await claim(ids, maxAgeMs, batch)
    if (!rows.length) break
    await Promise.all(rows.map((row) => refreshOne(byId.get(row.postId)!, row).catch(() => undefined)))
    done += rows.length
  }
  return done
}
