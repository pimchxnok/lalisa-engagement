/**
 * Sample content for the first look at LISA ENGAGEMENT.
 * Everything here is placeholder data the owner replaces from Owner Studio.
 * When shared storage and stat syncing land (see PLAN.md), this module
 * becomes the seed for the database instead of the live source.
 */
import type { Campaign, LineType, Post, SiteData, Tier, Tip } from '@/lib/types'

const campaigns: Campaign[] = [
  {
    id: 'lvss27',
    name: 'LV SS27',
    brand: 'Louis Vuitton',
    season: 'Spring/Summer 2027',
    description: 'Louis Vuitton Women’s Spring/Summer 2027 show & campaign.',
    hashtags: ['#LISAxLouisVuitton', '#LVSS27', '#LouisVuitton', '#LISA'],
    mentions: ['@lalalalisa_m', '@louisvuitton', '@nicolasghesquiere'],
  },
  {
    id: 'bvlgari',
    name: 'BVLGARI',
    brand: 'Bulgari',
    season: 'High Jewelry 2026',
    description: 'Bulgari high jewelry campaign & event coverage.',
    hashtags: ['#LISAxBVLGARI', '#Bulgari', '#BulgariHighJewelry', '#LISA'],
    mentions: ['@lalalalisa_m', '@bulgari'],
  },
  {
    id: 'lisa-solo',
    name: 'LISA Solo',
    brand: 'LLOUD',
    season: 'Solo Era',
    description: 'LISA’s own releases, lives and personal posts.',
    hashtags: ['#LISA', '#LALISA', '#LLOUD'],
    mentions: ['@lalalalisa_m', '@wearelloud'],
  },
]

const tiers: Tier[] = [
  { id: 't1', name: 'Tier 1 · Global' },
  { id: 't2', name: 'Tier 2 · Regional' },
  { id: 't3', name: 'Tier 3 · Fan & Local' },
]

let n = 0
function post(p: Omit<Post, 'id' | 'caption' | 'postedAt' | 'communityComments'> & Partial<Post>): Post {
  n += 1
  return {
    id: `p${n}`,
    caption: '',
    postedAt: `2026-10-0${(n % 8) + 1}`,
    communityComments: Math.round((p.commentGoal ?? p.stats.comments) * 0.37),
    ...p,
  }
}

const posts: Post[] = [
  // ── LV SS27 · LISA & Brand
  post({ kind: 'lisa', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-LV-1/', account: '@lalalalisa_m', caption: 'Paris, front row 🤍 #LouisVuitton', stats: { likes: 8_420_311, comments: 61_204, reposts: 12_880, saves: 210_430, shares: 98_120 }, commentGoal: 100_000 }),
  post({ kind: 'lisa', campaignId: 'lvss27', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-LV-2/', account: '@lalalalisa_m', caption: 'Getting ready for the show ✨', stats: { views: 41_200_550, likes: 6_120_004, comments: 48_330, reposts: 22_410, saves: 160_120, shares: 301_550 }, commentGoal: 80_000 }),
  post({ kind: 'lisa', campaignId: 'lvss27', platform: 'tiktok', url: 'https://www.tiktok.com/@lalalalisa_m/video/0000000000000000001', account: '@lalalalisa_m', caption: 'LV day 🖤', stats: { views: 28_440_100, likes: 4_210_330, comments: 39_120, saves: 302_100, shares: 120_880 }, commentGoal: 60_000 }),
  post({ kind: 'brand', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-LV-3/', account: '@louisvuitton', caption: 'House Ambassador LISA at the Women’s Spring-Summer 2027 Show.', stats: { likes: 2_310_220, comments: 18_442, reposts: 6_100, saves: 44_310, shares: 31_090 }, commentGoal: 30_000 }),
  post({ kind: 'brand', campaignId: 'lvss27', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-LV-4/', account: '@louisvuitton', caption: 'Arrivals — LISA. #LVSS27', stats: { views: 12_880_400, likes: 1_904_110, comments: 14_220, reposts: 8_330, saves: 51_200, shares: 72_400 }, commentGoal: 25_000 }),
  post({ kind: 'brand', campaignId: 'lvss27', platform: 'tiktok', url: 'https://www.tiktok.com/@louisvuitton/video/0000000000000000002', account: '@louisvuitton', caption: 'LISA in Paris', stats: { views: 9_120_000, likes: 1_240_330, comments: 11_940, saves: 88_120, shares: 40_330 }, commentGoal: 20_000 }),

  // ── BVLGARI · LISA & Brand
  post({ kind: 'lisa', campaignId: 'bvlgari', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-BV-1/', account: '@lalalalisa_m', caption: 'Serpenti 🐍💎', stats: { likes: 7_904_220, comments: 55_310, reposts: 9_920, saves: 180_400, shares: 77_310 }, commentGoal: 90_000 }),
  post({ kind: 'lisa', campaignId: 'bvlgari', platform: 'tiktok', url: 'https://www.tiktok.com/@lalalalisa_m/video/0000000000000000003', account: '@lalalalisa_m', caption: 'Rome nights', stats: { views: 19_880_000, likes: 3_330_120, comments: 28_400, saves: 210_330, shares: 90_120 }, commentGoal: 50_000 }),
  post({ kind: 'brand', campaignId: 'bvlgari', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-BV-2/', account: '@bulgari', caption: 'LISA wears Bulgari High Jewelry.', stats: { views: 8_440_220, likes: 1_120_400, comments: 9_870, reposts: 4_210, saves: 33_100, shares: 28_440 }, commentGoal: 20_000 }),

  // ── LISA Solo
  post({ kind: 'lisa', campaignId: 'lisa-solo', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-SOLO-1/', account: '@lalalalisa_m', caption: 'New era 🌙', stats: { views: 52_100_000, likes: 7_440_100, comments: 72_330, reposts: 30_120, saves: 240_880, shares: 410_220 }, commentGoal: 120_000 }),
  post({ kind: 'lisa', campaignId: 'lisa-solo', platform: 'tiktok', url: 'https://www.tiktok.com/@lalalalisa_m/video/0000000000000000004', account: '@lalalalisa_m', caption: 'dance challenge 💃', stats: { views: 64_300_000, likes: 9_210_440, comments: 81_220, saves: 520_100, shares: 330_400 }, commentGoal: 120_000 }),

  // ── Media · LV SS27
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-1/', account: '@voguemagazine', caption: 'LISA arrives at Louis Vuitton SS27.', tierId: 't1', stats: { likes: 610_220, comments: 4_120, reposts: 1_320, saves: 9_880, shares: 12_440 }, extraMentions: ['@voguemagazine'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-M-2/', account: '@wwd', caption: 'Front row at LV: LISA.', tierId: 't1', stats: { views: 3_220_100, likes: 402_330, comments: 2_880, reposts: 1_120, saves: 6_330, shares: 9_910 }, extraMentions: ['@wwd'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-3/', account: '@harpersbazaarus', caption: 'Best dressed at Paris Fashion Week.', tierId: 't1', stats: { likes: 288_440, comments: 1_930, reposts: 640, saves: 4_120, shares: 5_330 }, extraMentions: ['@harpersbazaarus'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'tiktok', url: 'https://www.tiktok.com/@elleusa/video/0000000000000000005', account: '@elleusa', caption: 'LISA at LV SS27 🔥', tierId: 't2', stats: { views: 2_110_300, likes: 330_220, comments: 3_110, saves: 18_330, shares: 7_440 }, extraMentions: ['@elleusa'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-4/', account: '@vogue_thailand', caption: 'ลิซ่า ที่งานโชว์ Louis Vuitton', tierId: 't2', stats: { likes: 120_330, comments: 1_210, reposts: 220, saves: 1_880, shares: 2_440 }, extraMentions: ['@vogue_thailand'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-M-5/', account: '@hypebeast', caption: 'LISA x LV', tierId: 't2', stats: { views: 980_330, likes: 140_220, comments: 980, reposts: 330, saves: 2_210, shares: 3_120 }, extraMentions: ['@hypebeast'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'tiktok', url: 'https://www.tiktok.com/@fashionnews/video/0000000000000000006', account: '@fashionnews', caption: 'Who wore it best?', tierId: 't3', stats: { views: 420_000, likes: 61_220, comments: 740, saves: 3_100, shares: 1_220 }, extraMentions: ['@fashionnews'] }),

  // ── Media · BVLGARI
  post({ kind: 'media', campaignId: 'bvlgari', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-6/', account: '@vogueitalia', caption: 'LISA in Bulgari high jewelry.', tierId: 't1', stats: { likes: 330_100, comments: 2_440, reposts: 710, saves: 5_120, shares: 6_210 }, extraMentions: ['@vogueitalia'] }),
  post({ kind: 'media', campaignId: 'bvlgari', platform: 'tiktok', url: 'https://www.tiktok.com/@ellethailand/video/0000000000000000007', account: '@ellethailand', caption: 'ลิซ่า x บุลการี', tierId: 't3', stats: { views: 610_220, likes: 88_330, comments: 1_020, saves: 4_440, shares: 1_880 }, extraMentions: ['@ellethailand'] }),
]

const lineTypes: LineType[] = [
  { id: 'hype', name: 'Over-the-top Hype', description: 'Big, dramatic praise that still sounds like a real fan.', style: 'hype' },
  { id: 'sweet', name: 'Sweet & Natural', description: 'Warm, casual comments that read like a friend talking.', style: 'sweet' },
  { id: 'concept', name: 'Campaign Concept', description: 'Mentions the campaign and brand by name (e.g. LV SS27, BVLGARI).', style: 'concept' },
  { id: 'fashion', name: 'Fashion & Styling', description: 'Talks about the look, the outfit and the details.', style: 'fashion' },
  { id: 'story', name: 'Story Caption', description: 'Short captions for sharing media posts to IG Story.', style: 'story' },
]

const tips: Tip[] = [
  { id: 'tip1', category: 'EMV', title: 'What is EMV?', body: 'Earned Media Value estimates how much the exposure from a post would cost as paid advertising. Likes, comments, shares and saves on posts that tag the brand all push EMV up.' },
  { id: 'tip2', category: 'MIV', title: 'What is MIV?', body: 'Media Impact Value (by Launchmetrics) measures the impact of every mention across media, influencers and celebrities. Engaging with Tier 1 media posts carries the most weight.' },
  { id: 'tip3', category: 'Like', title: 'Like early, like everything', body: 'Engagement in the first hour matters most. Like the post, then like the top comments under it as well.' },
  { id: 'tip4', category: 'Comment', title: 'Write real sentences', body: 'Comments with several words count more than single emojis and are less likely to be filtered as spam. Avoid pasting the exact same comment twice.' },
  { id: 'tip5', category: 'Share', title: 'Share to story with tags', body: 'Share media posts to your story and keep the brand and LISA tags. Leave the story up for the full 24 hours.' },
  { id: 'tip6', category: 'Repost', title: 'Use the repost button', body: 'Instagram and TikTok reposts push the post to your followers’ feeds — tap repost on every campaign post.' },
]

export const defaultData: SiteData = {
  settings: {
    heroImage: '',
    tagline: 'Every like, comment and share — together for LISA.',
    credits: 'Made with love by LISA fans · Not affiliated with LISA, LLOUD or any brand.',
    lastSyncedAt: '2026-10-09T08:00:00.000Z',
  },
  campaigns,
  tiers,
  posts,
  lineTypes,
  customLines: [
    { id: 'c1', typeId: 'hype', lang: 'en', text: 'The way she owns every single frame… LISA you are UNREAL 👑✨' },
    { id: 'c2', typeId: 'hype', lang: 'th', text: 'สวยระดับนี้คือผิดกฎหมายแล้วค่ะลิซ่า 😭💛' },
  ],
  tips,
}
