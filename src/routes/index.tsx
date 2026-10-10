import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Sparkles } from 'lucide-react'
import { CampaignPicker, PlatformIcon, StatGrid } from '@/components/ui'
import { SyncStatusBadge } from '@/components/SyncStatus'
import { formatNum, imageSrc, platformLabel, platforms, sumStats } from '@/lib/platform'
import { useSiteData } from '@/lib/store'

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): { campaign?: string } => ({
    campaign: typeof s.campaign === 'string' ? s.campaign : undefined,
  }),
  component: Home,
})

function Home() {
  const data = useSiteData()
  const { campaign: cid } = Route.useSearch()
  const navigate = Route.useNavigate()
  const campaign = data.campaigns.find((c) => c.id === cid) ?? data.campaigns[0]
  const posts = data.posts.filter((p) => p.campaignId === campaign?.id)
  const own = posts.filter((p) => p.kind !== 'media')
  const media = posts.filter((p) => p.kind === 'media')
  const { settings } = data

  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="pt-10 md:pt-16 text-center">
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-b from-gold-200/60 via-gold-100/30 to-transparent blur-2xl" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-gold-300/70 p-2 glass">
            {settings.heroImage ? (
              <img
                src={imageSrc(settings.heroImage, 900)}
                alt="LISA"
                className="h-full w-full rounded-[2rem] object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-gold-300 bg-gradient-to-br from-white/70 via-gold-50/70 to-gold-100/50 text-gold-600">
                <Sparkles className="size-8" strokeWidth={1.2} />
                <p className="font-display text-2xl text-gold-700">LISA photo</p>
                <p className="text-xs tracking-wide">Add it any time from Owner Studio</p>
              </div>
            )}
          </div>
        </div>
        <h1 className="mt-10 font-display text-5xl md:text-7xl font-semibold tracking-[0.12em] gold-text">LISA ENGAGEMENT</h1>
        <p className="mt-4 text-gold-800/80">{settings.tagline}</p>
        <div className="gold-rule w-48 mx-auto my-8" />
        <div className="mb-5 flex justify-center">
          <SyncStatusBadge />
        </div>
        <p className="mb-4 uppercase tracking-[0.35em] text-[11px] text-gold-600">Choose a campaign</p>
        <CampaignPicker
          campaigns={data.campaigns}
          value={campaign?.id}
          onChange={(id) => navigate({ search: { campaign: id }, replace: true, resetScroll: false })}
        />
      </section>

      {campaign && (
        <section className="mt-12 space-y-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold text-gold-800">{campaign.name} · Total engagement</h2>
            <p className="mt-1 text-sm text-gold-700/80">
              {campaign.description} · Last synced {new Date(settings.lastSyncedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {platforms.map((pl) => {
              const list = own.filter((p) => p.platform === pl)
              return (
                <div key={pl} className="glass rounded-3xl p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-gold-800">
                      <span className="grid size-8 place-items-center rounded-full bg-gold-100 text-gold-700">
                        <PlatformIcon platform={pl} />
                      </span>
                      {platformLabel[pl]}
                    </span>
                    <span className="text-xs text-gold-600">{list.length} posts</span>
                  </div>
                  <StatGrid platform={pl} stats={sumStats(list)} size="sm" />
                  <Link
                    to="/posts"
                    search={{ campaign: campaign.id, platform: pl }}
                    className="mt-4 inline-flex items-center gap-1 text-sm text-gold-700 hover:text-gold-900"
                  >
                    Engage these posts <ArrowRight className="size-4" />
                  </Link>
                </div>
              )
            })}
          </div>

          <Link to="/media" search={{ campaign: campaign.id }} className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 hover:border-gold-400">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold-600">Media coverage</p>
              <p className="font-display text-2xl font-semibold text-gold-800">{media.length} media posts about LISA</p>
            </div>
            <div className="flex gap-6 text-center">
              {(['likes', 'comments', 'shares'] as const).map((k) => (
                <div key={k}>
                  <div className="font-display text-2xl font-semibold text-gold-800">{formatNum(sumStats(media)[k])}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-gold-600">{k}</div>
                </div>
              ))}
            </div>
            <ArrowRight className="size-5 text-gold-600" />
          </Link>
        </section>
      )}
    </div>
  )
}
