import { Check, MessageCircle, RotateCcw, Send, X } from 'lucide-react'
import { useState } from 'react'
import { canShareStory, engageLevel, engageStatus, type EngageStatus } from '@/lib/engagement'
import { resetEngagement, useActivity, type ResetWhat } from '@/lib/store'
import type { Post } from '@/lib/types'

const levelStyle = {
  done: 'bg-emerald-500 text-white',
  partial: 'bg-amber-400 text-amber-950',
  none: 'bg-rose-500 text-white',
}

/**
 * Green = every activity done, amber = some done, red = not yet.
 * On cards it hangs from the top-right corner; `inline` renders it as a pill.
 */
export function EngageRibbon({ post, status, inline }: { post: Post; status: EngageStatus; inline?: boolean }) {
  const level = engageLevel(post, status)
  const story = canShareStory(post)
  const label = level === 'done' ? 'Engaged' : level === 'partial' ? 'Partly engaged' : 'Not engaged yet'
  const detail = [`Comment ${status.commented ? 'done' : 'to do'}`, story && `Story ${status.shared ? 'done' : 'to do'}`].filter(Boolean).join(' · ')

  return (
    <span
      title={detail}
      aria-label={`${label}: ${detail}`}
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider shadow-sm ${levelStyle[level]} ${
        inline ? 'rounded-full' : 'absolute right-5 top-0 rounded-b-xl'
      }`}
    >
      {level === 'done' ? <Check className="size-3.5" /> : level === 'none' ? <X className="size-3.5" /> : null}
      {label}
      {level === 'partial' && (
        <span className="ml-0.5 inline-flex items-center gap-1 normal-case tracking-normal">
          <Step done={status.commented} icon={<MessageCircle className="size-3" />} name="Comment" />
          {story && <Step done={status.shared} icon={<Send className="size-3" />} name="Story" />}
        </span>
      )}
    </span>
  )
}

function Step({ done, icon, name }: { done: boolean; icon: React.ReactNode; name: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] ${done ? 'bg-emerald-600 text-white' : 'bg-white/70 text-amber-900'}`}>
      {icon} {name} {done ? '✓' : '–'}
    </span>
  )
}

type Scope = { id: string; label: string; posts: Post[] }

const parts: { id: keyof ResetWhat; label: string; hint: string }[] = [
  { id: 'commented', label: 'Comment status', hint: '“I commented” ticks' },
  { id: 'shared', label: 'Stories status', hint: '“I shared to Stories” ticks' },
  { id: 'counts', label: 'Comment counts', hint: '“You’ve commented N times”' },
  { id: 'history', label: 'Copied lines & drafts', hint: 'Lets copied lines appear again' },
]

/** Progress summary and the single place to reset saved engagement for a list page */
export function EngageResetBar({ scopes }: { scopes: Scope[] }) {
  const activity = useActivity()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [scopeId, setScopeId] = useState(scopes[0]?.id)
  const [what, setWhat] = useState<ResetWhat>({ commented: true, shared: true, counts: true })
  const [flash, setFlash] = useState('')

  const shown = scopes[0]?.posts ?? []
  const levels = shown.map((p) => engageLevel(p, engageStatus(activity, p)))
  const count = (l: string) => levels.filter((x) => x === l).length
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]
  const chosen = parts.filter((p) => what[p.id])

  function close() {
    setOpen(false)
    setConfirming(false)
  }

  function reset() {
    if (!scope) return
    resetEngagement(scope.posts, what)
    close()
    setFlash(`Reset done for ${scope.posts.length} ${scope.posts.length === 1 ? 'post' : 'posts'}`)
    setTimeout(() => setFlash(''), 2200)
  }

  return (
    <>
      <div className="glass mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gold-800">
          <span className="text-gold-600">Your progress here:</span>
          <Pill className={levelStyle.done}>{count('done')} engaged</Pill>
          <Pill className={levelStyle.partial}>{count('partial')} partly</Pill>
          <Pill className={levelStyle.none}>{count('none')} not yet</Pill>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-white/60 px-4 py-1.5 text-sm text-gold-800 hover:border-rose-300 hover:text-rose-600"
        >
          <RotateCcw className="size-4" /> Reset engagement status
        </button>
      </div>

      {open && scope && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-gold-900/30 p-4 backdrop-blur-sm" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label="Reset engagement status" className="glass w-full max-w-md rounded-3xl bg-white/90 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            {!confirming ? (
              <>
                <h2 className="font-display text-2xl font-semibold text-gold-800">Reset engagement status</h2>
                <fieldset>
                  <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-gold-600">Which posts</legend>
                  <div className="space-y-1.5">
                    {scopes.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm text-gold-900">
                        <input type="radio" name="reset-scope" checked={scope.id === s.id} onChange={() => setScopeId(s.id)} className="accent-gold-600" />
                        {s.label} <span className="text-gold-500">({s.posts.length})</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-gold-600">What to clear</legend>
                  <div className="space-y-1.5">
                    {parts.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm text-gold-900">
                        <input type="checkbox" checked={!!what[p.id]} onChange={() => setWhat({ ...what, [p.id]: !what[p.id] })} className="mt-1 accent-gold-600" />
                        <span>
                          {p.label} <span className="block text-xs text-gold-600">{p.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex justify-end gap-2">
                  <button onClick={close} className="rounded-full border border-gold-300 bg-white/70 px-4 py-2 text-sm text-gold-800">Cancel</button>
                  <button
                    onClick={() => setConfirming(true)}
                    disabled={!chosen.length || !scope.posts.length}
                    className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold text-gold-800">Are you sure?</h2>
                <p className="text-sm text-gold-800">
                  This clears <b>{chosen.map((p) => p.label.toLowerCase()).join(', ')}</b> for <b>{scope.label.toLowerCase()}</b> ({scope.posts.length}{' '}
                  {scope.posts.length === 1 ? 'post' : 'posts'}). It can’t be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirming(false)} className="rounded-full border border-gold-300 bg-white/70 px-4 py-2 text-sm text-gold-800">Back</button>
                  <button onClick={reset} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600">Yes, reset</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gold-900/90 px-5 py-2.5 text-sm text-white shadow-lg">
          {flash}
        </div>
      )}
    </>
  )
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 font-medium ${className}`}>{children}</span>
}
