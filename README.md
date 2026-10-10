/**
 * README.md — Updated for Milestone 4
 */

# LISA ENGAGEMENT

A fan engagement hub for LISA. Visitors see live-looking engagement stats for every LISA, brand and media post. They grab ready-made comments and captions (TH/EN, 1,000+ non-repeating lines per type).

Posts are fetched from SourceVine API every 30 minutes, so `lastSyncedAt` stays current. Media posts automatically use their synced comment counts as engagement targets. Private metrics (saves, reposts) that Instagram doesn't expose stay as owner-entered values.

## Screens
- **Home**: LISA photo, campaign buttons, total engagement per platform, "Last synced" badge
- **LISA & Brand Post**: per-post comment flow with goals, plus next / previous / back
- **Media Post**: media overview, tier filter, engage tick, random comments, IG Story share box, synced comment count
- **Engagement Tips**: EMV, MIV, likes, shares, comments, reposts
- **Owner Studio** (`/studio`): posts and links, campaigns and #/@ tags, tiers, comment types and lines, tips, home photo, backup. Manual sync all posts at once.

## Tech
TanStack Start (React 19, file-based routing) · Tailwind CSS 4 · Vite 7 · Netlify Functions · SourceVine API.

## Run locally
```bash
pnpm install
netlify dev   # or: pnpm dev
```

## Environment
Set `SOURCEVINE_API_KEY` in `.env.local` (Netlify dashboard for production).

## Milestone Status
- ✅ **Milestone 1**: Full UI with sample data
- ⏳ **Milestone 2**: Shared storage (Netlify Database) + secure owner login
- ⏳ **Milestone 3**: Shared community activity (global used-line registry, shared comment ticks)
- 🔄 **Milestone 4**: Auto-sync stats (IN PROGRESS)
  - ✅ Scheduled function (every 30 min)
  - ✅ SourceVine integration
  - ✅ Media goals follow synced comments
  - ✅ Public/private metrics separation
  - ✅ UI: "Last synced" badges
  - ✅ Manual sync in Owner Studio
- 🎯 **Milestone 5**: Real content, Thai UI, analytics

## Roadmap
See [PLAN.md](./PLAN.md) for full product roadmap and architecture notes.
