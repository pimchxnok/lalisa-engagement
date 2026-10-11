import { ArrowDown, ArrowUp, Eraser, Hammer, Loader2, Plus, Save, Square, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { newId, useSiteData } from '@/lib/store'
import {
  allSets,
  clearSet,
  generateBatch,
  getStyles,
  langLabel,
  lengthLabel,
  loadStyles,
  saveStyles,
  setKey,
  systemLabel,
  systemLengths,
  useStyles,
  type CommentStyle,
  type LineSet,
  type LineSystem,
} from '@/lib/styles'
import type { Lang, LineLength } from '@/lib/types'
import { ConfirmButton, Field, inputCls, Panel, SmallBtn } from './fields'

type Draft = Omit<CommentStyle, 'counts' | 'story'>

/** Lines asked for per request, kept small so each request finishes well within the server time limit */
const batchSize: Record<LineLength, number> = { short: 20, medium: 15, long: 10 }
const MAX_LINES = 2000
/** New styles start with English and Thai comment sets; the owner changes them before building anything */
const newTargets = () => ({ 'comment:en:short': 50, 'comment:en:medium': 50, 'comment:th:short': 50, 'comment:th:medium': 50 })

const toDraft = (s: CommentStyle): Draft => ({ id: s.id, name: s.name, keywords: s.keywords, prompt: s.prompt, targets: { ...s.targets } })
const setName = (s: LineSet) => `${s.system === 'story' ? 'Story' : 'Comment'} · ${s.lang.toUpperCase()} · ${lengthLabel[s.length]}`
const clampLines = (n: number) => Math.max(0, Math.min(MAX_LINES, Math.round(n) || 0))

type Progress = { id: string; key: string; text: string }

/**
 * Owner-defined built-in styles (the topics behind comment and caption types): keywords, a prompt and a set
 * configuration — which system / language / length sets are on and how many lines each should hold.
 * Lines are built one chosen set at a time; nothing builds every language or length at once.
 */
export function StylesEditor() {
  const saved = useStyles()
  const { lineTypes } = useSiteData()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const stop = useRef(false)

  // Follow the server copy until the owner starts editing
  useEffect(() => {
    if (!dirty) setDrafts(saved.map(toDraft))
  }, [saved])

  function edit(next: Draft[]) {
    setDrafts(next)
    setDirty(true)
  }

  const patch = (id: string, p: Partial<Draft>) => edit(drafts.map((d) => (d.id === id ? { ...d, ...p } : d)))
  const setTarget = (d: Draft, key: string, n: number) => {
    const { [key]: _, ...rest } = d.targets
    patch(d.id, { targets: n > 0 ? { ...rest, [key]: clampLines(n) } : rest })
  }

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
      await saveStyles(list.map((d) => ({ ...d, name: d.name.trim() })))
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  async function run(job: () => Promise<void>) {
    setError('')
    setNotice('')
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.')
    } finally {
      setProgress(null)
    }
  }

  /** Adds `count` new lines to exactly one set of one style, a batch at a time. Other sets are never touched. */
  async function buildSet(id: string, set: LineSet, count: number) {
    if (dirty) await save()
    await loadStyles(true)
    const style = getStyles().find((s) => s.id === id)
    if (!style) throw new Error('Save the style before building lines for it.')
    const key = setKey(set)
    const name = `${style.name} · ${setName(set)}`
    stop.current = false
    let added = 0
    let total = style.counts[key] ?? 0
    let stalls = 0
    while (added < count && stalls < 3 && !stop.current && total < MAX_LINES) {
      setProgress({ id, key, text: `Writing ${name}: ${added}/${count} new (${total} in set)` })
      const r = await generateBatch(id, set, Math.min(batchSize[set.length], count - added))
      added += r.added
      total = r.total
      // Lines that duplicate the set are skipped, so a few empty batches in a row means the topic is saturated
      stalls = r.added ? 0 : stalls + 1
    }
    await loadStyles(true)
    setNotice(
      `${name}: added ${added} new line${added === 1 ? '' : 's'} (${total} in set).` +
        (added < count ? (stop.current ? ' Stopped.' : ' The writer kept repeating existing lines — add keywords or widen the prompt for more variety.') : ''),
    )
  }

  const busy = saving || !!progress
  const stopBtn = (
    <SmallBtn onClick={() => (stop.current = true)}>
      <Square className="size-3.5" /> Stop
    </SmallBtn>
  )

  return (
    <div className="space-y-6">
      <SetBuilder
        styles={saved}
        drafts={drafts}
        busy={busy}
        progress={progress}
        stopBtn={stopBtn}
        onBuild={(id, set, count) => void run(() => buildSet(id, set, count))}
      />

      <Panel
        title="Built-in styles · configuration"
        action={
          <>
            <SmallBtn onClick={() => edit([...drafts, { id: newId('st'), name: 'New style', keywords: [], prompt: '', targets: newTargets() }])} disabled={busy}>
              <Plus className="size-4" /> Add style
            </SmallBtn>
            <SmallBtn tone="gold" onClick={() => void run(() => save())} disabled={busy || !dirty}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {dirty ? 'Save configuration' : 'Saved'}
            </SmallBtn>
          </>
        }
      >
        <p className="text-sm text-gold-700/80">
          Each style is a topic with your own keywords and prompt. Turn on the sets visitors should get — <b>Write a comment</b> comes in Short and Medium, <b>Share to IG Story</b> in Short only, each in
          English and Thai — and set how many lines each set should hold. Visitors only see a type in the system, language and lengths you turn on here. Nothing is written until you build a set;
          lowering a number never deletes lines.
        </p>
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
        {notice && <p className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</p>}
        {!saved.length && <p className="py-4 text-center text-sm text-gold-600">Loading styles…</p>}
        <div className="space-y-5">
          {drafts.map((d, i) => {
            const s = saved.find((x) => x.id === d.id)
            const users = lineTypes.filter((t) => t.style === d.id)
            return (
              <div key={d.id} className="rounded-2xl border border-gold-200 bg-white/50 p-4 space-y-3">
                <Field label="Topic name"><input value={d.name} onChange={(e) => patch(d.id, { name: e.target.value })} className={inputCls} /></Field>
                <Field label="Keywords" hint="Press Enter or comma to add · click a keyword to edit it">
                  <KeywordInput value={d.keywords} onChange={(keywords) => patch(d.id, { keywords })} />
                </Field>
                <Field label="Prompt" hint="Tell the writer the tone, angle and anything to include or avoid for this topic">
                  <textarea rows={3} value={d.prompt} onChange={(e) => patch(d.id, { prompt: e.target.value })} className={`${inputCls} w-full rounded-2xl`} />
                </Field>

                <div>
                  <p className="mb-1.5 text-sm font-medium text-gold-800">Sets</p>
                  <div className="overflow-x-auto rounded-2xl border border-gold-200 bg-white/60">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wider text-gold-600">
                        <tr>
                          <th className="px-3 py-2">On</th>
                          <th className="px-3 py-2">System</th>
                          <th className="px-3 py-2">Language</th>
                          <th className="px-3 py-2">Length</th>
                          <th className="px-3 py-2">Lines wanted</th>
                          <th className="px-3 py-2">Built</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {allSets.map((set) => {
                          const key = setKey(set)
                          const target = d.targets[key] ?? 0
                          const n = s?.counts[key] ?? 0
                          const missing = Math.max(0, target - n)
                          const running = progress?.id === d.id && progress.key === key
                          return (
                            <tr key={key} className={`border-t border-gold-100 ${target ? '' : 'text-gold-500'}`}>
                              <td className="px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Turn ${setName(set)} on`}
                                  checked={target > 0}
                                  disabled={busy}
                                  onChange={(e) => setTarget(d, key, e.target.checked ? Math.max(n, 50) : 0)}
                                  className="size-4 accent-gold-500"
                                />
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap">{systemLabel[set.system]}</td>
                              <td className="px-3 py-1.5">{langLabel[set.lang]}</td>
                              <td className="px-3 py-1.5">{lengthLabel[set.length]}</td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={MAX_LINES}
                                  value={target || ''}
                                  placeholder="off"
                                  disabled={busy}
                                  onChange={(e) => setTarget(d, key, Number(e.target.value))}
                                  className={`${inputCls} w-24 py-1`}
                                />
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <span className={`rounded-full px-2 py-0.5 text-xs ${target && n >= target ? 'bg-emerald-100 text-emerald-800' : n ? 'bg-amber-100 text-amber-900' : 'bg-gold-100 text-gold-700'}`}>
                                  {n}{target ? `/${target}` : ''}
                                </span>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex justify-end gap-1.5">
                                  {running ? (
                                    stopBtn
                                  ) : (
                                    <SmallBtn tone="gold" onClick={() => void run(() => buildSet(d.id, set, missing))} disabled={busy || !s || !missing}>
                                      <Hammer className="size-3.5" /> {missing ? `Build ${missing}` : 'Full'}
                                    </SmallBtn>
                                  )}
                                  {!busy && n > 0 && (
                                    <ConfirmButton
                                      onConfirm={() => void run(() => clearSet(d.id, set))}
                                      message={`Delete the ${n} saved lines in ${d.name} · ${setName(set)}? Other sets keep their lines.`}
                                    >
                                      <Eraser className="size-3.5" /> Clear
                                    </ConfirmButton>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {progress?.id === d.id && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gold-700">
                      <Loader2 className="size-3.5 animate-spin" /> {progress.text}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="mr-auto text-xs text-gold-600">{users.length ? `Used by: ${users.map((t) => t.name).join(', ')}` : 'Not used by any type yet'}</span>
                  <SmallBtn onClick={() => move(i, -1)} disabled={busy}><ArrowUp className="size-3.5" /></SmallBtn>
                  <SmallBtn onClick={() => move(i, 1)} disabled={busy}><ArrowDown className="size-3.5" /></SmallBtn>
                  {d.id !== 'story' && !busy && (
                    <ConfirmButton
                      onConfirm={() => {
                        const next = drafts.filter((x) => x.id !== d.id)
                        setDrafts(next)
                        void run(() => save(next))
                      }}
                      message={`Delete this style and all of its saved lines?${users.length ? ' Types using it fall back to the general phrase bank until you pick another style.' : ''}`}
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
    </div>
  )
}

/** Pick one system, language, style, length and a number of lines, then build only that set */
function SetBuilder({
  styles,
  drafts,
  busy,
  progress,
  stopBtn,
  onBuild,
}: {
  styles: CommentStyle[]
  drafts: Draft[]
  busy: boolean
  progress: Progress | null
  stopBtn: React.ReactNode
  onBuild: (id: string, set: LineSet, count: number) => void
}) {
  const [system, setSystem] = useState<LineSystem>('comment')
  const [lang, setLang] = useState<Lang>('en')
  const [styleId, setStyleId] = useState('')
  const [length, setLength] = useState<LineLength>('short')
  const [count, setCount] = useState(20)

  const style = styles.find((s) => s.id === styleId) ?? styles[0]
  const len = systemLengths[system].includes(length) ? length : 'short'
  const set: LineSet = { system, lang, length: len }
  const key = setKey(set)
  const have = style?.counts[key] ?? 0
  const target = drafts.find((d) => d.id === style?.id)?.targets[key] ?? style?.targets[key] ?? 0
  const n = clampLines(count)

  const seg = <T extends string>(value: T, options: { id: T; label: string }[], onChange: (v: T) => void) => (
    <div className="inline-flex flex-wrap rounded-full border border-gold-200 bg-white/50 p-0.5 text-sm">
      {options.map((o) => (
        <button key={o.id} type="button" disabled={busy} onClick={() => onChange(o.id)} className={`rounded-full px-3 py-1 ${value === o.id ? 'bg-gold-500 text-white' : 'text-gold-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )

  return (
    <Panel title="Build a set">
      <p className="text-sm text-gold-700/80">
        Writes new lines for the one set you pick — for example <b>Write a comment · English · Short · 100 lines</b> — using that style&apos;s keywords and prompt. No other language, length or
        type is built. Lines already in the set stay, and repeats are skipped, so you can build more later.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="System">{seg(system, (['comment', 'story'] as const).map((id) => ({ id, label: systemLabel[id] })), setSystem)}</Field>
        <Field label="Language">{seg(lang, (['en', 'th'] as const).map((id) => ({ id, label: langLabel[id] })), setLang)}</Field>
        <Field label="Type (style)">
          <select value={style?.id ?? ''} disabled={busy || !styles.length} onChange={(e) => setStyleId(e.target.value)} className={inputCls}>
            {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Length">{seg(len, systemLengths[system].map((id) => ({ id, label: lengthLabel[id] })), setLength)}</Field>
        <Field label="New lines to write" hint={`This set has ${have} line${have === 1 ? '' : 's'}${target ? ` · ${target} wanted in the configuration` : ' · not turned on yet (building turns it on)'}`}>
          <input type="number" min={1} max={MAX_LINES} value={count} disabled={busy} onChange={(e) => setCount(Number(e.target.value))} className={`${inputCls} w-32`} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SmallBtn tone="gold" disabled={busy || !style || n < 1} onClick={() => style && onBuild(style.id, set, n)}>
          <Hammer className="size-4" /> Build {n} · {style?.name ?? '…'} · {setName(set)}
        </SmallBtn>
        {target > have && !busy && (
          <SmallBtn onClick={() => setCount(target - have)}>Use the {target - have} still missing</SmallBtn>
        )}
        {progress && (
          <>
            {stopBtn}
            <span className="inline-flex items-center gap-1.5 text-xs text-gold-700">
              <Loader2 className="size-3.5 animate-spin" /> {progress.text}
            </span>
          </>
        )}
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
