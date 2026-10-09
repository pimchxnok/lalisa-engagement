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
  /** Extra @ tags the story-share box should include for this post */
  extraMentions?: string[]
}

export type LineType = {
  id: string
  name: string
  description: string
  /** Which built-in phrase bank backs this type when custom lines run out */
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
  /** Media posts this visitor marked as engaged */
  engaged: Record<string, boolean>
  /** Media posts this visitor shared to story */
  shared: Record<string, boolean>
  /** Generated / custom line ids that were already copied — never served again */
  usedLines: Record<string, true>
  /** IG Story "Tags to copy" text the visitor edited, per post */
  storyDrafts: Record<string, string>
}
