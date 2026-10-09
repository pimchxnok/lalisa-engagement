# LISA ENGAGEMENT — Product Roadmap

## Milestone 1 — Product surface ✅
Branded gold/glass site with every screen clickable, running on the sample data in `src/data/fixtures.ts`:
- **Home**: LISA photo slot, campaign buttons, total engagement per platform (TikTok / IG Post / IG Reel).
- **LISA & Brand Post**: campaign + platform + LISA/Brand filters, post cards with stats and comment goals, a per-post comment flow (type → line → tags → copy / copy + open → "I commented ✓" → count, clear), Random, TH/EN, platform format, length, and previous / next / back-to-list.
- **Media Post**: season overview per platform, reviewed progress, tier filter (in tier order), per-post engage tick, random comments (no tags), IG Story share box (@ and # chips, short random caption, "Tags to copy", pink Copy tags + open post, green Mark as shared).
- **Engagement Tips**: EMV / MIV / Like / Share / Comment / Repost topics.
- **Owner Studio** (password gate): posts (paste a link to detect platform & account), campaigns and #/@ tags, renameable and reorderable tiers, editable comment types plus custom lines, tips, home photo, export / import backup.
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

## Milestone 4 — Auto-fill from link & live stats sync
- Pasting a link now reads an editable post title, caption and optional linked cover from TikTok oEmbed or public Instagram preview metadata. Preview retrieval is independent of the configured metrics service. Platforms can block public previews, and linked covers can expire; manual titles and optional uploads remain available. Media posts have no cover UI or cover retrieval.
- LISA & Brand cards and detail pages show only post comments against the owner-set goal, with muted ruby → champagne → jade progress colors. Media keeps its engagement and story-sharing flows without fan-comment goal bars.
- Studio deletion and restoring sample content now use in-page Confirm/Cancel controls rather than browser dialogs. Deleting a campaign or tier keeps its posts without that association; deleting a comment type removes its custom lines.
- A scheduled Netlify Function (every 15–30 min) refreshes views / likes / comments / saves / shares / reposts for every post. It also updates `lastSyncedAt`.
- Platform constraint: TikTok and Instagram do not offer public APIs for other accounts' full metrics. Saves and shares are only exposed to the post owner. Live numbers need a third-party data provider (e.g. an Apify / RapidAPI scraper actor), whose API key the owner adds as an environment variable. Any metric the provider can't return stays editable in the Studio.
- Media comment goals follow the synced comment count automatically.

## Milestone 5 — Content & polish
- The owner writes the real tips and adds real posts and photos.
- Thai UI option, share-ready OG image, analytics of community effort per campaign.
