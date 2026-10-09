# LISA ENGAGEMENT

A fan engagement hub for LISA. Visitors see live-looking engagement stats for every LISA, brand and media post. They grab ready-made comments and captions (TH/EN, 1,000+ non-repeating lines per type), copy story tags, and log what they've done. The site owner manages everything from a password-protected **Owner Studio** linked in the footer.

## Screens
- **Home**: LISA photo, campaign buttons, total engagement per platform
- **LISA & Brand Post**: per-post comment flow with goals, plus next / previous / back
- **Media Post**: media overview, tier filter, engage tick, random comments, IG Story share box
- **Engagement Tips**: EMV, MIV, likes, shares, comments, reposts
- **Owner Studio** (`/studio`): posts and links, campaigns and #/@ tags, tiers, comment types and lines, tips, home photo, backup

## Tech
TanStack Start (React 19, file-based routing) · Tailwind CSS 4 · Vite 7 · Netlify.

## Run locally
```bash
pnpm install
netlify dev   # or: pnpm dev
```

## Roadmap
Content and activity are stored per browser for now. Next up: shared storage on Netlify Database with a server-checked owner login, shared community comment counts, then auto-fill from link and scheduled live stats sync. See [PLAN.md](./PLAN.md).
