import {
  Check,
  Copy,
  Dices,
  ExternalLink,
  Loader2,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { requestAiLine } from '@/lib/aiLine'
import { formatForPlatform, platformLimits, type PickedLine } from '@/lib/generator'
import { nextLine } from '@/lib/lineWriter'
import { copyText } from '@/lib/platform'
import { getActivity, markLineUsed, saveDraft, useSiteData } from '@/lib/store'
import { Segmented } from '@/components/ui'
import { allowedLength, langLabel, langsFor, lengthLabel, lengthsFor, setIsOn, typesFor, useStyles, useStylesSettled } from '@/lib/styles'
import type { Campaign, Lang, LineLength, Platform, Post } from '@/lib/types'

type Mode = 'comment' | 'caption'

/**
 * Render with `key={post.id}` so each post starts from its own saved draft.
 * "I commented" lives in the page's bottom status bar; bump `rollSignal` from there to draw a fresh line.
 */
export function CommentComposer({ post, campaign, allowCaption, rollSignal = 0 }: { post: Post; campaign?: Campaign; allowCaption: boolean; rollSignal?: number }) {
  const data = useSiteData()
  const styles = useStyles()
  const settled = useStylesSettled()

  const [typeId, setTypeId] = useState('')
  const [langPick, setLang] = useState<Lang>('en')
  const [lengthPick, setLength] = useState<LineLength>('medium')
  const [mode, setMode] = useState<Mode>('comment')
  const [target, setTarget] = useState<Platform>(post.platform)
  const [line, setLine] = useState<PickedLine | null>(null)
  const [text, setText] = useState('')
  const [tagsOn, setTagsOn] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [writing, setWriting] = useState(false)

  // Only the languages, types and lengths the owner turned on for "Write a comment" in Owner Studio
  const langs = langsFor(data.lineTypes, styles, 'comment')
  const lang = langs.includes(langPick) ? langPick : langs[0]
  const types = typesFor(data.lineTypes, styles, 'comment', lang)
  const type = types.find((t) => t.id === typeId) ?? types[0]
  const lengths = lengthsFor(styles, type?.style, 'comment', lang)
  const wanted = allowedLength('comment', lengthPick)
  const length = lengths.includes(wanted) ? wanted : lengths[lengths.length - 1]
  const strict = setIsOn(styles, type?.style, { system: 'comment', lang, length })
  const allTags = useMemo(() => [...(campaign?.hashtags ?? []), ...(campaign?.mentions ?? [])], [campaign])

  const recipe = [type?.id, lang, length].join('|')
  const restored = useRef(false)
  const lastRecipe = useRef('')
  const request = useRef(0)

  async function roll() {
    if (!type || !settled) return
    const n = ++request.current
    lastRecipe.current = recipe
    setBusy(true)
    const next = await nextLine({ type, lang, length, post, campaign, customLines: data.customLines, used: getActivity().usedLines, exclude: line?.id, strict })
    if (n !== request.current) return
    setBusy(false)
    setLine(next)
    setText(next?.text ?? '')
  }

  async function writeWithAi() {
    if (!type || writing) return
    setWriting(true)
    try {
      const next = await requestAiLine({
        mode: 'comment',
        lang,
        length,
        typeName: type.name,
        typeDescription: type.description,
        platform: target,
        campaign,
        postCaption: post.caption.slice(0, 600),
        avoid: line ? [line.text] : [],
      })
      setLine(next)
      setText(next.text)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The AI writer is busy — try again.')
    } finally {
      setWriting(false)
    }
  }

  // Restore the saved draft once the set configuration is known; otherwise draw a new line when the recipe changes
  useEffect(() => {
    if (!settled) return
    if (!restored.current) {
      restored.current = true
      const d = getActivity().drafts[post.id]?.composer
      const draftLength = d && allowedLength('comment', d.length)
      const draftType = d && langs.includes(d.lang) ? typesFor(data.lineTypes, styles, 'comment', d.lang).find((t) => t.id === d.typeId) : undefined
      // Only drafts that still match a turned-on type and length come back; anything else starts fresh
      if (d && draftLength && draftType && lengthsFor(styles, draftType.style, 'comment', d.lang).includes(draftLength)) {
        setTypeId(d.typeId)
        setLang(d.lang)
        setLength(draftLength)
        setMode(allowCaption ? d.mode : 'comment')
        setTarget(d.target)
        setTagsOn(d.tagsOn)
        setLine(d.lineId ? { id: d.lineId, text: d.text, custom: !!d.custom } : null)
        setText(d.text)
        lastRecipe.current = [d.typeId, d.lang, draftLength].join('|')
        return
      }
    }

    if (recipe !== lastRecipe.current) void roll()
  }, [recipe, settled])

  // A logged comment means this line is spent, so offer the next one
  useEffect(() => {
    if (rollSignal > 0) void roll()
  }, [rollSignal])

  useEffect(() => {
    if (!restored.current || busy) return
    saveDraft(post.id, { composer: { typeId: type?.id ?? '', lang, length, mode, target, lineId: line?.id, custom: line?.custom, text, tagsOn } })
  }, [type?.id, lang, length, mode, target, line, text, tagsOn, busy])

  const tags = mode === 'caption' ? allTags.filter((t) => tagsOn[t] !== false) : []
  const finalText = formatForPlatform(text, tags, target)
  const limit = platformLimits[target]

  function toast(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 1800)
  }

  async function copy(open: boolean) {
    await copyText(finalText)
    if (line) markLineUsed(post.id, line.id)
    toast(open ? 'Copied — opening the post…' : 'Copied to clipboard')
    if (open) window.open(post.url, '_blank', 'noopener')
  }

  return (
    <div className="glass rounded-3xl p-5 md:p-7 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-2xl font-semibold text-gold-800">Write a comment</h2>
        {allowCaption && (
          <div className="inline-flex rounded-full bg-white/60 border border-gold-200 p-1 text-sm">
            {(['comment', 'caption'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-1.5 capitalize ${mode === m ? 'btn-gold' : 'text-gold-700'}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <Step n={1} title="Choose a type">
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeId(t.id)}
              title={t.description}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                t.id === type?.id ? 'chip-on' : 'border-gold-200 bg-white/50 text-gold-700 hover:border-gold-400'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        {!types.length && <p className="text-sm text-gold-600">{settled ? 'No comment types are turned on yet.' : 'Loading types…'}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Segmented label="Language" value={lang} options={langs.map((id) => ({ id, label: langLabel[id] }))} onChange={setLang} />
          <Segmented label="Length" value={length} options={lengths.map((id) => ({ id, label: lengthLabel[id] }))} onChange={setLength} />
          <button
            onClick={() => setTarget(target === 'tiktok' ? 'ig-post' : 'tiktok')}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold-200 bg-white/50 px-3 py-1 text-gold-700 hover:border-gold-400"
          >
            <Smartphone className="size-4" /> {target === 'tiktok' ? 'TikTok format' : 'Instagram format'}
          </button>
        </div>
      </Step>

      <Step n={2} title="Your line">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className={`w-full rounded-2xl border border-gold-200 bg-white/70 p-4 pr-28 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold-300 ${lang === 'th' ? 'lang-th' : ''}`}
            placeholder={
              busy || !settled
                ? 'Writing a line for this post…'
                : strict
                  ? 'Every line in this set has been used — the owner can build more in Owner Studio.'
                  : 'All lines of this type have been used — add more in Owner Studio.'
            }
          />
          <div className="absolute right-3 top-3 flex flex-col items-stretch gap-1.5">
            <button
              onClick={() => void roll()}
              disabled={writing}
              className="inline-flex items-center gap-1.5 rounded-full btn-gold px-3 py-1.5 text-sm disabled:opacity-60"
            >
              <Dices className="size-4" /> Random
            </button>
            <button
              onClick={writeWithAi}
              disabled={writing}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-white/80 px-3 py-1.5 text-sm text-gold-800 hover:bg-white disabled:opacity-60"
            >
              {writing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              AI write
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gold-600">
          {line?.custom
            ? 'Written by the site owner · '
            : line?.id.startsWith('a:')
              ? 'Written by AI just for you · '
              : ''}
          Copied lines never appear again for anyone using this device.
        </p>
      </Step>

      {mode === 'caption' && (
        <Step n={3} title="Add tags?">
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setTagsOn({ ...tagsOn, [t]: tagsOn[t] === false })}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
                  tagsOn[t] !== false ? 'chip-on' : 'border-gold-200 bg-white/40 text-gold-500 line-through'
                }`}
              >
                {tagsOn[t] !== false && <Check className="size-3.5" />}
                {t}
              </button>
            ))}
          </div>
        </Step>
      )}

      <Step n={mode === 'caption' ? 4 : 3} title="Copy & comment">
        <div className={`rounded-2xl border border-dashed border-gold-300 bg-gold-50/60 p-4 whitespace-pre-wrap text-sm ${lang === 'th' ? 'lang-th' : ''}`}>
          {finalText || '—'}
        </div>
        <div className={`mt-1 text-right text-xs ${finalText.length > limit ? 'text-rose-600' : 'text-gold-600'}`}>
          {finalText.length}/{limit} characters {finalText.length > limit && '· too long for TikTok, try Short'}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => copy(true)} className="inline-flex items-center gap-2 rounded-full btn-gold px-5 py-2.5 text-sm font-medium">
            <ExternalLink className="size-4" /> Copy + Open post
          </button>
          <button
            onClick={() => copy(false)}
            className="inline-flex items-center gap-2 rounded-full border border-gold-300 bg-white/70 px-5 py-2.5 text-sm text-gold-800 hover:bg-white"
          >
            <Copy className="size-4" /> Copy only
          </button>
        </div>
        <p className="mt-2 text-xs text-gold-600">Posted it? Tap <b>I commented</b> at the bottom of the page to save your progress.</p>
      </Step>

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gold-900/90 px-5 py-2.5 text-sm text-white shadow-lg">
          {flash}
        </div>
      )}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-medium text-gold-800">
        <span className="grid size-6 place-items-center rounded-full bg-gold-100 text-xs text-gold-700 border border-gold-300">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}
