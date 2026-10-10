import { ArrowDown, ArrowUp, Loader2, Plus, RefreshCw, Save, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { newId, useSiteData } from '@/lib/store'
import { clearBank, generateBatch, getStyles, loadStyles, saveStyles, useStyles, type CommentStyle } from '@/lib/styles'
import type { Lang, LineLength } from '@/lib/types'
import { ConfirmButton, Field, inputCls, Panel, SmallBtn } from './fields'

type Draft = Omit<CommentStyle, 'counts' | 'story'>

const langs: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'th', label: 'TH' },
]
const allLengths: LineLength[] = ['short', 'medium', 'long']
/** Lines asked for per request, kept small so each request finishes well within the server time limit */
const batchSize: Record<LineLength, number> = { short: 20, medium: 15, long: 10 }

const toDraft = (s: CommentStyle): Draft => ({ id: s.id, name: s.name, keywords: s.keywords, prompt: s.prompt, bankSize: s.bankSize })
const lengthsFor = (id: string): LineLength[] => (id === 'story' ? ['short'] : allLengths)

/**
 * Owner-defined built-in styles: a topic, its keywords, a prompt and a bank size.
 * Settings and banks are stored on the server, so every visitor draws from the same lines.
 */
export function StylesEditor() {
  const saved = useStyles()
  const { lineTypes } = useSiteData()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ id: string; text: string } | null>(null)
  const [error, setError] = useState('')

  // Follow the server copy until the owner starts editing
  useEffect(() => {
    if (!dirty) setDrafts(saved.map(toDraft))
  }, [saved])

  function edit(next: Draft[]) {
    setDrafts(next)
    setDirty(true)
  }

  const patch = (id: string, p: Partial<Draft>) => edit(drafts.map((d) => (d.id === id ? { ...d, ...p } : d)))

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= drafts.length) return
    const next = [...drafts]
    ;[next[i], next[j]] = [next[j], next[i]]
    edit(next)
  }

  async function save(list = drafts) {
    setError('')
    if (list.some((d) => !d.name.trim())) throw new Error('Every style needs a topic name.')
    setSaving(true)
    try {
      await saveStyles(list.map((d) => ({ ...d, name: d.name.trim(), bankSize: Math.max(1, Math.min(500, Math.round(d.bankSize) || 1)) })))
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  async function run(job: () => Promise<void>) {
    setError('')
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.')
    } finally {
      setProgress(null)
    }
  }

  /** Fills every language and length of the style's bank up to its bank size, a batch at a time */
  async function build(id: string, fresh: boolean) {
    if (dirty) await save()
    if (fresh) await clearBank(id)
    await loadStyles(true)
    const style = getStyles().find((s) => s.id === id)
    if (!style) return
    for (const lang of langs) {
      for (const length of lengthsFor(id)) {
        let total = fresh ? 0 : style.counts[`${lang.id}:${length}`] ?? 0
        let stalls = 0
        while (total < style.bankSize && stalls < 3) {
          setProgress({ id, text: `Writing ${lang.label} · ${length}: ${total}/${style.bankSize}` })
          const r = await generateBatch(id, lang.id, length, Math.min(batchSize[length], style.bankSize - total))
          total = r.total
          stalls = r.added ? 0 : stalls + 1
        }
      }
    }
    await loadStyles(true)
  }

  const busy = saving || !!progress

  return (
    <Panel
      title="Built-in styles"
      action={
        <>
          <SmallBtn onClick={() => edit([...drafts, { id: newId('st'), name: 'New style', keywords: [], prompt: '', bankSize: 50 }])} disabled={busy}>
            <Plus className="size-4" /> Add style
          </SmallBtn>
          <SmallBtn tone="gold" onClick={() => void run(() => save())} disabled={busy || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {dirty ? 'Save styles' : 'Saved'}
          </SmallBtn>
        </>
      }
    >
      <p className="text-sm text-gold-700/80">
        Each style is a topic with your own keywords and prompt. <b>Build bank</b> writes the number of lines you set for every language and length ahead of time and saves them for every visitor;
        Random then draws from that bank. Every line includes “LISA” and uses the keywords naturally.
      </p>
      {error && <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      {!saved.length && <p className="py-4 text-center text-sm text-gold-600">Loading styles…</p>}
      <div className="space-y-5">
        {drafts.map((d, i) => {
          const s = saved.find((x) => x.id === d.id)
          const users = lineTypes.filter((t) => t.style === d.id)
          return (
            <div key={d.id} className="rounded-2xl border border-gold-200 bg-white/50 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                <Field label="Topic name"><input value={d.name} onChange={(e) => patch(d.id, { name: e.target.value })} className={inputCls} /></Field>
                <Field label="Lines per language & length">
                  <input type="number" min={1} max={500} value={d.bankSize} onChange={(e) => patch(d.id, { bankSize: Number(e.target.value) })} className={inputCls} />
                </Field>
              </div>
              <Field label="Keywords" hint="Press Enter or comma to add · click a keyword to edit it">
                <KeywordInput value={d.keywords} onChange={(keywords) => patch(d.id, { keywords })} />
              </Field>
              <Field label="Prompt" hint="Tell the writer the tone, angle and anything to include or avoid for this topic">
                <textarea rows={3} value={d.prompt} onChange={(e) => patch(d.id, { prompt: e.target.value })} className={`${inputCls} w-full rounded-2xl`} />
              </Field>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gold-700">
                <span className="text-gold-600">Bank:</span>
                {s ? (
                  langs.flatMap((l) =>
                    lengthsFor(d.id).map((len) => {
                      const n = s.counts[`${l.id}:${len}`] ?? 0
                      return (
                        <span key={l.id + len} className={`rounded-full px-2 py-0.5 ${n >= s.bankSize ? 'bg-emerald-100 text-emerald-800' : n ? 'bg-amber-100 text-amber-900' : 'bg-gold-100 text-gold-700'}`}>
                          {l.label} {len} {n}/{s.bankSize}
                        </span>
                      )
                    }),
                  )
                ) : (
                  <span>save to start</span>
                )}
                <span className="ml-auto text-gold-600">{users.length ? `Used by: ${users.map((t) => t.name).join(', ')}` : 'Not used by any type yet'}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {progress?.id === d.id && (
                  <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-gold-700">
                    <Loader2 className="size-3.5 animate-spin" /> {progress.text}
                  </span>
                )}
                <SmallBtn onClick={() => move(i, -1)} disabled={busy}><ArrowUp className="size-3.5" /></SmallBtn>
                <SmallBtn onClick={() => move(i, 1)} disabled={busy}><ArrowDown className="size-3.5" /></SmallBtn>
                <SmallBtn tone="gold" onClick={() => void run(() => build(d.id, false))} disabled={busy}>
                  <Sparkles className="size-3.5" /> Build bank
                </SmallBtn>
                {!busy && (
                  <ConfirmButton onConfirm={() => void run(() => build(d.id, true))} message="Delete this style's saved lines and write a new bank with the current settings?">
                    <RefreshCw className="size-3.5" /> Rebuild
                  </ConfirmButton>
                )}
                {d.id !== 'story' && !busy && (
                  <ConfirmButton
                    onConfirm={() => {
                      const next = drafts.filter((x) => x.id !== d.id)
                      setDrafts(next)
                      void run(() => save(next))
                    }}
                    message={`Delete this style and its saved lines?${users.length ? ' Types using it fall back to the general phrase bank until you pick another style.' : ''}`}
                  >
                    <Trash2 className="size-3.5" /> Delete style
                  </ConfirmButton>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function KeywordInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  function commit() {
    const words = input.split(/[,\n]/).map((w) => w.trim()).filter(Boolean)
    if (!words.length) return
    onChange([...new Set([...value, ...words])])
    setInput('')
  }

  return (
    <div className="rounded-2xl border border-gold-300 bg-white/80 p-2 flex flex-wrap gap-2 items-center">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-sm text-gold-800">
          <button
            type="button"
            title="Edit"
            onClick={() => {
              onChange(value.filter((x) => x !== v))
              setInput(v)
            }}
          >
            {v}
          </button>
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="text-gold-600 hover:text-gold-900">
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          }
        }}
        placeholder="Add a keyword"
        className="flex-1 min-w-32 bg-transparent px-2 text-sm text-gold-900 placeholder-gold-600/60 focus:outline-none"
      />
    </div>
  )
}
