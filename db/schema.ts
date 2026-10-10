import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** The owner's published site content (campaigns, tiers, posts, comment types, tips, settings) as one document */
export const siteContent = pgTable('site_content', {
  id: text().primaryKey(),
  data: jsonb().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Live numbers, caption and cover read from each post's link. Kept apart from site_content so syncing never overwrites owner edits. */
export const postLive = pgTable('post_live', {
  postId: text('post_id').primaryKey(),
  url: text().notNull(),
  stats: jsonb().notNull().default({}),
  caption: text(),
  thumbnail: text(),
  error: text(),
  /** When this post was last claimed for a refresh; used to spread work and avoid duplicate fetches */
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  metaSyncedAt: timestamp('meta_synced_at', { withTimezone: true }),
})
