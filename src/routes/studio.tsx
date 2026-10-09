import { createFileRoute } from '@tanstack/react-router'
import { KeyRound, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CampaignsEditor, LineTypesEditor, SiteEditor, TiersEditor, TipsEditor } from '@/components/studio/ContentEditors'
import { inputCls } from '@/components/studio/fields'
import { PostsEditor } from '@/components/studio/PostsEditor'
import { SectionTitle } from '@/components/ui'
import { isOwnerPassword, SESSION_KEY, SESSION_PW_KEY } from '@/lib/owner'

export const Route = createFileRoute('/studio')({
  head: () => ({ meta: [{ title: 'Owner Studio · LISA ENGAGEMENT' }, { name: 'robots', content: 'noindex' }] }),
  component: StudioPage,
})


const tabs = [
  { id: 'posts', label: 'Posts', el: <PostsEditor /> },
  { id: 'campaigns', label: 'Campaigns & Tags', el: <CampaignsEditor /> },
  { id: 'tiers', label: 'Media Tiers', el: <TiersEditor /> },
  { id: 'types', label: 'Comment Types', el: <LineTypesEditor /> },
  { id: 'tips', label: 'Engagement Tips', el: <TipsEditor /> },
  { id: 'site', label: 'Home & Backup', el: <SiteEditor /> },
]

function StudioPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [tab, setTab] = useState('posts')

  useEffect(() => setUnlocked(sessionStorage.getItem(SESSION_KEY) === '1' && !!sessionStorage.getItem(SESSION_PW_KEY)), [])

  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />

  return (
    <div className="mx-auto max-w-5xl px-5 pt-12">
      <SectionTitle eyebrow="For the site owner" title="Owner Studio">
        Add posts and links, manage campaigns and tags, tiers, comment types and tips.
      </SectionTitle>
      <p className="mb-6 rounded-2xl border border-gold-300 bg-gold-50/80 px-4 py-3 text-center text-sm text-gold-800">
        Changes save instantly in this browser and appear on the site here. Publishing them for every visitor arrives with shared storage — use <b>Home &amp; Backup → Export</b> to keep a copy.
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm ${tab === t.id ? 'btn-gold' : 'glass text-gold-800'}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEY)
            sessionStorage.removeItem(SESSION_PW_KEY)
            setUnlocked(false)
          }}
          className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs text-gold-600 hover:text-gold-900"
        >
          <LogOut className="size-3.5" /> Lock
        </button>
      </div>
      {tabs.find((t) => t.id === tab)?.el}
    </div>
  )
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (await isOwnerPassword(pw)) {
      sessionStorage.setItem(SESSION_KEY, '1')
      sessionStorage.setItem(SESSION_PW_KEY, pw)
      onUnlock()
    } else {
      setError(true)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 pt-20">
      <form onSubmit={submit} className="glass rounded-3xl p-8 text-center space-y-4">
        <span className="mx-auto grid size-14 place-items-center rounded-full btn-gold">
          <KeyRound className="size-6" />
        </span>
        <h1 className="font-display text-3xl font-semibold gold-text">Owner Studio</h1>
        <p className="text-sm text-gold-700/80">Enter the owner password to edit the site.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value)
            setError(false)
          }}
          placeholder="Password"
          className={`${inputCls} text-center tracking-[0.4em]`}
        />
        {error && <p className="text-sm text-rose-600">That password isn’t right.</p>}
        <button type="submit" className="btn-gold w-full rounded-full py-2.5 text-sm font-medium">
          Unlock
        </button>
      </form>
    </div>
  )
}
