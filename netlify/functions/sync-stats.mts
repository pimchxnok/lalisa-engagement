import type { Config } from '@netlify/functions'
import { syncStale } from '../../src/lib/liveContent.server'

// Keeps numbers fresh even when nobody has the site open
export default async () => {
  const refreshed = await syncStale({ maxAgeMs: 4 * 60 * 1000, budgetMs: 22_000 })
  console.log(`Refreshed live numbers for ${refreshed} posts`)
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
