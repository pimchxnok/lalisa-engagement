
import { index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

// ── Site content (edited from Owner Studio). `position` keeps the owner's order.

export const campaigns = pgTable('campaigns', {
  id: text().primaryKey(),
  position: integer().notNull().default(0),
  name: text().notNull(),
  brand: text().notNull().default(''),
  season: text().notNull().default(''),
  description: text().notNull().default(''),
  hashtags: jsonb().$type<string[]>().notNull().default([]),
  mentions: jsonb().$type<string[]>().notNull().default([]),
})

export const tiers = pgTable('tiers', {
  id: text().primaryKey(),
  position: integer().notNull().default(0),
  name: text().notNull(),
})

export const posts = pgTable('posts', {
  id: text().primaryKey(),
  position: integer().notNull().default(0),
  kind: text().notNull(),
  campaignId: text('campaign_id').notNull().default(''),
  platform: text().notNull(),
  url: text().notNull().default(''),
  account: text().notNull().default(''),
  title: text(),
  caption: text().notNull().default(''),
  thumbnail: text(),
  stats: jsonb().$type<Record<string, number>>().notNull(),
  commentGoal: integer('comment_goal'),
  tierId: text('tier_id'),
  postedAt: text('posted_at').notNull().default(''),
  extraMentions: jsonb('extra_mentions').$type<string[]>(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
})

export const lineTypes = pgTable('line_types', {
  id: text().primaryKey(),
  position: integer().notNull().default(0),
  name: text().notNull(),
  definition: text().notNull().default(''),
})

export const customLines = pgTable('custom_lines', {
  id: text().primaryKey(),
  position: integer().notNull().default(0),
  typeId: text('type_id').notNull(),
  lang: text().notNull(),
  text: text().notNull(),
})

export const tips = pgTable('tips', {
  id: text().primaryKey(),
  position: integer().notNull().default(0),
  category: text().notNull(),
  title: text().notNull(),
  body: text().notNull().default(''),
  link: text(),
})

/** Single row (id = 1) */
export const settings = pgTable('settings', {
  id: integer().primaryKey(),
  heroImage: text('hero_image').notNull().default(''),
  tagline: text().notNull().default(''),
  credits: text().notNull().default(''),
  lastSyncedAt: text('last_synced_at').notNull().default(''),
})

// ── Shared fan activity

/** "I commented ✓" ticks, one row per visitor and post */
export const commentTicks = pgTable(
  'comment_ticks',
  {
    postId: text('post_id').notNull(),
    visitorId: text('visitor_id').notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.visitorId] })],
)

/** Media "engaged" / "shared to story" marks */
export const postMarks = pgTable(
  'post_marks',
  {
    postId: text('post_id').notNull(),
    visitorId: text('visitor_id').notNull(),
    kind: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.visitorId, t.kind] })],
)

/** Lines copied by anyone — never served again */
export const usedLines = pgTable('used_lines', {
  lineId: text('line_id').primaryKey(),
  usedAt: timestamp('used_at', { withTimezone: true }).defaultNow().notNull(),
})

/** Login and AI request timestamps for per-IP rate limits */
export const rateEvents = pgTable(
  'rate_events',
  {
    id: serial().primaryKey(),
    scope: text().notNull(),
    key: text().notNull(),
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('rate_events_lookup').on(t.scope, t.key, t.at)],
)

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

/** Built-in comment styles the owner defines in Studio: a topic, its keywords, a prompt and how many lines to keep ready */
export const commentStyles = pgTable('comment_styles', {
  id: text().primaryKey(),
  position: integer().notNull().default(0),
  name: text().notNull(),
  keywords: jsonb().$type<string[]>().notNull().default([]),
  prompt: text().notNull().default(''),
  /** Lines to keep in the bank for each language and length */
  bankSize: integer('bank_size').notNull().default(50),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Pre-written lines for each style, language and length. Random draws from here instead of writing new lines. */
export const styleLines = pgTable(
  'style_lines',
  {
    id: serial().primaryKey(),
    styleId: text('style_id').notNull(),
    lang: text().notNull(),
    length: text().notNull(),
    text: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('style_lines_unique').on(t.styleId, t.lang, t.length, t.text)],
)
