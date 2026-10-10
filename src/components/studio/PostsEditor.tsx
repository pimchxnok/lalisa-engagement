import { Link2, Loader2, Pencil, Plus, RefreshCw, Trash2, Upload, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PostThumb } from '@/components/ui'
import { tiersFor } from '@/lib/filters'
import { formatNum, metricLabel, parsePostUrl, platformLabel, platformMetrics, platforms, postTitle } from '@/lib/platform'
import type { FetchedStats } from '@/lib/statsFetch'
import { newId, updateData, useSiteData } from '@/lib/store'
import type { Platform, Post, PostKind, Stats } from '@/lib/types'
import { uploadImage } from '@/lib/upload'
import { ConfirmButton, Field, inputCls, Panel, SmallBtn } from './fields'

async function fetchLinkStats(url: string, includeCover = true): Promise<FetchedStats> {
  try {
    const res = await fetch(`/api/stats?url=${encodeURIComponent(url)}&cover=${includeCover ? '1' : '0'}`)
    if (!res.ok) throw new Error('Unavailable')
    return await res.json()
  } catch {
    return { stats: {}, missing: [], error: 'Could not reach the platform — try again.' }
  }
}

/** Merges fetched numbers into a post, keeping the owner's own values for metrics the platform hides */
function applyStats(p: Post, r: FetchedStats): Post {
  const stats: Stats = { ...p.stats }
  for (const [k, v] of Object.entries(r.stats) as [keyof Stats, number | undefined][]) if (v !== undefined) stats[k] = v
  return {
    ...p,
    platform: r.platform ?? p.platform,
    account: p.account || r.account || '',
    title: p.title || r.title,
    caption: p.caption || r.caption || '',
    thumbnail: p.kind === 'media' ? undefined : p.thumbnail || r.thumbnail,
    stats,
  }
}

function blankPost(campaignId: string, kind: PostKind): Post {
  return {
    id: newId('p'),
    kind,
    campaignId,
    platform: 'ig-post',
    url: '',
    account: '',
    title: '',
    caption: '',
    stats: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, reposts: 0 },
    commentGoal: kind === 'media' ? undefined : 10_000,
    communityComments: 0,
    postedAt: new Date().toISOString().slice(0, 10),
  }
}

export function PostsEditor() {
  const data = useSiteData()
  const [section, setSection] = useState<'own' | 'media'>('own')
  const [campaign, setCampaign] = useState(data.campaigns[0]?.id ?? '')
  const [editing, setEditing] = useState<Post | null>(null)
  const [sync, setSync] = useState<{ done: number; total: number; failed: number } | null>(null)

  const list = data.posts.filter((p) => (section === 'media' ? p.kind === 'media' : p.kind !== 'media') && (!campaign || p.campaignId === campaign))

  function save(p: Post) {
    updateData((d) => ({
      ...d,
      posts: d.posts.some((x) => x.id === p.id) ? d.posts.map((x) => (x.id === p.id ? { ...p, thumbnail: p.kind === 'media' ? undefined : p.thumbnail } : x)) : [{ ...p, thumbnail: p.kind === 'media' ? undefined : p.thumbnail }, ...d.posts],
    }))
    setEditing(null)
  }

  function remove(id: string) {
    updateData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }))
  }

  async function refreshAll() {
    const targets = list.filter((p) => p.url)
    let failed = 0
    setSync({ done: 0, total: targets.length, failed })
    for (const [i, p] of targets.entries()) {
      const r = await fetchLinkStats(p.url, p.kind !== 'media')
      if (r.error) failed++
      else updateData((d) => ({ ...d, posts: d.posts.map((x) => (x.id === p.id ? applyStats(x, r) : x)) }))
      setSync({ done: i + 1, total: targets.length, failed })
    }
  }
  const syncing = !!sync && sync.done < sync.total

  if (editing) return <PostForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />

  return (
    <Panel
      title="Posts"
      action={
        <div className="flex flex-wrap justify-end gap-2">
        <SmallBtn onClick={refreshAll} disabled={syncing || !list.length}>
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Update numbers for all {list.length} posts
        </SmallBtn>
        <SmallBtn tone="gold" onClick={() => setEditing(blankPost(campaign || data.campaigns[0]?.id || '', section === 'media' ? 'media' : 'lisa'))}>
          <Plus className="size-4" /> Add post
        </SmallBtn>
        </div>
      }
    >
      {sync && (
        <p className="mb-4 rounded-2xl border border-gold-200 bg-gold-50/70 px-4 py-2 text-sm text-gold-800">
          {syncing ? `Updating numbers… ${sync.done} / ${sync.total}` : `Updated ${sync.total - sync.failed} of ${sync.total} posts from their links.`}
          {sync.failed > 0 && !syncing && ` ${sync.failed} couldn't be read right now — try again later or type those numbers in.`}
          {!syncing && ' Instagram keeps saves, shares and reposts private, so those keep the numbers you entered.'}
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="inline-flex rounded-full border border-gold-200 bg-white/50 p-0.5 text-sm">
          {(['own', 'media'] as const).map((s) => (
            <button key={s} onClick={() => setSection(s)} className={`rounded-full px-4 py-1.5 ${section === s ? 'bg-gold-500 text-white' : 'text-gold-700'}`}>
              {s === 'own' ? 'LISA & Brand' : 'Media'}
            </button>
          ))}
        </div>
        <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">All campaigns</option>
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <ul className="divide-y divide-gold-200/60">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            {p.kind !== 'media' && <PostThumb post={p} className="size-14 shrink-0 [&>span]:hidden" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gold-900">
                {postTitle(p)} <span className="text-xs font-normal text-gold-600">· {platformLabel[p.platform]} · {p.kind.toUpperCase()}</span>
              </p>
              <p className="truncate text-xs text-gold-700/80">
                {formatNum(p.stats.views ?? p.stats.likes)} {p.stats.views !== undefined && p.platform !== 'ig-post' ? 'views' : 'likes'} · {formatNum(p.stats.comments)} comments
                {p.kind !== 'media' && ` · goal ${formatNum(p.commentGoal)}`}
              </p>
            </div>
            <SmallBtn onClick={() => setEditing(p)}><Pencil className="size-3.5" /> Edit</SmallBtn>
            <ConfirmButton onConfirm={() => remove(p.id)} message="Delete this post? This cannot be undone."><Trash2 className="size-3.5" /> Delete post</ConfirmButton>
          </li>
        ))}
      </ul>
      {!list.length && <p className="py-6 text-center text-sm text-gold-600">No posts yet — add the first one.</p>}
    </Panel>
  )
}

function PostForm({ initial, onSave, onCancel }: { initial: Post; onSave: (p: Post) => void; onCancel: () => void }) {
  const data = useSiteData()
  const [p, setP] = useState<Post>(initial)
  const [detected, setDetected] = useState('')
  const [filling, setFilling] = useState(false)
  const [fillMsg, setFillMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  // A tier belongs to one platform, so switching platform drops a tier that no longer fits
  const set = (patch: Partial<Post>) => setP((cur) => fitTier({ ...cur, ...patch }))
  const fitTier = (x: Post): Post => (x.tierId && data.tiers.find((t) => t.id === x.tierId)?.platform !== x.platform ? { ...x, tierId: undefined } : x)

  async function autoFill() {
    if (!p.url) return setFillMsg('Paste the post link first.')
    setFilling(true)
    setFillMsg('')
    const requestUrl = p.url
    const requestId = ++fillRequest.current
    const r = await fetchLinkStats(requestUrl, p.kind !== 'media')
    if (requestId !== fillRequest.current || currentUrl.current !== requestUrl) return
    setFilling(false)
    setP((cur) => cur.url === requestUrl ? fitTier(applyStats(cur, r)) : cur)
    const got = (Object.keys(r.stats) as (keyof Stats)[]).filter((k) => r.stats[k] !== undefined).map((k) => metricLabel[k])
    const fields = [r.title ? 'post title' : '', r.thumbnail && p.kind !== 'media' ? 'cover' : '', ...got].filter(Boolean)
    setFillMsg([fields.length ? `Read ${fields.join(', ')} from the link. Existing edits are kept.` : '', r.metadataError, r.error, !r.error && r.missing.length ? `${r.missing.map((key) => metricLabel[key]).join(', ')} aren't public — enter them manually.` : ''].filter(Boolean).join(' '))
  }

  // Pasting a new link fills the numbers straight away
  const lastFilled = useRef(initial.url)
  const fillRequest = useRef(0)
  const currentUrl = useRef(p.url)
  currentUrl.current = p.url
  useEffect(() => {
    if (!p.url || p.url === lastFilled.current || !parsePostUrl(p.url).platform) return
    const t = setTimeout(() => {
      lastFilled.current = p.url
      autoFill()
    }, 700)
    return () => clearTimeout(t)
  }, [p.url])

  async function onPhoto(file?: File) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      set({ thumbnail: url })
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function onUrl(url: string) {
    fillRequest.current++
    setFilling(false)
    setFillMsg('')
    const info = parsePostUrl(url)
    const patch: Partial<Post> = { url }
    if (info.platform) patch.platform = info.platform
    if (info.account && !p.account) patch.account = info.account
    setP(fitTier({ ...p, ...patch }))
    setDetected(info.platform ? `Detected ${platformLabel[info.platform]}${info.account ? ` by ${info.account}` : ''}` : '')
  }

  return (
    <Panel title={data.posts.some((x) => x.id === p.id) ? 'Edit post' : 'Add post'}>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(p)
        }}
      >
        <div className="md:col-span-2">
          <Field label="Post link" hint={detected || 'Paste a TikTok or Instagram link to read the post title, public preview and available numbers.'}>
            <div className="relative">
              <Link2 className="absolute left-3 top-2.5 size-4 text-gold-500" />
              <input required value={p.url} onChange={(e) => onUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" className={`${inputCls} pl-9`} />
            </div>
          </Field>
        </div>
        <Field label="Post type">
          <select value={p.kind} onChange={(e) => set({ kind: e.target.value as PostKind })} className={inputCls}>
            <option value="lisa">LISA post</option>
            <option value="brand">Brand post</option>
            <option value="media">Media post</option>
          </select>
        </Field>
        <Field label="Platform">
          <select value={p.platform} onChange={(e) => set({ platform: e.target.value as Platform })} className={inputCls}>
            {platforms.map((pl) => (
              <option key={pl} value={pl}>{platformLabel[pl]}</option>
            ))}
          </select>
        </Field>
        <Field label="Campaign">
          <select value={p.campaignId} onChange={(e) => set({ campaignId: e.target.value })} className={inputCls}>
            <option value="">No campaign</option>
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        {p.kind === 'media' ? (
          <Field label={`${platformLabel[p.platform]} tier`} hint="Tiers are set per platform in Media Tiers.">
            <select value={p.tierId ?? ''} onChange={(e) => set({ tierId: e.target.value || undefined })} className={inputCls}>
              <option value="">No tier</option>
              {tiersFor(data.tiers, p.platform).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Comment goal">
            <input type="number" min={0} value={p.commentGoal ?? 0} onChange={(e) => set({ commentGoal: Number(e.target.value) })} className={inputCls} />
          </Field>
        )}
        <Field label="Post title" hint="Auto-filled when the platform exposes a public preview. You can edit it anytime.">
          <input value={p.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={postTitle(p)} className={inputCls} />
        </Field>
        {p.kind !== 'media' && <div className="md:col-span-2">
          <Field label="Cover photo" hint="Read automatically from public previews when available. Linked covers do not upload an image file; you can still upload your own.">
            <div className="flex flex-wrap items-center gap-3">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-gold-200 bg-gold-50">
                {p.thumbnail ? <img src={p.thumbnail} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-gold-500">No photo</div>}
              </div>
              <label className={`btn-gold inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {uploading ? 'Uploading…' : p.thumbnail ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              {p.thumbnail && <SmallBtn tone="danger" onClick={() => set({ thumbnail: undefined })}>Remove</SmallBtn>}
            </div>
          </Field>
        </div>}
        <div className="md:col-span-2">
          <Field label="Caption / note">
            <textarea value={p.caption} onChange={(e) => set({ caption: e.target.value })} rows={2} className={inputCls} />
          </Field>
        </div>
        {p.kind === 'media' && (
          <div className="md:col-span-2">
            <Field label="Extra @ tags for story sharing" hint="Separate with spaces, e.g. @voguemagazine @wwd">
              <input
                value={(p.extraMentions ?? []).join(' ')}
                onChange={(e) => set({ extraMentions: e.target.value.split(/\s+/).filter(Boolean) })}
                className={inputCls}
              />
            </Field>
          </div>
        )}

        <div className="md:col-span-2 rounded-2xl border border-gold-200 bg-gold-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gold-800">Engagement numbers</p>
            <SmallBtn tone="gold" onClick={autoFill} disabled={filling}>
              {filling ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Read title, preview & numbers from link
            </SmallBtn>
          </div>
          {fillMsg && <p className="mb-3 text-xs text-gold-700">{fillMsg}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {platformMetrics[p.platform].map((k) => (
              <Field key={k} label={metricLabel[k]}>
                <input
                  type="number"
                  min={0}
                  value={p.stats[k] ?? 0}
                  onChange={(e) => set({ stats: { ...p.stats, [k]: Number(e.target.value) } })}
                  className={inputCls}
                />
              </Field>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 flex gap-2">
          <SmallBtn tone="gold" type="submit" disabled={filling || uploading}>Save post</SmallBtn>
          <SmallBtn onClick={onCancel}>Cancel</SmallBtn>
        </div>
      </form>
    </Panel>
  )
}
