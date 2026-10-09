import { ArrowDown, ArrowUp, Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { poolSize } from '@/lib/generator'
import { tipCategories } from '@/lib/platform'
import { newId, replaceData, resetData, updateData, useSiteData } from '@/lib/store'
import type { Campaign, Lang, LineStyle, SiteData, TipCategory } from '@/lib/types'
import { uploadImage } from '@/lib/upload'
import { ChipInput, ConfirmButton, Field, inputCls, Panel, SmallBtn } from './fields'

type Key = 'campaigns' | 'tiers' | 'lineTypes' | 'customLines' | 'tips'

function patchItem<K extends Key>(key: K, id: string, patch: Partial<SiteData[K][number]>) {
  updateData((d) => ({ ...d, [key]: (d[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
}

function removeItem(key: Key, id: string) {
  updateData((d) => ({
    ...d,
    [key]: (d[key] as { id: string }[]).filter((item) => item.id !== id),
    ...(key === 'tiers' ? { posts: d.posts.map((post) => post.tierId === id ? { ...post, tierId: undefined } : post) } : {}),
    ...(key === 'lineTypes' ? { customLines: d.customLines.filter((line) => line.typeId !== id) } : {}),
    ...(key === 'campaigns' ? { posts: d.posts.map((post) => post.campaignId === id ? { ...post, campaignId: '' } : post) } : {}),
  }))
}

function addItem<K extends Key>(key: K, item: SiteData[K][number]) {
  updateData((d) => ({ ...d, [key]: [...d[key], item] }))
}

export function CampaignsEditor() {
  const { campaigns } = useSiteData()
  const blank: Campaign = { id: newId('c'), name: 'New campaign', brand: '', season: '', description: '', hashtags: ['#LISA'], mentions: ['@lalalalisa_m'] }
  return (
    <Panel title="Campaigns & tags" action={<SmallBtn tone="gold" onClick={() => addItem('campaigns', blank)}><Plus className="size-4" /> Add campaign</SmallBtn>}>
      <div className="space-y-5">
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-2xl border border-gold-200 bg-white/50 p-4 grid gap-3 md:grid-cols-3">
            <Field label="Button name"><input value={c.name} onChange={(e) => patchItem('campaigns', c.id, { name: e.target.value })} className={inputCls} /></Field>
            <Field label="Brand"><input value={c.brand} onChange={(e) => patchItem('campaigns', c.id, { brand: e.target.value })} className={inputCls} /></Field>
            <Field label="Season"><input value={c.season} onChange={(e) => patchItem('campaigns', c.id, { season: e.target.value })} className={inputCls} /></Field>
            <div className="md:col-span-3">
              <Field label="Description"><input value={c.description} onChange={(e) => patchItem('campaigns', c.id, { description: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
              <Field label="# Hashtags" hint="Press Enter to add">
                <ChipInput prefix="#" value={c.hashtags} onChange={(v) => patchItem('campaigns', c.id, { hashtags: v })} placeholder="#LISAxLouisVuitton" />
              </Field>
              <Field label="@ Mentions" hint="Press Enter to add">
                <ChipInput prefix="@" value={c.mentions} onChange={(v) => patchItem('campaigns', c.id, { mentions: v })} placeholder="@louisvuitton" />
              </Field>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <ConfirmButton onConfirm={() => removeItem('campaigns', c.id)} message="Delete this campaign? Its posts will be kept without a campaign."><Trash2 className="size-3.5" /> Delete campaign</ConfirmButton>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function TiersEditor() {
  const { tiers, posts } = useSiteData()
  function move(i: number, dir: -1 | 1) {
    updateData((d) => {
      const t = [...d.tiers]
      const j = i + dir
      if (j < 0 || j >= t.length) return d
      ;[t[i], t[j]] = [t[j], t[i]]
      return { ...d, tiers: t }
    })
  }
  return (
    <Panel title="Media tiers" action={<SmallBtn tone="gold" onClick={() => addItem('tiers', { id: newId('t'), name: `Tier ${tiers.length + 1}` })}><Plus className="size-4" /> Add tier</SmallBtn>}>
      <p className="mb-3 text-sm text-gold-700/80">Media posts are listed in this order. Rename tiers freely — posts keep their tier.</p>
      <ul className="space-y-2">
        {tiers.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2">
            <input value={t.name} onChange={(e) => patchItem('tiers', t.id, { name: e.target.value })} className={inputCls} />
            <span className="w-20 shrink-0 text-xs text-gold-600">{posts.filter((p) => p.tierId === t.id).length} posts</span>
            <SmallBtn onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></SmallBtn>
            <SmallBtn onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></SmallBtn>
            <ConfirmButton onConfirm={() => removeItem('tiers', t.id)} message="Delete this tier? Its posts will be kept without a tier."><Trash2 className="size-3.5" /> Delete tier</ConfirmButton>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

const styles: { id: LineStyle; label: string }[] = [
  { id: 'hype', label: 'Over-the-top hype' },
  { id: 'sweet', label: 'Sweet & natural' },
  { id: 'concept', label: 'Campaign concept' },
  { id: 'fashion', label: 'Fashion & styling' },
  { id: 'story', label: 'Story caption (short)' },
]

export function LineTypesEditor() {
  const { lineTypes, customLines } = useSiteData()
  const [lang, setLang] = useState<Lang>('en')
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  return (
    <Panel
      title="Comment & caption types"
      action={<SmallBtn tone="gold" onClick={() => addItem('lineTypes', { id: newId('lt'), name: 'New type', description: '', style: 'sweet' })}><Plus className="size-4" /> Add type</SmallBtn>}
    >
      <p className="mb-4 text-sm text-gold-700/80">
        Rename types, pick the phrase style that backs each one, and write your own lines. Your lines are served first; the built-in bank supplies 1,000+ unique lines per type and language, and copied lines are never shown again.
        Use <code className="text-gold-800">{'{brand}'}</code> and <code className="text-gold-800">{'{campaign}'}</code> to insert the campaign automatically.
      </p>
      <div className="mb-4 inline-flex rounded-full border border-gold-200 bg-white/50 p-0.5 text-sm">
        {(['en', 'th'] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} className={`rounded-full px-4 py-1.5 ${lang === l ? 'bg-gold-500 text-white' : 'text-gold-700'}`}>
            {l === 'en' ? 'English lines' : 'Thai lines'}
          </button>
        ))}
      </div>
      <div className="space-y-5">
        {lineTypes.map((t) => {
          const mine = customLines.filter((l) => l.typeId === t.id && l.lang === lang)
          return (
            <div key={t.id} className="rounded-2xl border border-gold-200 bg-white/50 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Type name"><input value={t.name} onChange={(e) => patchItem('lineTypes', t.id, { name: e.target.value })} className={inputCls} /></Field>
                <Field label="Built-in style" hint={`${poolSize(t.style, lang, t.style === 'story' ? 'short' : 'long').toLocaleString('en-US')} generated lines available`}>
                  <select value={t.style} onChange={(e) => patchItem('lineTypes', t.id, { style: e.target.value as LineStyle })} className={inputCls}>
                    {styles.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Description"><input value={t.description} onChange={(e) => patchItem('lineTypes', t.id, { description: e.target.value })} className={inputCls} /></Field>
              </div>
              <ul className="space-y-1.5">
                {mine.map((l) => (
                  <li key={l.id} className="flex items-center gap-2">
                    <input value={l.text} onChange={(e) => patchItem('customLines', l.id, { text: e.target.value })} className={`${inputCls} ${lang === 'th' ? 'lang-th' : ''}`} />
                    <ConfirmButton onConfirm={() => removeItem('customLines', l.id)}><Trash2 className="size-3.5" /> Delete line</ConfirmButton>
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const text = (drafts[t.id] ?? '').trim()
                  if (!text) return
                  // Paste many lines at once — one comment per line
                  updateData((d) => ({
                    ...d,
                    customLines: [...d.customLines, ...text.split('\n').filter((x) => x.trim()).map((x) => ({ id: newId('l'), typeId: t.id, lang, text: x.trim() }))],
                  }))
                  setDrafts({ ...drafts, [t.id]: '' })
                }}
              >
                <textarea
                  rows={1}
                  value={drafts[t.id] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [t.id]: e.target.value })}
                  placeholder={`Add your own ${lang === 'en' ? 'English' : 'Thai'} line (paste several, one per line)`}
                  className={`${inputCls} ${lang === 'th' ? 'lang-th' : ''}`}
                />
                <SmallBtn tone="gold" type="submit"><Plus className="size-4" /> Add</SmallBtn>
              </form>
              <div className="flex justify-end">
                <ConfirmButton onConfirm={() => removeItem('lineTypes', t.id)} message="Delete this type and its custom lines? This cannot be undone."><Trash2 className="size-3.5" /> Delete type</ConfirmButton>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export function TipsEditor() {
  const { tips } = useSiteData()
  return (
    <Panel title="Engagement tips" action={<SmallBtn tone="gold" onClick={() => addItem('tips', { id: newId('tip'), category: 'EMV', title: 'New tip', body: '' })}><Plus className="size-4" /> Add tip</SmallBtn>}>
      <div className="space-y-4">
        {tips.map((t) => (
          <div key={t.id} className="rounded-2xl border border-gold-200 bg-white/50 p-4 grid gap-3 md:grid-cols-4">
            <Field label="Topic">
              <select value={t.category} onChange={(e) => patchItem('tips', t.id, { category: e.target.value as TipCategory })} className={inputCls}>
                {tipCategories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div className="md:col-span-3"><Field label="Title"><input value={t.title} onChange={(e) => patchItem('tips', t.id, { title: e.target.value })} className={inputCls} /></Field></div>
            <div className="md:col-span-4"><Field label="Text"><textarea rows={3} value={t.body} onChange={(e) => patchItem('tips', t.id, { body: e.target.value })} className={inputCls} /></Field></div>
            <div className="md:col-span-3"><Field label="Link (optional)"><input value={t.link ?? ''} onChange={(e) => patchItem('tips', t.id, { link: e.target.value || undefined })} className={inputCls} /></Field></div>
            <div className="flex items-end justify-end"><ConfirmButton onConfirm={() => removeItem('tips', t.id)}><Trash2 className="size-3.5" /> Delete tip</ConfirmButton></div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function SiteEditor() {
  const data = useSiteData()
  const s = data.settings
  const set = (patch: Partial<typeof s>) => updateData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'lisa-engagement-content.json'
    a.click()
  }

  async function importJson(file: File) {
    try {
      replaceData(JSON.parse(await file.text()))
      alert('Content imported.')
    } catch {
      alert('That file could not be read.')
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="Home page">
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-gold-200 bg-gold-50">
            {s.heroImage ? <img src={s.heroImage} alt="LISA" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-gold-600">No photo yet</div>}
          </div>
          <div className="space-y-3">
            <Field label="LISA photo">
              <div className="flex flex-wrap gap-2">
                <label className="btn-gold inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm">
                  <Upload className="size-4" /> Upload photo
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      set({ heroImage: await uploadImage(file) })
                    } catch (err) {
                      alert((err as Error).message)
                    }
                  }} />
                </label>
                {s.heroImage && <SmallBtn tone="danger" onClick={() => set({ heroImage: '' })}>Remove</SmallBtn>}
              </div>
            </Field>
            <Field label="…or image URL">
              <input value={s.heroImage.startsWith('data:') || s.heroImage.startsWith('/api/images/') ? '' : s.heroImage} onChange={(e) => set({ heroImage: e.target.value })} placeholder="https://…" className={inputCls} />
            </Field>
            <Field label="Tagline"><input value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} className={inputCls} /></Field>
            <Field label="Footer credits"><input value={s.credits} onChange={(e) => set({ credits: e.target.value })} className={inputCls} /></Field>
          </div>
        </div>
      </Panel>
      <Panel title="Backup">
        <p className="mb-3 text-sm text-gold-700/80">Download everything you’ve entered as a file, or load a file back in.</p>
        <div className="flex flex-wrap gap-2">
          <SmallBtn tone="gold" onClick={exportJson}><Download className="size-4" /> Export content</SmallBtn>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gold-300 bg-white/70 px-4 py-1.5 text-sm text-gold-800">
            <Upload className="size-4" /> Import content
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
          <ConfirmButton onConfirm={resetData} message="Restore the original sample content? Your edits will be lost.">
            <RotateCcw className="size-4" /> Restore sample content
          </ConfirmButton>
        </div>
      </Panel>
    </div>
  )
}
