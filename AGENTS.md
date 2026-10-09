# AGENTS.md

LISA ENGAGEMENT is a fan engagement hub built with TanStack Start, React 19, Tailwind CSS 4 and Vite 7, and deployed on Netlify.
**Continue from [PLAN.md](./PLAN.md).** Milestone 1 (the full UI) is done. Milestone 2 (shared storage + secure owner login) is next.

## Key directories
- `src/routes/`: file routes. `index.tsx` (Home), `posts/index.tsx` + `posts/$postId.tsx` (LISA & Brand), `media/index.tsx` + `media/$postId.tsx`, `tips.tsx`, `studio.tsx` (Owner Studio + password gate).
- `src/components/`: `ui.tsx` (shared primitives: StatGrid, PlatformTabs, CampaignPicker, GoalBar…), `CommentComposer.tsx`, `StorySharePanel.tsx`, `PostCard.tsx`, `PostNav.tsx`, `SiteChrome.tsx` (header/footer), `studio/*` (editors).
- `src/lib/`: `types.ts` (data model), `store.ts` (localStorage-backed store via useSyncExternalStore), `generator.ts` (comment/caption banks), `platform.ts` (metrics per platform, formatting, URL parsing), `filters.ts` (list search params + ordering).
- `src/data/fixtures.ts`: all sample content in one place. It becomes the DB seed in milestone 2.

## Non-obvious decisions
- `store.ts` is the only persistence boundary. Replace its internals with server functions and keep the hook names (`useSiteData`, `useActivity`, `updateData`, `updateActivity`) so the UI doesn't change.
- List pages keep campaign/platform/kind/tier in URL search params. Detail pages reuse the same `filterPosts` order, which makes "Back" return to the filtered list and makes next/previous follow it.
- Generator line ids encode style/lang/length/campaign/index (`g:…`), and owner lines use `u:<id>`. Copied ids go into `usedLines` and are skipped. The probe stride 7919 is coprime with every pool size, so every index is reachable.
- Metrics per platform: TikTok = views/likes/comments/saves/shares. IG Post = likes/comments/reposts/saves/shares. IG Reel = the IG Post set plus views.
- LISA/Brand goals are owner-set (`commentGoal`). Media goals use the post's own comment count.
- The Studio password is checked client-side against a SHA-256 hash for now. Move it server-side in milestone 2.
- Generated line text is created client-side in effects, which avoids SSR hydration mismatches from randomness.

## Conventions
PascalCase components, camelCase utils, `@/` alias for `src/`. Theme tokens (`gold-*`, `ivory`, `ink`, fonts) live in `src/styles.css` `@theme`. Use the `.glass`, `.btn-gold`, `.gold-text` and `.chip-on` utilities for the gold, translucent look. UI copy is in English, and generated lines come in TH/EN.
