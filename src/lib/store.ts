/**
 * Client-side store for site content and visitor activity.
 * Content edits from Owner Studio and visitor activity are kept in this
 * browser's localStorage for now; PLAN.md milestone 2 moves both to
 * Netlify Database so every visitor shares the same data.
 * Visitor activity (counts, ticks, copied lines and per-post drafts) stays
 * until the visitor clears it with a "Clear history" button.
 */
import { useSyncExternalStore } from 'react'
import { defaultData } from '@/data/fixtures'
import type { Activity, PostDraft, SiteData } from './types'

const DATA_KEY = 'lisa-engagement:data:v1'
const ACTIVITY_KEY = 'lisa-engagement:activity:v1'

const emptyActivity: Activity = { myComments: {}, engaged: {}, shared: {}, usedLines: {}, postLines: {}, drafts: {} }

let data: SiteData = defaultData
let activity: Activity = emptyActivity
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const d = localStorage.getItem(DATA_KEY)
    if (d) data = { ...defaultData, ...JSON.parse(d) }
    const a = localStorage.getItem(ACTIVITY_KEY)
    if (a) activity = { ...emptyActivity, ...JSON.parse(a) }
  } catch {
    // Corrupt storage falls back to defaults
  }
  // Keep other open tabs in step with this one
  window.addEventListener('storage', (e) => {
    if (e.key !== DATA_KEY && e.key !== ACTIVITY_KEY) return
    try {
      if (e.key === DATA_KEY) data = e.newValue ? { ...defaultData, ...JSON.parse(e.newValue) } : defaultData
      else activity = e.newValue ? { ...emptyActivity, ...JSON.parse(e.newValue) } : emptyActivity
      emit()
    } catch {
      // Ignore a half-written value from the other tab
    }
  })
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode): keep working in memory
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function emit() {
  listeners.forEach((l) => l())
}

export function useSiteData(): SiteData {
  return useSyncExternalStore(
    subscribe,
    () => {
      load()
      return data
    },
    () => defaultData,
  )
}

export function useActivity(): Activity {
  return useSyncExternalStore(
    subscribe,
    () => {
      load()
      return activity
    },
    () => emptyActivity,
  )
}

/** Current values outside React (e.g. right after hydration, before the hooks catch up) */
export function getSiteData() {
  load()
  return data
}

export function getActivity() {
  load()
  return activity
}

export function updateData(fn: (d: SiteData) => SiteData) {
  load()
  data = fn(data)
  save(DATA_KEY, data)
  emit()
}

export function updateActivity(fn: (a: Activity) => Activity) {
  load()
  activity = fn(activity)
  save(ACTIVITY_KEY, activity)
  emit()
}

/** Marks a line as copied on a post so it is never served again (until that post's history is cleared) */
export function markLineUsed(postId: string, lineId: string) {
  updateActivity((a) => ({
    ...a,
    usedLines: { ...a.usedLines, [lineId]: true },
    postLines: { ...a.postLines, [postId]: [...new Set([...(a.postLines[postId] ?? []), lineId])] },
  }))
}

export function saveDraft(postId: string, patch: PostDraft) {
  updateActivity((a) => ({ ...a, drafts: { ...a.drafts, [postId]: { ...a.drafts[postId], ...patch } } }))
}

/** Wipes everything this visitor did on one post: comment count, ticks, drafts, and the lines copied there */
export function clearPostHistory(postId: string) {
  updateActivity((a) => {
    const drop = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== postId))
    const freed = new Set(a.postLines[postId] ?? [])
    const stillUsed = new Set(Object.entries(a.postLines).filter(([k]) => k !== postId).flatMap(([, ids]) => ids))
    return {
      myComments: drop(a.myComments),
      engaged: drop(a.engaged),
      shared: drop(a.shared),
      usedLines: Object.fromEntries(Object.entries(a.usedLines).filter(([id]) => !freed.has(id) || stillUsed.has(id))) as Record<string, true>,
      postLines: drop(a.postLines),
      drafts: drop(a.drafts),
    }
  })
}

export function replaceData(next: SiteData) {
  updateData(() => ({ ...defaultData, ...next }))
}

export function resetData() {
  updateData(() => defaultData)
}

export function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
