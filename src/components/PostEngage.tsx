import { Check, MessageCircle, Send, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CommentComposer } from './CommentComposer'
import { StorySharePanel } from './StorySharePanel'
import { EngageRibbon } from './EngageStatus'
import { canShareStory, engageStatus } from '@/lib/engagement'
import { markCommented, setEngageStatus, useActivity } from '@/lib/store'
import type { Campaign, Post } from '@/lib/types'

/** Comment / Share to Story tabs plus the one place to save "I commented" and "I shared to Stories" */
export function PostEngage({ post, campaign, allowCaption }: { post: Post; campaign?: Campaign; allowCaption: boolean }) {
  const activity = useActivity()
  const [mode, setMode] = useState<'comment' | 'story'>('comment')
  const [rollSignal, setRollSignal] = useState(0)
  const [flash, setFlash] = useState('')
  const status = engageStatus(activity, post)
  const canStory = canShareStory(post)
  const view = canStory ? mode : 'comment'
  const mine = activity.myComments[post.id] ?? 0

  function toast(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1800)
  }

  function commented() {
    markCommented(post)
    setRollSignal((n) => n + 1)
    toast('Nice! Comment saved ✓')
  }

  function toggleShared() {
    setEngageStatus(post, { shared: !status.shared })
    toast(status.shared ? 'Story share undone' : 'Story share saved ✓')
  }

  return (
    <>
      {canStory && (
        <div className="glass grid grid-cols-2 gap-1 rounded-full p-1" role="tablist" aria-label="What do you want to do?">
          <ModeTab on={view === 'comment'} onClick={() => setMode('comment')} done={status.commented} icon={<MessageCircle className="size-4" />} label="Comment" />
          <ModeTab on={view === 'story'} onClick={() => setMode('story')} done={status.shared} icon={<Send className="size-4" />} label="Share to Story" />
        </div>
      )}

      {view === 'comment' ? (
        <CommentComposer key={post.id} post={post} campaign={campaign} allowCaption={allowCaption} rollSignal={rollSignal} />
      ) : (
        <StorySharePanel key={post.id} post={post} campaign={campaign} />
      )}

      <section className="glass rounded-3xl p-4 md:px-6 ring-1 ring-gold-200" aria-label="Save your engagement">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-gold-800">Done? Save your progress</h2>
          <EngageRibbon post={post} status={status} inline />
        </div>
        <div className={`grid gap-2 ${canStory ? 'sm:grid-cols-2' : ''}`}>
          <div className="flex flex-col gap-1">
            <button
              onClick={commented}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow ${
                status.commented ? 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              <MessageCircle className="size-4" /> {status.commented ? 'Commented ✓ · tap for another' : 'I commented'}
            </button>
            <span className="text-center text-xs text-gold-700">
              You’ve commented <b>{mine}</b> {mine === 1 ? 'time' : 'times'} on this post
            </span>
          </div>
          {canStory ? (
            <div className="flex flex-col gap-1">
              <button
                onClick={toggleShared}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow ${
                  status.shared ? 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50' : 'bg-gradient-to-r from-pink-400 to-rose-400 text-white hover:brightness-105'
                }`}
              >
                {status.shared ? <Undo2 className="size-4" /> : <Send className="size-4" />}
                {status.shared ? 'Shared to Stories ✓ · undo' : 'I shared to Stories'}
              </button>
              <span className="text-center text-xs text-gold-700">{status.shared ? 'Saved on this device' : 'Tap after posting it to your story'}</span>
            </div>
          ) : (
            <p className="text-xs text-gold-600">Story sharing is for Instagram posts, so this TikTok post only needs a comment.</p>
          )}
        </div>
      </section>

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gold-900/90 px-5 py-2.5 text-sm text-white shadow-lg">
          {flash}
        </div>
      )}
    </>
  )
}

function ModeTab({ on, onClick, done, icon, label }: { on: boolean; onClick: () => void; done: boolean; icon: ReactNode; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${on ? 'btn-gold' : 'text-gold-800 hover:bg-gold-100/70'}`}
    >
      {icon} {label}
      {done && <Check className={`size-4 ${on ? '' : 'text-emerald-600'}`} aria-label="done" />}
    </button>
  )
}
