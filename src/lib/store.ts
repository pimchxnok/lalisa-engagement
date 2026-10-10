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

import { engageKey, type EngageStatus } from './engagement'
import { platforms } from './platform'
import type { Activity, Post, PostDraft, SiteData, Tier } from './types'


const DATA_KEY = 'lisa-engagement:data:v1'
const ACTIVITY_KEY = 'lisa-engagement:activity:v1'

const emptyActivity: Activity = { myComments: {}, engaged: {}, shared: {}, status: {}, usedLines: {}, storyDrafts: {}, postLines: {}, drafts: {} }

let data: SiteData = defaultData
let activity: Activity = emptyActivity
let loaded = false
const listeners = new Set<() => void>()

/**
 * Tiers used to be one shared list for every platform. Saved data or backups
 * from that time get a copy of each tier per platform, and every post moves
 * to the copy that matches its own platform.
 */
function withPlatformTiers(d: SiteData): SiteData {
  const legacy = d.tiers.filter((t) => !(t as Partial<Tier>).platform)
  if (!legacy.length) return d
  const legacyIds = new Set(legacy.map((t) => t.id))
  return {
    ...d,
    tiers: [...d.tiers.filter((t) => !legacyIds.has(t.id)), ...platforms.flatMap((pl) => legacy.map((t) => ({ ...t, id: `${t.id}-${pl}`, platform: pl })))],
    posts: d.posts.map((p) => (p.tierId && legacyIds.has(p.tierId) ? { ...p, tierId: `${p.tierId}-${p.platform}` } : p)),
  }
}

/** Story ticks used to be saved per post id; move them to the shared per-post status */
function withEngageStatus(a: Activity, posts: Post[]): Activity {
  if (!Object.keys(a.shared).length) return a
  const status = { ...a.status }
  for (const p of posts) {
    if (!a.shared[p.id]) continue
    const k = engageKey(p)
    status[k] = { ...status[k], shared: status[k]?.shared ?? true }
  }
  return { ...a, shared: {}, status }
}

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const d = localStorage.getItem(DATA_KEY)
    if (d) data = withPlatformTiers({ ...defaultData, ...JSON.parse(d) })
    const a = localStorage.getItem(ACTIVITY_KEY)
    if (a) activity = withEngageStatus({ ...emptyActivity, ...JSON.parse(a) }, data.posts)
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

/** Current activity outside React, e.g. to restore a saved draft once after hydration */
export function getActivity(): Activity {
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
    postLines: {
      ...a.postLines,
      [postId]: [...new Set([...(a.postLines[postId] ?? []), lineId])],
    },
  }))
}

export function saveDraft(postId: string, patch: PostDraft) {
  updateActivity((a) => ({
    ...a,
    drafts: {
      ...a.drafts,
      [postId]: { ...a.drafts[postId], ...patch },
    },
  }))
}

/** Saves one activity's status for a post; both sections see it because it is keyed by the post link */
export function setEngageStatus(post: Post, patch: Partial<EngageStatus>) {
  const k = engageKey(post)
  updateActivity((a) => ({ ...a, status: { ...a.status, [k]: { ...a.status[k], ...patch } } }))
}

/** "I commented": marks the comment status and adds one to this visitor's comment count on the post */
export function markCommented(post: Post) {
  const k = engageKey(post)
  updateActivity((a) => ({
    ...a,
    myComments: { ...a.myComments, [post.id]: (a.myComments[post.id] ?? 0) + 1 },
    status: { ...a.status, [k]: { ...a.status[k], commented: true } },
  }))
}

export type ResetWhat = {
  commented?: boolean
  shared?: boolean
  /** Comment counts ("You've commented N times") */
  counts?: boolean
  /** Copied lines and saved drafts, so those lines can be served again */
  history?: boolean
}

/** Clears the chosen parts of this visitor's activity on the given posts only */
export function resetEngagement(posts: Post[], what: ResetWhat) {
  const ids = new Set(posts.map((p) => p.id))
  const keys = new Set(posts.map(engageKey))
  updateActivity((a) => {
    const drop = <T,>(r: Record<string, T>) =>
      Object.fromEntries(Object.entries(r).filter(([k]) => !ids.has(k)))

    const status = Object.fromEntries(
      Object.entries(a.status).flatMap(([k, s]) => {
        if (!keys.has(k)) return [[k, s]]
        const next = { ...s }
        if (what.commented) delete next.commented
        if (what.shared) delete next.shared
        return Object.keys(next).length ? [[k, next]] : []
      }),
    )

    let next: Activity = { ...a, status }
    if (what.counts) next = { ...next, myComments: drop(a.myComments) }
    if (what.history) {
      const freed = new Set([...ids].flatMap((id) => a.postLines[id] ?? []))
      const stillUsed = new Set(
        Object.entries(a.postLines)
          .filter(([k]) => !ids.has(k))
          .flatMap(([, lineIds]) => lineIds),
      )
      next = {
        ...next,
        engaged: drop(a.engaged),
        usedLines: Object.fromEntries(
          Object.entries(a.usedLines).filter(([id]) => !freed.has(id) || stillUsed.has(id)),
        ) as Record<string, true>,
        postLines: drop(a.postLines),
        drafts: drop(a.drafts),
        storyDrafts: drop(a.storyDrafts),
      }
    }
    return next
  })
}

/** Wipes everything this visitor did on one post: comment count, ticks, drafts, and the lines copied there */
export function clearPostHistory(post: Post) {
  resetEngagement([post], { commented: true, shared: true, counts: true, history: true })
}

export function replaceData(next: SiteData) {
  updateData(() => withPlatformTiers({ ...defaultData, ...next }))
}

export function resetData() {
  updateData(() => defaultData)
}

export function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
