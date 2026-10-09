import { Check, Dices, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { requestAiLine } from '@/lib/aiLine'
import { pickLine, type PickedLine } from '@/lib/generator'
import { copyText } from '@/lib/platform'
import { getActivity, updateActivity, useActivity, useSiteData } from '@/lib/store'
import type { Campaign, Lang, Post } from '@/lib/types'

export function StorySharePanel({ post, campaign }: { post: Post; campaign?: Campaign }) {
  const data = useSiteData()
  const activity = useActivity()
  const storyType = data.lineTypes.find((t) => t.style === 'story')
  const mentions = useMemo(
    () => [...new Set([...(post.extraMentions ?? []), ...(campaign?.mentions ?? [])])],
    [post, campaign],
  )
  const hashtags = campaign?.hashtags ?? []

  const [lang, setLang] = useState<Lang>('en')
  const [line, setLine] = useState<PickedLine | null>(null)
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [box, setBox] = useState('')
  const [edited, setEdited] = useState(false)
  const [flash, setFlash] = useState('')
  const [writing, setWriting] = useState(false)
  const shared = !!activity.shared[post.id]

  function toast(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1800)
  }

  function pick() {
    if (!storyType) return null
    return pickLine({ type: storyType, lang, length: 'short', campaign, customLines: data.customLines, used: activity.usedLines, exclude: line?.id })
  }

  function saveDraft(text: string | undefined) {
    updateActivity((a) => {
      const { [post.id]: _, ...rest } = a.storyDrafts
      return { ...a, storyDrafts: text === undefined ? rest : { ...rest, [post.id]: text } }
    })
  }

  /** Drops the visitor's typed text so the box follows the caption and chips again */
  function discardDraft() {
    setEdited(false)
    if (getActivity().storyDrafts[post.id] !== undefined) saveDraft(undefined)
  }

  function roll() {
    setLine(pick())
    discardDraft()
  }

  async function writeWithAi() {
    if (!storyType || writing) return
    setWriting(true)
    try {
      setLine(
        await requestAiLine({
          mode: 'story',
          lang,
          length: 'short',
          typeName: storyType.name,
          typeDescription: storyType.description,
          platform: post.platform,
          campaign,
          postCaption: post.caption.slice(0, 600),
          avoid: line ? [line.text] : [],
        }),
      )
      discardDraft()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The AI writer is busy — try again.')
    } finally {
      setWriting(false)
    }
  }

  useEffect(() => setLine(pick()), [lang])
  useEffect(() => setOn(Object.fromEntries([...mentions, ...hashtags].map((t) => [t, true]))), [post.id])

  // Rebuild the box from caption + selected chips unless the visitor typed in it
  useEffect(() => {
    if (edited) return
    const m = mentions.filter((t) => on[t]).join(' ')
    const h = hashtags.filter((t) => on[t]).join(' ')
    setBox([m, line?.text, h].filter(Boolean).join('\n'))
  }, [line, on, edited])

  // Restore the visitor's saved text once, after hydration (declared last so it wins over the rebuild above)
  useEffect(() => {
    const draft = getActivity().storyDrafts[post.id]
    if (draft === undefined) return
    setBox(draft)
    setEdited(true)
  }, [])

  async function copyAndOpen() {
    await copyText(box)
    if (line) updateActivity((a) => ({ ...a, usedLines: { ...a.usedLines, [line.id]: true } }))
    toast('Tags copied — opening the post…')
    window.open(post.url, '_blank', 'noopener')
  }

  function toggleShared() {
    updateActivity((a) => ({ ...a, shared: { ...a.shared, [post.id]: !a.shared[post.id] } }))
  }

  const Chip = ({ t }: { t: string }) => (
    <button
      onClick={() => setOn({ ...on, [t]: !on[t] })}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
        on[t] ? 'chip-on' : 'border-gold-200 bg-white/40 text-gold-500 line-through'
      }`}
    >
      {on[t] && <Check className="size-3.5" />}
      {t}
    </button>
  )

  return (
    <div className="glass rounded-3xl p-5 md:p-7 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-gold-800">Share to IG Story</h2>
          <p className="text-sm text-gold-700/80">Copy the tags, open the post, then share it to your story.</p>
        </div>
        {shared && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Shared ✓</span>}
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gold-600">@ Mentions</p>
        <div className="flex flex-wrap gap-2">{mentions.map((t) => <Chip key={t} t={t} />)}</div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-600">Short caption</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLang(lang === 'en' ? 'th' : 'en')
                discardDraft()
              }}
              className="rounded-full border border-gold-200 bg-white/50 px-3 py-1 text-xs text-gold-700"
            >
              {lang === 'en' ? 'EN → TH' : 'TH → EN'}
            </button>
            <button onClick={roll} className="inline-flex items-center gap-1 rounded-full btn-gold px-3 py-1 text-xs">
              <Dices className="size-3.5" /> Random
            </button>
            <button
              onClick={writeWithAi}
              disabled={writing}
              className="inline-flex items-center gap-1 rounded-full border border-gold-300 bg-white/70 px-3 py-1 text-xs text-gold-800 hover:bg-white disabled:opacity-60"
            >
              {writing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} AI write
            </button>
          </div>
        </div>
        <div className={`rounded-xl bg-white/60 border border-gold-200 px-4 py-2.5 text-sm ${lang === 'th' ? 'lang-th' : ''}`}>{line?.text ?? '—'}</div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gold-600"># Hashtags</p>
        <div className="flex flex-wrap gap-2">{hashtags.map((t) => <Chip key={t} t={t} />)}</div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-600">Tags to copy</p>
          {edited && (
            <span className="text-xs text-gold-600">
              Draft saved ·{' '}
              <button onClick={discardDraft} className="hover:text-gold-900 underline-offset-2 hover:underline">
                Reset to chips
              </button>
            </span>
          )}
        </div>
        <textarea
          value={box}
          onChange={(e) => {
            setBox(e.target.value)
            setEdited(true)
            saveDraft(e.target.value)
          }}
          rows={4}
          className="w-full rounded-2xl border border-dashed border-gold-300 bg-gold-50/60 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={copyAndOpen}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-rose-400 px-5 py-2.5 text-sm font-medium text-white shadow hover:brightness-105"
        >
          <ExternalLink className="size-4" /> Copy tags + open post
        </button>
        <button
          onClick={toggleShared}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow ${
            shared ? 'bg-white text-emerald-700 border border-emerald-300' : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          <Check className="size-4" /> {shared ? 'Shared — undo' : 'Mark as shared ✓'}
        </button>
      </div>

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gold-900/90 px-5 py-2.5 text-sm text-white shadow-lg">
          {flash}
        </div>
      )}
    </div>
  )
}
