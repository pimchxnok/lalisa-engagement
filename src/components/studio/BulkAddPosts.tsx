import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Plus, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import { PostThumb } from '@/components/ui'
import { tiersFor } from '@/lib/filters'
import { formatNum, metricLabel, parsePostUrl, platformLabel, platformMetrics, postTitle } from '@/lib/platform'
import { updateData, useSiteData } from '@/lib/store'
import type { Post, PostKind } from '@/lib/types'
import { applyStats, blankPost, fetchLinkStats } from './postHelpers'
import { Field, inputCls, Panel, SmallBtn } from './fields'

const MAX_LINKS = 20
// Each link can take several seconds to read, so a few run side by side without hammering the platforms
const PARALLEL = 3

type Row = { key: string; post: Post; state: 'waiting' | 'reading' | 'ready' | 'partial'; note?: string }

/** Pulls every http(s) link out of pasted text, one post per link, duplicates dropped */
function splitLinks(text: string) {
  const found = text.match(/https?:\/\/[^\s,<>"']+/gi) ?? []
  return [...new Set(found.map((u) => u.replace(/[).]+$/, '')))]
}

const sameLink = (a: string, b: string) => a.trim().replace(/\/+$/, '').split('?')[0] === b.trim().replace(/\/+$/, '').split('?')[0]

export function BulkAddPosts({ kind: initialKind, campaignId: initialCampaign, onDone }: { kind: PostKind; campaignId: string; onDone: () => void }) {
  const data = useSiteData()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<PostKind>(initialKind)
  const [campaignId, setCampaignId] = useState(initialCampaign)
  const [goal, setGoal] = useState(10_000)
  const [rows, setRows] = useState<Row[]>([])
  const [reading, setReading] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])

  const links = splitLinks(text)
  const patch = (key: string, change: Partial<Row> | ((r: Row) => Row)) =>
    setRows((cur) => cur.map((r) => (r.key === key ? (typeof change === 'function' ? change(r) : { ...r, ...change }) : r)))

  async function readAll() {
    const fresh: string[] = []
    const skip: string[] = []
    for (const url of links) {
      if (!parsePostUrl(url).platform) skip.push(`${url} — not a TikTok or Instagram link`)
      else if (data.posts.some((p) => sameLink(p.url, url))) skip.push(`${url} — already in your posts`)
      else if (fresh.length >= MAX_LINKS) skip.push(`${url} — over the ${MAX_LINKS}-link limit, add it in the next batch`)
      else fresh.push(url)
    }
    setSkipped(skip)
    const next: Row[] = fresh.map((url, i) => {
      const info = parsePostUrl(url)
      const post = { ...blankPost(campaignId, kind), url, platform: info.platform ?? 'ig-post', account: info.account ?? '' }
      return { key: `${i}-${url}`, post: kind === 'media' ? post : { ...post, commentGoal: goal }, state: 'waiting' }
    })
    setRows(next)
    if (!next.length) return
    setReading(true)
    const queue = [...next]
    async function worker() {
      for (let row = queue.shift(); row; row = queue.shift()) {
        const key = row.key
        patch(key, { state: 'reading' })
        const r = await fetchLinkStats(row.post.url, kind !== 'media')
        const missing = r.missing.filter((m) => platformMetrics[r.platform ?? row.post.platform].includes(m))
        patch(key, (cur) => ({
          ...cur,
          post: applyStats(cur.post, r),
          state: r.error || !r.title ? 'partial' : 'ready',
          note: [r.error, !r.error && missing.length ? `${missing.map((m) => metricLabel[m]).join(', ')} not public — edit later` : ''].filter(Boolean).join(' ') || undefined,
        }))
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, next.length) }, worker))
    setReading(false)
  }

  function addAll() {
    const posts = rows.map((r) => ({ ...r.post, thumbnail: r.post.kind === 'media' ? undefined : r.post.thumbnail }))
    updateData((d) => ({ ...d, posts: [...posts, ...d.posts.filter((p) => !posts.some((n) => sameLink(n.url, p.url)))] }))
    onDone()
  }

  const done = rows.filter((r) => r.state === 'ready' || r.state === 'partial').length

  return (
    <Panel
      title="Add many posts"
      action={
        <SmallBtn onClick={onDone}>
          <ArrowLeft className="size-4" /> Back to posts
        </SmallBtn>
      }
    >
      <Field label="Post links" hint={`Paste up to ${MAX_LINKS} TikTok or Instagram links — one per line, or separated by spaces. Each link becomes its own post.`}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          disabled={reading}
          placeholder={'https://www.instagram.com/p/…\nhttps://www.tiktok.com/@…/video/…\nhttps://www.instagram.com/reel/…'}
          className={`${inputCls} w-full rounded-2xl font-mono text-xs`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Post type (all links)">
          <select value={kind} disabled={reading || !!rows.length} onChange={(e) => setKind(e.target.value as PostKind)} className={`${inputCls} w-full`}>
            <option value="lisa">LISA post</option>
            <option value="brand">Brand post</option>
            <option value="media">Media post</option>
          </select>
        </Field>
        <Field label="Campaign (all links)">
          <select
            value={campaignId}
            onChange={(e) => {
              setCampaignId(e.target.value)
              setRows((cur) => cur.map((r) => ({ ...r, post: { ...r.post, campaignId: e.target.value } })))
            }}
            className={`${inputCls} w-full`}
          >
            <option value="">No campaign</option>
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {kind !== 'media' && (
          <Field label="Comment goal (each post)">
            <input
              type="number"
              min={0}
              value={goal}
              onChange={(e) => {
                const n = Number(e.target.value)
                setGoal(n)
                setRows((cur) => cur.map((r) => ({ ...r, post: { ...r.post, commentGoal: n } })))
              }}
              className={`${inputCls} w-full`}
            />
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SmallBtn tone="gold" onClick={readAll} disabled={reading || !links.length}>
          {reading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {reading ? `Reading… ${done} / ${rows.length}` : `Read ${links.length || ''} ${links.length === 1 ? 'link' : 'links'}`}
        </SmallBtn>
        {!!rows.length && !reading && (
          <SmallBtn tone="gold" onClick={addAll}>
            <Plus className="size-4" /> Add {rows.length} {rows.length === 1 ? 'post' : 'posts'}
          </SmallBtn>
        )}
        <span className="text-xs text-gold-600">The cover, caption, account and public numbers are read from each link. You can fix anything below before adding.</span>
      </div>

      {!!skipped.length && (
        <ul className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-2 text-xs text-amber-800">
          {skipped.map((s) => (
            <li key={s} className="truncate">
              Skipped {s}
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y divide-gold-200/60">
        {rows.map(({ key, post, state, note }) => (
          <li key={key} className="flex items-start gap-3 py-3">
            {post.kind !== 'media' && <PostThumb post={post} className="size-16 shrink-0 [&>span]:hidden" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gold-600">
                {state === 'waiting' && <span>Waiting…</span>}
                {state === 'reading' && (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Reading link…
                  </span>
                )}
                {state === 'ready' && <CheckCircle2 className="size-3.5 text-emerald-600" />}
                {state === 'partial' && <AlertCircle className="size-3.5 text-amber-600" />}
                <span>
                  {platformLabel[post.platform]}
                  {post.account && ` · ${post.account}`}
                </span>
              </div>
              <input
                value={post.title ?? ''}
                onChange={(e) => patch(key, (r) => ({ ...r, post: { ...r.post, title: e.target.value } }))}
                placeholder={postTitle(post)}
                disabled={state === 'waiting' || state === 'reading'}
                className={`${inputCls} w-full`}
              />
              {post.caption && <p className="line-clamp-2 text-xs text-gold-700/80">{post.caption}</p>}
              <p className="text-xs text-gold-700">
                {platformMetrics[post.platform].map((m) => `${formatNum(post.stats[m] ?? 0)} ${metricLabel[m].toLowerCase()}`).join(' · ')}
              </p>
              {note && <p className="text-xs text-amber-700">{note}</p>}
              {post.kind === 'media' && state !== 'waiting' && state !== 'reading' && (
                <select
                  value={post.tierId ?? ''}
                  onChange={(e) => patch(key, (r) => ({ ...r, post: { ...r.post, tierId: e.target.value || undefined } }))}
                  className={`${inputCls} w-auto`}
                >
                  <option value="">No tier</option>
                  {tiersFor(data.tiers, post.platform).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRows((cur) => cur.filter((r) => r.key !== key))}
              disabled={reading}
              aria-label="Leave this link out"
              className="rounded-full p-1.5 text-gold-500 hover:bg-gold-100 disabled:opacity-40"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
