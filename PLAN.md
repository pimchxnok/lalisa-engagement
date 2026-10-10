/**
 * PLAN.md - Updated for Milestone 4
 */

# LISA ENGAGEMENT — Product Roadmap

## Milestone 1 — Product surface ✅
Branded gold/glass site with every screen clickable, running on the sample data in `src/data/fixtures.ts`:
- **Home**: LISA photo slot, campaign buttons, total engagement per platform (TikTok / IG Post / IG Reel).
- **LISA & Brand Post**: campaign + platform + LISA/Brand filters, post cards with stats and comment goals, a per-post comment flow (type → line → tags → copy / copy + open → "I commented ✓").
- **Media Post**: season overview per platform, reviewed progress, tier filter (in tier order), per-post engage tick, random comments (no tags), IG Story share box (@ and # chips, short random caption).
- **Engagement Tips**: EMV / MIV / Like / Share / Comment / Repost topics.
- **Owner Studio** (password gate): posts (paste a link to detect platform & account), campaigns and #/@ tags, renameable and reorderable tiers, editable comment types plus custom lines, tips, home photo.
- Generator: 1,000+ unique lines per type × language × length. Copied lines are never served again.

Right now, edits and visitor activity are saved in each browser's localStorage.

## Milestone 2 — Shared storage & secure owner login
- Netlify Database (Drizzle) tables: campaigns, tiers, posts, line_types, custom_lines, tips, settings.
- Seed from `fixtures.ts`. Swap `src/lib/store.ts` for server functions and loaders.
- Check the owner password on the server (hash in an environment variable), using an HTTP-only session cookie. All write routes check that session.
- Import the Studio's exported JSON so the owner's work so far carries over.

## Milestone 3 — Shared community activity
- Comment tick events per post, so every visitor sees one shared "fans commented" count. Clearing removes only your own.
- A global used-line registry, so a line copied by anyone is never served to anyone again.
- Shared engaged/shared counters for Media "Reviewed progress".

## Milestone 4 — Auto-sync stats (IN PROGRESS) 🔄
- **Scheduled Netlify Function** (every 30 min): fetches latest metrics from SourceVine for all posts with URLs.
- **Public metrics** (auto-updated): views, likes, comments, shares.
- **Private metrics** (owner-entered, never overwritten): saves, reposts (IG doesn't expose these publicly).
- **Media comment goal**: automatically uses synced `stats.comments` as the live engagement target.
- **lastSyncedAt**: timestamp updates after each successful sync; shown on Home + detail pages.
- **UI indicators**: "Last synced 2h ago" badge on Home, sync time on detail pages.
- Stats sync works reliably with 80–150 posts; manual "Update all" in Owner Studio also available.
- SourceVine API integration ready; missing private metrics don't block sync.

## Milestone 5 — Content & polish
- The owner writes the real tips and adds real posts and photos.
- Thai UI option, share-ready OG image, analytics of community effort per campaign.
