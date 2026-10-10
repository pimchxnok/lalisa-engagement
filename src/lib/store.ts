/**
 * Client-side store for site content and visitor activity.
 * Content edits from Owner Studio and visitor activity are kept in this
 * browser's localStorage for now; PLAN.md milestone 2 moves both to
 * Netlify Database so every visitor shares the same data.
 */
import { useSyncExternalStore } from 'react'
import { defaultData } from '@/data/fixtures'
import { platforms } from './platform'
import type { Activity, SiteData, Tier } from './types'

const DATA_KEY = 'lisa-engagement:data:v1'
const ACTIVITY_KEY = 'lisa-engagement:activity:v1'

const emptyActivity: Activity = { myComments: {}, engaged: {}, shared: {}, usedLines: {} }

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

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const d = localStorage.getItem(DATA_KEY)
    if (d) data = withPlatformTiers({ ...defaultData, ...JSON.parse(d) })
    const a = localStorage.getItem(ACTIVITY_KEY)
    if (a) activity = { ...emptyActivity, ...JSON.parse(a) }
  } catch {
    // Corrupt storage falls back to defaults
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

export function updateData(fn: (d: SiteData) => SiteData) {
  load()
  data = fn(data)
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
  emit()
}

export function updateActivity(fn: (a: Activity) => Activity) {
  load()
  activity = fn(activity)
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity))
  emit()
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
