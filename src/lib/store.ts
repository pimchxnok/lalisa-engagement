/**
 * Client-side store for site content and visitor activity.
 * Content edits from Owner Studio and visitor activity are kept in this
 * browser's localStorage for now; PLAN.md milestone 2 moves both to
 * Netlify Database so every visitor shares the same data.
 */
import { useSyncExternalStore } from 'react'
import { defaultData } from '@/data/fixtures'
import type { Activity, SiteData } from './types'

const DATA_KEY = 'lisa-engagement:data:v1'
const ACTIVITY_KEY = 'lisa-engagement:activity:v1'

const emptyActivity: Activity = { myComments: {}, engaged: {}, shared: {}, usedLines: {}, storyDrafts: {} }

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

/** Current activity outside React, e.g. to restore a saved draft once after hydration */
export function getActivity(): Activity {
  load()
  return activity
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

/** Forgets this visitor's comment count, engaged/shared ticks and story draft for one post. Used lines stay used. */
export function clearPostHistory(postId: string) {
  updateActivity((a) => {
    const omit = <T>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== postId))
    return { ...a, myComments: omit(a.myComments), engaged: omit(a.engaged), shared: omit(a.shared), storyDrafts: omit(a.storyDrafts) }
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
