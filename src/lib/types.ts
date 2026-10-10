export type Platform = 'tiktok' | 'ig-post' | 'ig-reel'
export type PostKind = 'lisa' | 'brand' | 'media'
export type Lang = 'en' | 'th'
export type LineLength = 'short' | 'medium' | 'long'
export type LineStyle = 'hype' | 'sweet' | 'concept' | 'fashion' | 'story'

export type Stats = {
  views?: number
  likes: number
  comments: number
  saves: number
  shares: number
  reposts?: number
}

export type Campaign = {
  id: string
  name: string
  brand: string
  season: string
  description: string
  hashtags: string[]
  mentions: string[]
}

export type Tier = {
  id: string
  name: string
  /** Each platform has its own tier list, set by the owner */
  platform: Platform
}

export type Post = {
  id: string
  kind: PostKind
  campaignId: string
  platform: Platform
  url: string
  /** Account that published the post, e.g. @lalalalisa_m or @voguemagazine */
  account: string
  title?: string
  caption: string
  /** Optional cover image; when empty the card shows a branded placeholder */
  thumbnail?: string
  stats: Stats
  /** Owner-defined comment goal (LISA & Brand posts). Media posts use stats.comments. */
  commentGoal?: number
  /** Comments the community has logged so far (stub until shared tracking ships) */
  communityComments: number
  tierId?: string
  postedAt: string
  /** When the live numbers were last read from the post link (set by the server, never stored) */
  syncedAt?: string
  /** Extra @ tags the story-share box should include for this post */
  extraMentions?: string[]
}

export type LineType = {
  id: string
  name: string
  description: string
  /** 'story' marks IG Story caption types; any other value is a comment type. Also picks the offline fallback bank. */
  style: LineStyle
}

export type CustomLine = {
  id: string
  typeId: string
  lang: Lang
  text: string
}

export type TipCategory = 'EMV' | 'MIV' | 'Like' | 'Share' | 'Comment' | 'Repost'

export type Tip = {
  id: string
  category: TipCategory
  title: string
  body: string
  link?: string
}

export type SiteSettings = {
  heroImage: string
  tagline: string
  credits: string
  lastSyncedAt: string
}

export type SiteData = {
  settings: SiteSettings
  campaigns: Campaign[]
  tiers: Tier[]
  posts: Post[]
  lineTypes: LineType[]
  customLines: CustomLine[]
  tips: Tip[]
}

export type Activity = {
  /** Comments this visitor has ticked per post */
  myComments: Record<string, number>
  /** Legacy "liked & engaged" tick per post id; no longer set */
  engaged: Record<string, boolean>
  /** Legacy story-share tick per post id; moved into `status` on load */
  shared: Record<string, boolean>
  /** "I commented" / "I shared to Stories" per post, keyed by `engageKey` so a post in both sections shares one status */
  status: Record<string, { commented?: boolean; shared?: boolean }>
  /** Generated / custom line ids that were already copied — never served again */
  usedLines: Record<string, true>
  /** IG Story "Tags to copy" text the visitor edited, per post */
  storyDrafts: Record<string, string>

  /** Line ids copied on each post, so clearing a post's history frees them again */
  postLines: Record<string, string[]>

  /** Where the visitor left off on each post (composer and story box), restored on return */
  drafts: Record<string, PostDraft>
}

export type ComposerDraft = {
  typeId: string
  lang: Lang
  length: LineLength
  mode: 'comment' | 'caption'
  target: Platform
  lineId?: string
  custom?: boolean
  text: string
  tagsOn: Record<string, boolean>
}

export type StoryDraft = {
  lang: Lang
  lineId?: string
  lineText?: string
  on: Record<string, boolean>
  box: string
  edited: boolean
}

export type PostDraft = { composer?: ComposerDraft; story?: StoryDraft }
