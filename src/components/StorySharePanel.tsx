import { Check, ChevronDown, Copy, Dices, ExternalLink, Loader2, Send, Sparkles } from 'lucide-react'

import { useEffect, useMemo, useState } from 'react'
import { requestAiLine } from '@/lib/aiLine'
import { pickLine, type PickedLine } from '@/lib/generator'
import { engageStatus } from '@/lib/engagement'
import { copyText } from '@/lib/platform'
import { getActivity, updateActivity, useActivity, useSiteData } from '@/lib/store'
import type { Campaign, Lang, Post } from '@/lib/types'

const steps = [
  { n: 1, title: 'Copy caption + open post', body: 'One tap copies your story caption and opens the post in Instagram.' },
  { n: 2, title: 'Tap ✈️ → Add to story', body: 'Use the paper-plane share button under the post.' },
  { n: 3, title: 'Paste & post', body: 'Long-press the story, paste the caption, then share.' },
]

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
  const [showTags, setShowTags] = useState(false)
  const [opened, setOpened] = useState(false)
  const [flash, setFlash] = useState('')
  const [writing, setWriting] = useState(false)
  const shared = engageStatus(activity, post).shared

  function toast(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 2600)
  }

  function pick() {
    if (!storyType) return null
    return pickLine({ type: storyType, lang, length: 'short', campaign, customLines: data.customLines, used: getActivity().usedLines, exclude: line?.id })
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
      const next = await requestAiLine({
        mode: 'story',
        lang,
        length: 'short',
        typeName: storyType.name,
        typeDescription: storyType.description,
        platform: post.platform,
        campaign,
        postCaption: post.caption.slice(0, 600),
        avoid: line ? [line.text] : [],
      })
      setLine(next)
      discardDraft()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The AI writer is busy — try again.')
    } finally {
      setWriting(false)
    }
  }

  useEffect(() => setLine(pick()), [post.id, lang])
  useEffect(() => {
    setOn(Object.fromEntries([...mentions, ...hashtags].map((t) => [t, true])))
    setOpened(false)
  }, [post.id])

  // Rebuild the caption from the line + selected chips unless the visitor typed in it
  useEffect(() => {
    if (edited) return
    const m = mentions.filter((t) => on[t]).join(' ')
    const h = hashtags.filter((t) => on[t]).join(' ')
    setBox([line?.text, m, h].filter(Boolean).join('\n'))
  }, [line, on, edited])

  // Restore the visitor's saved text after hydration. Runs after the rebuild above so the draft wins.
  useEffect(() => {
    const draft = getActivity().storyDrafts[post.id]
    if (draft === undefined) return
    setBox(draft)
    setEdited(true)
  }, [post.id])

  async function copy(open: boolean) {
    // Start the copy inside the tap, then open the post before the browser drops the gesture
    const copied = copyText(box)
    if (open) window.open(post.url, '_blank', 'noopener')
    await copied
    if (line) updateActivity((a) => ({ ...a, usedLines: { ...a.usedLines, [line.id]: true } }))
    if (open) setOpened(true)
    toast(open ? 'Caption copied — tap ✈️ → Add to story, then paste' : 'Caption copied')
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
          <p className="text-sm text-gold-700/80">Your caption is ready — copy it, share the post to your story and paste.</p>
        </div>
        {shared && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Shared ✓</span>}
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3 rounded-2xl border border-gold-200/70 bg-white/50 p-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gradient-to-r from-pink-400 to-rose-400 text-xs font-semibold text-white">{s.n}</span>
            <span>
              <span className="block text-sm font-medium text-gold-900">{s.title}</span>
              <span className="block text-xs text-gold-700/80">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-600">Story caption</p>
          <div className="flex flex-wrap gap-2">
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
          className={`w-full rounded-2xl border border-dashed border-gold-300 bg-gold-50/60 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300 ${lang === 'th' ? 'lang-th' : ''}`}
        />
        <button onClick={() => setShowTags(!showTags)} className="mt-1 inline-flex items-center gap-1 text-xs text-gold-600 hover:text-gold-900">
          <ChevronDown className={`size-3.5 transition-transform ${showTags ? 'rotate-180' : ''}`} />
          {showTags ? 'Hide tags' : `Choose @ and # tags (${[...mentions, ...hashtags].filter((t) => on[t]).length} on)`}
        </button>
        {showTags && (
          <div className="mt-3 space-y-3 rounded-2xl border border-gold-200/70 bg-white/40 p-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gold-600">@ Mentions</p>
              <div className="flex flex-wrap gap-2">{mentions.map((t) => <Chip key={t} t={t} />)}</div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gold-600"># Hashtags</p>
              <div className="flex flex-wrap gap-2">{hashtags.map((t) => <Chip key={t} t={t} />)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          onClick={() => copy(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-rose-400 px-6 py-3 text-sm font-semibold text-white shadow hover:brightness-105"
        >
          <Send className="size-4" /> Copy caption + open post
        </button>
        <button
          onClick={() => copy(false)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-300 bg-white/60 px-5 py-3 text-sm text-gold-800 hover:border-gold-400"
        >
          <Copy className="size-4" /> Copy caption only
        </button>
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-300 bg-white/60 px-5 py-3 text-sm text-gold-800 hover:border-gold-400"
        >
          <ExternalLink className="size-4" /> Open post only
        </a>
      </div>

      {opened && !shared && (
        <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          Back from Instagram? Tap <b>I shared to Stories</b> at the bottom of the page.
        </p>
      )}

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gold-900/90 px-5 py-2.5 text-sm text-white shadow-lg">
          {flash}
        </div>
      )}
    </div>
  )
}
