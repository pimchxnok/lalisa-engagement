/**
 * DEPLOYMENT.md
 * Guide to deploying Milestone 4 with full sync integration
 */

# Deployment Guide — Milestone 4

## Prerequisites

### 1. Netlify Account & Project
- Connect your GitHub repo to Netlify
- Ensure `netlify.toml` is configured (build command, publish dir)

### 2. SourceVine API Key
- Sign up at [SourceVine](https://sourcevine.io)
- Generate an API key for your account
- Store securely (never commit to Git)

### 3. Environment Setup

#### Local Development
Create `.env.local`:
```bash
SOURCEVINE_API_KEY=your_api_key_here
```

Test locally:
```bash
npm run dev
# Visit http://localhost:3000
# Go to Owner Studio, paste a link, click "Update numbers"
```

#### Netlify Production
1. Go to your Netlify site dashboard
2. **Site settings → Environment**
3. Add variable:
   - Key: `SOURCEVINE_API_KEY`
   - Value: Your SourceVine API key
4. Redeploy (or push to main branch)

## Features Ready to Deploy

### ✅ Scheduled Sync (Every 30 min)
- Function: `netlify/functions/sync-stats.ts`
- Runs: `0 */30 * * * *` (cron)
- Updates: post stats from SourceVine API
- Preserves: owner-entered values for private metrics (saves, reposts)

### ✅ Manual Sync (Owner Studio)
- Button: "Update numbers for all X posts"
- Endpoint: `/api/stats` (existing)
- Updates: `lastSyncedAt` after sync

### ✅ Sync Status Display
- Home page: "Last synced 2h ago" badge
- Detail pages: "Last synced X ago · 156 comments"
- Compact indicator: small dot on list pages

### ✅ Media Goals (Live)
- Media posts: comment goal = `stats.comments` (synced)
- LISA & Brand posts: goal = owner-defined `commentGoal`

## Next Steps (Milestone 2+)

### Database Integration
- Replace localStorage with Netlify Database
- Persist all data across sessions/users
- Query structure for sync-stats function

### Secure Owner Login
- Server-side password check (env variable)
- HTTP-only session cookie
- Protect write routes

### Shared Community Activity
- Global used-line registry
- Shared comment/engagement counts
- Per-user activity tracking

## Troubleshooting

### Sync not running
1. Check Netlify Functions logs (site dashboard → Functions)
2. Verify `SOURCEVINE_API_KEY` is set and valid
3. Check function path: `netlify/functions/sync-stats.ts`

### Stats not updating
1. Check `/api/stats` endpoint (paste a link in Studio)
2. Verify SourceVine API key has quota left
3. Check browser console for errors

### Private metrics overwritten
- Not possible with current logic
- saves/reposts only update if SourceVine provides them (rare for IG)

## Performance

- **80–150 posts**: ~2–3 minutes per full sync
- **Rate limit**: SourceVine ~100 requests/min
- **Scheduler**: Every 30 min = safe buffer

## Monitoring

Check sync health via Netlify Functions dashboard:
```
netlify/functions/sync-stats.ts logs → look for [sync] messages
```

Manual test:
```bash
curl -X POST http://localhost:3000/api/sync/manual \
  -H 'Content-Type: application/json' \
  -d '{"urls": ["https://www.instagram.com/p/xxx/"]}'
```
