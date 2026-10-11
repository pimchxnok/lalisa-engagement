/**
 * Built-in comment styles and their line banks, shared by every visitor through /api/styles.
 * A comment type's `style` points at one of these ids. Each style has up to six sets (comment EN/TH short/medium,
 * story EN/TH short); the owner turns sets on, sets how many lines each should hold and builds them one set at a time
 * from Owner Studio. Random draws from the chosen set instead of writing new lines.
 * Bank line ids are `s:<row id>`, so copied lines join `usedLines` like every other line.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { fillTemplate, type PickedLine } from './generator'
import { SESSION_PW_KEY } from './owner'
import type { Campaign, Lang, LineLength, LineType } from './types'

/** The one style that backs the original IG Story captions; it can be edited but not deleted */
export const STORY_STYLE_ID = 'story'

/** Where a line is used: "Write a comment" or "Share to IG Story" */
export type LineSystem = 'comment' | 'story'

/** Lengths each system offers visitors: Story captions are Short only, comments Short or Medium */
export const systemLengths: Record<LineSystem, LineLength[]> = { comment: ['short', 'medium'], story: ['short'] }
export const systemLabel: Record<LineSystem, string> = { comment: 'Write a comment', story: 'Share to IG Story' }
export const langLabel: Record<Lang, string> = { en: 'English', th: 'ไทย' }
export const lengthLabel: Record<LineLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' }

/** One bank of lines: a system, a language and a length of one style */
export type LineSet = { system: LineSystem; lang: Lang; length: LineLength }
export const setKey = (s: LineSet) => `${s.system}:${s.lang}:${s.length}`

/** Every set a style can have, in display order */
export const allSets: LineSet[] = (['comment', 'story'] as const).flatMap((system) =>
  (['en', 'th'] as const).flatMap((lang) => systemLengths[system].map((length) => ({ system, lang, length }))),
)
export const setKeys = allSets.map(setKey)

export type CommentStyle = {
  id: string
  name: string
  keywords: string[]
  prompt: string
  /** Lines the owner wants per set key; a set is on when its target is above 0 */
  targets: Record<string, number>
  story: boolean
  /** Lines in the bank per set key */
  counts: Record<string, number>
}

export type StyleLine = { id: string; text: string }

/** Lengths outside a system's list are served from the closest allowed one (old "long" drafts become medium) */
export const allowedLength = (system: LineSystem, length: LineLength): LineLength =>
  systemLengths[system].includes(length) ? length : systemLengths[system][systemLengths[system].length - 1]

const isOn = (style: CommentStyle | undefined, system: LineSystem, lang: Lang, length?: LineLength) =>
  !!style && systemLengths[system].some((l) => (!length || l === length) && (style.targets[setKey({ system, lang, length: l })] ?? 0) > 0)

/**
 * The visitor-facing types for a system and language, following the owner's set configuration.
 * Before styles load (or when nothing is set up for the language) it falls back to the old split:
 * Story-style types for Story, every other type for comments.
 */
export function typesFor(lineTypes: LineType[], list: CommentStyle[], system: LineSystem, lang: Lang): LineType[] {
  const legacy = lineTypes.filter((t) => (t.style === STORY_STYLE_ID) === (system === 'story'))
  if (!list.length) return legacy
  const byId = new Map(list.map((s) => [s.id, s]))
  const configured = lineTypes.filter((t) => isOn(byId.get(t.style), system, lang))
  if (configured.length) return configured
  const otherLang = lineTypes.filter((t) => isOn(byId.get(t.style), system, lang === 'en' ? 'th' : 'en'))
  return otherLang.length ? otherLang : legacy
}

/** Lengths the owner turned on for a type in this system and language (all of the system's lengths when none are) */
export function lengthsFor(list: CommentStyle[], styleId: string | undefined, system: LineSystem, lang: Lang): LineLength[] {
  const style = list.find((s) => s.id === styleId)
  const on = systemLengths[system].filter((l) => isOn(style, system, lang, l))
  return on.length ? on : systemLengths[system]
}

let styles: CommentStyle[] = []
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function loadStyles(force = false) {
  if (typeof window === 'undefined') return Promise.resolve()
  if (loading && !force) return loading
  if (loaded && !force) return Promise.resolve()
  loading = fetch('/api/styles')
    .then((res) => (res.ok ? res.json() : { styles }))
    .then((body: { styles?: CommentStyle[] }) => {
      styles = body.styles ?? styles
      loaded = true
      emit()
    })
    .catch(() => undefined)
    .finally(() => (loading = null))
  return loading
}

/** Current styles outside React, e.g. right after `loadStyles(true)` */
export const getStyles = () => styles

export function useStyles() {
  useEffect(() => void loadStyles(), [])
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => styles,
    () => styles,
  )
}

function ownerHeaders() {
  return { 'content-type': 'application/json', 'x-studio-password': sessionStorage.getItem(SESSION_PW_KEY) ?? '' }
}

async function ownerFetch(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: ownerHeaders() })
  if (res.status === 401) throw new Error('Please lock and unlock the Studio again, then retry.')
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong — try again.')
  return body
}

/** Saves the full ordered list of styles and their set configuration for every visitor. Never removes lines from a kept style. */
export async function saveStyles(next: Omit<CommentStyle, 'counts' | 'story'>[]) {
  const body = await ownerFetch('/api/styles', {
    method: 'PUT',
    body: JSON.stringify({ styles: next.map(({ id, name, keywords, prompt, targets }) => ({ id, name, keywords, prompt, targets })) }),
  })
  styles = body.styles
  banks.clear()
  emit()
}

/** Writes up to `count` (max 25) new lines into exactly one set. Returns how many were added and the set's new size. */
export async function generateBatch(styleId: string, set: LineSet, count: number): Promise<{ added: number; total: number }> {
  const result = await ownerFetch('/api/style-lines', { method: 'POST', body: JSON.stringify({ styleId, ...set, count }) })
  banks.delete(bankKey(styleId, set))
  return result
}

/** Empties one set of a style; its other sets are left alone */
export async function clearSet(styleId: string, set: LineSet) {
  const q = new URLSearchParams({ style: styleId, ...set })
  await ownerFetch(`/api/style-lines?${q}`, { method: 'DELETE' })
  banks.delete(bankKey(styleId, set))
  await loadStyles(true)
}

// ── Banks, fetched once per page load for each style / set

const banks = new Map<string, Promise<StyleLine[]>>()
const bankKey = (styleId: string, set: LineSet) => `${styleId}|${setKey({ ...set, length: allowedLength(set.system, set.length) })}`

export function getBank(styleId: string, set: LineSet): Promise<StyleLine[]> {
  const k = bankKey(styleId, set)
  let job = banks.get(k)
  if (!job) {
    const q = new URLSearchParams({ style: styleId, system: set.system, lang: set.lang, length: allowedLength(set.system, set.length) })
    job = fetch(`/api/style-lines?${q}`)
      .then((res) => (res.ok ? res.json() : { lines: [] }))
      .then((body: { lines?: StyleLine[] }) => body.lines ?? [])
      .catch(() => {
        banks.delete(k)
        return []
      })
    banks.set(k, job)
  }
  return job
}

/**
 * A random unused line from one set of the style's bank, or null when the set is empty or every line was already copied.
 * `{brand}` / `{campaign}` are filled in like owner lines.
 */
export async function pickBankLine(opts: LineSet & { styleId: string; campaign?: Campaign; used: Record<string, true>; exclude?: string }): Promise<PickedLine | null> {
  const lines = await getBank(opts.styleId, opts)
  const fresh = lines.filter((l) => !opts.used[l.id] && l.id !== opts.exclude)
  if (!fresh.length) return null
  const l = fresh[Math.floor(Math.random() * fresh.length)]
  return { id: l.id, text: fillTemplate(l.text, opts.campaign), custom: false }
}
