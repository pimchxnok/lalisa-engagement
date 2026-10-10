/**
 * Built-in comment styles and their line banks, shared by every visitor through /api/styles.
 * A comment type's `style` points at one of these ids. Banks are written ahead of time from
 * Owner Studio, and Random draws from the bank of the chosen style instead of writing new lines.
 * Bank line ids are `s:<row id>`, so copied lines join `usedLines` like every other line.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { fillTemplate, type PickedLine } from './generator'
import { SESSION_PW_KEY } from './owner'
import type { Campaign, Lang, LineLength } from './types'

/** The one style that backs IG Story captions; it can be edited but not deleted */
export const STORY_STYLE_ID = 'story'

export type CommentStyle = {
  id: string
  name: string
  keywords: string[]
  prompt: string
  /** Lines kept ready for each language and length */
  bankSize: number
  story: boolean
  /** Lines in the bank per `${lang}:${length}` */
  counts: Record<string, number>
}

export type StyleLine = { id: string; text: string }

/** Story captions only come in one (short) length */
export const bankLength = (styleId: string, length: LineLength): LineLength => (styleId === STORY_STYLE_ID ? 'short' : length)

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

/** Saves the full ordered list of styles for every visitor */
export async function saveStyles(next: Omit<CommentStyle, 'counts' | 'story'>[]) {
  const body = await ownerFetch('/api/styles', {
    method: 'PUT',
    body: JSON.stringify({ styles: next.map(({ id, name, keywords, prompt, bankSize }) => ({ id, name, keywords, prompt, bankSize })) }),
  })
  styles = body.styles
  banks.clear()
  emit()
}

/** Writes one batch into a bank. Returns how many lines were added and the bank's new size. */
export async function generateBatch(styleId: string, lang: Lang, length: LineLength, count: number): Promise<{ added: number; total: number }> {
  const result = await ownerFetch('/api/style-lines', { method: 'POST', body: JSON.stringify({ styleId, lang, length, count }) })
  banks.delete(bankKey(styleId, lang, length))
  return result
}

export async function clearBank(styleId: string) {
  await ownerFetch(`/api/style-lines?style=${encodeURIComponent(styleId)}`, { method: 'DELETE' })
  for (const k of [...banks.keys()]) if (k.startsWith(`${styleId}|`)) banks.delete(k)
  await loadStyles(true)
}

// ── Banks, fetched once per page load for each style / language / length

const banks = new Map<string, Promise<StyleLine[]>>()
const bankKey = (styleId: string, lang: Lang, length: LineLength) => [styleId, lang, bankLength(styleId, length)].join('|')

export function getBank(styleId: string, lang: Lang, length: LineLength): Promise<StyleLine[]> {
  const k = bankKey(styleId, lang, length)
  let job = banks.get(k)
  if (!job) {
    job = fetch(`/api/style-lines?style=${encodeURIComponent(styleId)}&lang=${lang}&length=${bankLength(styleId, length)}`)
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
 * A random unused line from the style's bank, or null when the bank is empty or every line was already copied.
 * `{brand}` / `{campaign}` are filled in like owner lines.
 */
export async function pickBankLine(opts: { styleId: string; lang: Lang; length: LineLength; campaign?: Campaign; used: Record<string, true>; exclude?: string }): Promise<PickedLine | null> {
  const lines = await getBank(opts.styleId, opts.lang, opts.length)
  const fresh = lines.filter((l) => !opts.used[l.id] && l.id !== opts.exclude)
  if (!fresh.length) return null
  const l = fresh[Math.floor(Math.random() * fresh.length)]
  return { id: l.id, text: fillTemplate(l.text, opts.campaign), custom: false }
}
