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
  useStyles,
  type BuildResult,
  type CommentStyle,
  type LineSet,
} from '@/lib/styles'
import type { LineLength } from '@/lib/types'
import { ConfirmButton, Field, inputCls, Panel, SmallBtn } from './fields'

type Draft = Omit<CommentStyle, 'counts' | 'story'>

/** Lines asked for per request, kept small so each request finishes well within the server time limit */
const batchSize: Record<LineLength, number> = { short: 20, medium: 15, long: 15 }
const MAX_LINES = 2000
/** New styles start with English and Thai comment sets; the owner changes them before building anything */
const newTargets = () => ({ 'comment:en:short': 50, 'comment:en:medium': 50, 'comment:th:short': 50, 'comment:th:medium': 50 })

const toDraft = (s: CommentStyle): Draft => ({ id: s.id, name: s.name, keywords: s.keywords, prompt: s.prompt, targets: { ...s.targets } })
const setName = (s: LineSet) => `${s.system === 'story' ? 'Story' : 'Comment'} · ${s.lang.toUpperCase()} · ${lengthLabel[s.length]}`
const clampLines = (n: number) => Math.max(0, Math.min(MAX_LINES, Math.round(n) || 0))

type Progress = { id: string; key: string; text: string }
type BuildJob = { id: string; set: LineSet; count: number; keywords?: string[] }

/**
 * Owner-defined built-in styles (the topics behind comment and caption types): keywords, a prompt and a set
 * configuration — which system / language / length sets are on and how many lines each should hold.
 * Lines are built only for the sets the owner picks; nothing builds every language or length at once.
 */
export function StylesEditor() {
  const saved = useStyles()
  const { lineTypes } = useSiteData()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
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
    setNotice(null)
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.')
    } finally {
      setProgress(null)
    }
  }

  /**
   * Adds `count` new lines to exactly one set of one style, a batch at a time, writing only from `keywords`
   * (the style's saved keywords unless the build names its own). Other sets are never touched. Returns a summary;
   * when fewer lines than asked for are added, it says how many and why instead of reporting success.
   */
  async function buildSet(id: string, set: LineSet, count: number, keywords?: string[], step = ''): Promise<{ ok: boolean; text: string }> {
    const style = getStyles().find((s) => s.id === id)
    if (!style) throw new Error('Save the style before building lines for it.')
    const key = setKey(set)
    const name = `${style.name} · ${setName(set)}`
    const words = keywords ?? style.keywords
    if (!words.length) return { ok: false, text: `${name}: skipped — add keywords to ${style.name} first, lines are written only from your keywords.` }
    let added = 0
    let total = style.counts[key] ?? 0
    let stalls = 0
    let capped = false
    let failure = ''
    const skipped: BuildResult['skipped'] = { duplicate: 0, offKeyword: 0, length: 0, invalid: 0 }
    while (added < count && stalls < 3 && !stop.current && !capped) {
      setProgress({ id, key, text: `${step}Writing ${name}: ${added}/${count} new (${total} in set)` })
      let r: BuildResult
      try {
        r = await generateBatch(id, set, Math.min(batchSize[set.length], count - added), words)
      } catch (e) {
        failure = e instanceof Error ? e.message : 'The line writer stopped responding.'
        break
      }
      added += r.added
      total = r.total
      capped = r.capped || total >= MAX_LINES
      for (const k of Object.keys(skipped) as (keyof typeof skipped)[]) skipped[k] += r.skipped[k]
      // A few batches in a row with nothing new means the keywords are used up
      stalls = r.added ? 0 : stalls + 1
    }
    const summary = `${name}: added ${added} of ${count} requested line${count === 1 ? '' : 's'} (${total} in set).`
    if (added >= count) return { ok: true, text: summary }
    const reasons = [
      failure && `the writer failed (${failure})`,
      stop.current && 'you stopped the build',
      capped && `the set reached its ${MAX_LINES}-line limit`,
      skipped.duplicate && `${skipped.duplicate} repeated lines already saved`,
      skipped.offKeyword && `${skipped.offKeyword} didn't use any of the keywords`,
      skipped.length && `${skipped.length} were not ${lengthLabel[set.length]} length`,
      skipped.invalid && `${skipped.invalid} were unusable (no "LISA" or empty)`,
      stalls >= 3 && 'the keywords ran out of new lines — add more keywords for more variety',
    ].filter(Boolean)
    return { ok: false, text: `Incomplete — ${summary} ${count - added} not added: ${reasons.join('; ') || 'the writer returned too few lines'}.` }
  }

  /** Builds every chosen set one after another; Stop ends the whole queue */
  async function buildMany(jobs: BuildJob[]) {
    if (dirty) await save()
    await loadStyles(true)
    stop.current = false
    const results: { ok: boolean; text: string }[] = []
    for (const [i, j] of jobs.entries()) {
      if (stop.current) break
      const step = jobs.length > 1 ? `(${i + 1}/${jobs.length}) ` : ''
      results.push(await buildSet(j.id, j.set, j.count, j.keywords, step))
    }
    await loadStyles(true)
    const notBuilt = jobs.length - results.length
    const lines = [...results.map((r) => r.text), notBuilt ? `${notBuilt} set${notBuilt === 1 ? '' : 's'} not started — you stopped the build.` : ''].filter(Boolean)
    setNotice({ tone: results.every((r) => r.ok) && !notBuilt ? 'ok' : 'warn', text: lines.join('\n') })
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
        onBuild={(jobs) => void run(() => buildMany(jobs))}
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
        {notice && <p className={`whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{notice.text}</p>}
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
                                    <SmallBtn tone="gold" onClick={() => void run(() => buildMany([{ id: d.id, set, count: missing }]))} disabled={busy || !s || !missing}>
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

const pick = (styleId: string, set: LineSet) => `${styleId}|${setKey(set)}`

/**
 * Tick any mix of styles and sets (system · language · length) and a number of lines, then build all the ticked
 * sets in one run, one after another. Unticked sets are never built.
 */
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
  onBuild: (jobs: BuildJob[]) => void
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'count' | 'missing'>('count')
  const [count, setCount] = useState(20)
  /** This build's keywords (single style only); they start as the style's saved ones and edits here don't change the style */
  const [keywords, setKeywords] = useState<string[] | null>(null)

  const targetOf = (s: CommentStyle, key: string) => drafts.find((d) => d.id === s.id)?.targets[key] ?? s.targets[key] ?? 0
  const missingOf = (s: CommentStyle, key: string) => Math.max(0, targetOf(s, key) - (s.counts[key] ?? 0))
  const n = clampLines(count)

  const chosen = styles.flatMap((s) => allSets.filter((set) => picked.has(pick(s.id, set))).map((set) => ({ style: s, set })))
  const chosenStyles = [...new Set(chosen.map((c) => c.style))]
  const single = chosenStyles.length === 1 ? chosenStyles[0] : null
  const savedKeywords = single ? (drafts.find((d) => d.id === single.id)?.keywords ?? single.keywords) : []
  const words = keywords ?? savedKeywords
  const jobs: BuildJob[] = chosen
    .map(({ style, set }) => ({
      id: style.id,
      set,
      count: mode === 'count' ? n : missingOf(style, setKey(set)),
      keywords: single && keywords ? keywords : undefined,
    }))
    .filter((j) => j.count > 0)
  const totalLines = jobs.reduce((t, j) => t + j.count, 0)

  function toggle(keys: string[]) {
    const next = new Set(picked)
    const allOn = keys.every((k) => next.has(k))
    for (const k of keys) allOn ? next.delete(k) : next.add(k)
    setPicked(next)
    setKeywords(null)
  }
  const rowKeys = (s: CommentStyle) => allSets.map((set) => pick(s.id, set))
  const colKeys = (set: LineSet) => styles.map((s) => pick(s.id, set))
  const allKeys = styles.flatMap(rowKeys)
  const isOn = (keys: string[]) => keys.length > 0 && keys.every((k) => picked.has(k))

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
        Tick the sets you want — one, a few, or a whole row or column — and build them all in one go. Each ticked set gets new lines written only from its style&apos;s keywords, in the tone
        of the style&apos;s prompt; unticked sets are never built. Saved lines are never changed and repeats are skipped; if fewer lines than asked for are added, you&apos;ll see how many and why.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-gold-200 bg-white/60">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gold-600">
            <tr>
              <th className="px-3 py-2 align-bottom">
                <label className="inline-flex items-center gap-1.5 uppercase tracking-wider">
                  <input type="checkbox" checked={isOn(allKeys)} disabled={busy || !styles.length} onChange={() => toggle(allKeys)} className="size-4 accent-gold-500" />
                  Type (style)
                </label>
              </th>
              {allSets.map((set) => (
                <th key={setKey(set)} className="px-2 py-2 align-bottom">
                  <label className="flex flex-col items-center gap-1 text-center leading-tight">
                    <span className="whitespace-nowrap">{set.system === 'story' ? 'Story' : 'Comment'}</span>
                    <span className="whitespace-nowrap">{langLabel[set.lang]} · {lengthLabel[set.length]}</span>
                    <input
                      type="checkbox"
                      aria-label={`Tick ${setName(set)} for every style`}
                      checked={isOn(colKeys(set))}
                      disabled={busy || !styles.length}
                      onChange={() => toggle(colKeys(set))}
                      className="size-4 accent-gold-500"
                    />
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!styles.length && (
              <tr>
                <td colSpan={allSets.length + 1} className="px-3 py-4 text-center text-gold-600">Loading styles…</td>
              </tr>
            )}
            {styles.map((s) => (
              <tr key={s.id} className="border-t border-gold-100">
                <td className="px-3 py-1.5">
                  <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <input type="checkbox" checked={isOn(rowKeys(s))} disabled={busy} onChange={() => toggle(rowKeys(s))} className="size-4 accent-gold-500" />
                    {s.name}
                  </label>
                </td>
                {allSets.map((set) => {
                  const key = setKey(set)
                  const k = pick(s.id, set)
                  const have = s.counts[key] ?? 0
                  const target = targetOf(s, key)
                  const on = picked.has(k)
                  return (
                    <td key={key} className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={busy}
                        aria-pressed={on}
                        title={`${s.name} · ${setName(set)} — ${have} line${have === 1 ? '' : 's'}${target ? ` · ${target} wanted` : ' · not turned on yet (building turns it on)'}`}
                        onClick={() => toggle([k])}
                        className={`min-w-16 rounded-full border px-2 py-1 text-xs ${on ? 'border-gold-500 bg-gold-500 text-white' : 'border-gold-200 bg-white/70 text-gold-700 hover:border-gold-400'}`}
                      >
                        {on ? '✓ ' : ''}
                        {have}
                        {target ? `/${target}` : ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="How many lines" hint={mode === 'count' ? 'Written for every ticked set' : 'Each ticked set is topped up to its "Lines wanted" number; sets already full are skipped'}>
          <div className="flex flex-wrap items-center gap-2">
            {seg(mode, [{ id: 'count', label: 'Same number each' }, { id: 'missing', label: 'Fill what’s missing' }], setMode)}
            {mode === 'count' && (
              <input type="number" min={1} max={MAX_LINES} value={count} disabled={busy} onChange={(e) => setCount(Number(e.target.value))} className={`${inputCls} w-28`} />
            )}
          </div>
        </Field>
        <div className="md:col-span-2">
          {single ? (
            <>
              <Field label={`Keywords for this build · ${single.name}`} hint="The only subject matter the writer may use — every line contains at least one of them. Starts from the style's keywords; changes here apply to this build only.">
                <KeywordInput value={words} onChange={setKeywords} />
              </Field>
              {keywords && (
                <button type="button" onClick={() => setKeywords(null)} className="mt-1 text-xs text-gold-600 underline-offset-2 hover:underline">
                  Use the style&apos;s keywords again
                </button>
              )}
            </>
          ) : (
            chosenStyles.length > 1 && <p className="text-xs text-gold-600">Several styles are ticked, so each one is built from its own saved keywords.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SmallBtn tone="gold" disabled={busy || !jobs.length || (!!single && !words.length)} onClick={() => onBuild(jobs)}>
          <Hammer className="size-4" />
          {jobs.length ? ` Build ${jobs.length} set${jobs.length === 1 ? '' : 's'} · ${totalLines} lines` : chosen.length ? ' Ticked sets are already full' : ' Tick sets to build'}
        </SmallBtn>
        {picked.size > 0 && !busy && (
          <SmallBtn onClick={() => { setPicked(new Set()); setKeywords(null) }}>Clear ticks</SmallBtn>
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
