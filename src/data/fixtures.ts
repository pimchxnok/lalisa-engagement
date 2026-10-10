/**
 * Updated src/data/fixtures.ts with better sync support
 * All posts have proper stats initialized for sync
 */

import type { Campaign, LineType, Post, SiteData, Tier, Tip } from '@/lib/types'

const campaigns: Campaign[] = [
  {
    id: 'lvss27',
    name: 'LV SS27',
    brand: 'Louis Vuitton',
    season: 'Spring/Summer 2027',
    description: 'Louis Vuitton Women\'s Spring/Summer 2027 show & campaign.',
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
    description: 'LISA\'s own releases, lives and personal posts.',
    hashtags: ['#LISA', '#LALISA', '#LLOUD'],
    mentions: ['@lalalalisa_m', '@wearelloud'],
  },
]

const tiers: Tier[] = [
  { id: 't1-tiktok', platform: 'tiktok', name: 'Tier 1 · Global' },
  { id: 't2-tiktok', platform: 'tiktok', name: 'Tier 2 · Fashion & Lifestyle' },
  { id: 't3-tiktok', platform: 'tiktok', name: 'Tier 3 · Fan & Local' },
  { id: 't1-ig-post', platform: 'ig-post', name: 'Tier 1 · Global' },
  { id: 't2-ig-post', platform: 'ig-post', name: 'Tier 2 · Regional' },
  { id: 't3-ig-post', platform: 'ig-post', name: 'Tier 3 · Fan & Local' },
  { id: 't1-ig-reel', platform: 'ig-reel', name: 'Tier 1 · Global' },
  { id: 't2-ig-reel', platform: 'ig-reel', name: 'Tier 2 · Regional' },
]

let n = 0
function post(p: Omit<Post, 'id' | 'caption' | 'postedAt' | 'communityComments'> & Partial<Post>): Post {
  n += 1
  return {
    id: `p${n}`,
    caption: '',
    postedAt: `2026-10-0${(n % 8) + 1}`,
    communityComments: Math.round((p.stats.comments ?? 0) * 0.37),
    ...p,
  }
}

const posts: Post[] = [
  // ── LV SS27 · LISA & Brand
  post({
    kind: 'lisa',
    campaignId: 'lvss27',
    platform: 'ig-post',
    url: 'https://www.instagram.com/p/SAMPLE-LV-1/',
    account: '@lalalalisa_m',
    caption: 'Paris, front row 🤍 #LouisVuitton',
    stats: { views: 0, likes: 240_000, comments: 18_000, saves: 8_500, shares: 2_100, reposts: 0 },
  }),
  post({
    kind: 'lisa',
    campaignId: 'lvss27',
    platform: 'ig-reel',
    url: 'https://www.instagram.com/reel/SAMPLE-LV-2/',
    account: '@lalalalisa_m',
    caption: 'Getting ready for the show ✨',
    stats: { views: 1_200_000, likes: 380_000, comments: 32_000, saves: 45_000, shares: 8_900, reposts: 0 },
  }),
  post({
    kind: 'lisa',
    campaignId: 'lvss27',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@lalalalisa_m/video/0000000000000000001',
    account: '@lalalalisa_m',
    caption: 'LV day 🖤',
    stats: { views: 2_800_000, likes: 580_000, comments: 52_000, saves: 125_000, shares: 45_000, reposts: 0 },
  }),
  post({
    kind: 'brand',
    campaignId: 'lvss27',
    platform: 'ig-post',
    url: 'https://www.instagram.com/p/SAMPLE-LV-3/',
    account: '@louisvuitton',
    caption: 'House Ambassador LISA at the Women\'s Show',
    stats: { views: 0, likes: 385_000, comments: 12_500, saves: 28_000, shares: 5_600, reposts: 0 },
  }),
  post({
    kind: 'brand',
    campaignId: 'lvss27',
    platform: 'ig-reel',
    url: 'https://www.instagram.com/reel/SAMPLE-LV-4/',
    account: '@louisvuitton',
    caption: 'Arrivals — LISA. #LVSS27',
    stats: { views: 4_200_000, likes: 950_000, comments: 78_000, saves: 156_000, shares: 42_000, reposts: 0 },
  }),
  post({
    kind: 'brand',
    campaignId: 'lvss27',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@louisvuitton/video/0000000000000000002',
    account: '@louisvuitton',
    caption: 'LISA in Paris',
    stats: { views: 8_900_000, likes: 1_200_000, comments: 145_000, saves: 380_000, shares: 125_000, reposts: 0 },
  }),

  // ── BVLGARI · LISA & Brand
  post({
    kind: 'lisa',
    campaignId: 'bvlgari',
    platform: 'ig-post',
    url: 'https://www.instagram.com/p/SAMPLE-BV-1/',
    account: '@lalalalisa_m',
    caption: 'Serpenti 🐍💎',
    stats: { likes: 320_000, comments: 24_000, saves: 12_000, shares: 3_200, reposts: 0, views: 0 },
  }),
  post({
    kind: 'lisa',
    campaignId: 'bvlgari',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@lalalalisa_m/video/0000000000000000003',
    account: '@lalalalisa_m',
    caption: 'Rome nights',
    stats: { views: 1_900_000, likes: 420_000, comments: 38_000, saves: 95_000, shares: 28_000, reposts: 0 },
  }),
  post({
    kind: 'brand',
    campaignId: 'bvlgari',
    platform: 'ig-reel',
    url: 'https://www.instagram.com/reel/SAMPLE-BV-2/',
    account: '@bulgari',
    caption: 'LISA wears Bulgari High Jewelry.',
    stats: { views: 3_100_000, likes: 720_000, comments: 55_000, saves: 98_000, shares: 22_000, reposts: 0 },
  }),

  // ── LISA Solo
  post({
    kind: 'lisa',
    campaignId: 'lisa-solo',
    platform: 'ig-reel',
    url: 'https://www.instagram.com/reel/SAMPLE-SOLO-1/',
    account: '@lalalalisa_m',
    caption: 'New era 🌙',
    stats: { views: 2_100_000, likes: 580_000, comments: 42_000, saves: 78_000, shares: 18_000, reposts: 0 },
  }),
  post({
    kind: 'lisa',
    campaignId: 'lisa-solo',
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@lalalalisa_m/video/0000000000000000004',
    account: '@lalalalisa_m',
    caption: 'dance challenge 💃',
    stats: { views: 5_200_000, likes: 850_000, comments: 125_000, saves: 280_000, shares: 95_000, reposts: 0 },
  }),

  // ── Media · LV SS27

  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-1/', account: '@voguemagazine', caption: 'LISA arrives at Louis Vuitton SS27.', tierId: 't1-ig-post', stats: { likes: 610_220, comments: 4_120, reposts: 1_320, saves: 9_880, shares: 12_440 }, extraMentions: ['@voguemagazine'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-M-2/', account: '@wwd', caption: 'Front row at LV: LISA.', tierId: 't1-ig-reel', stats: { views: 3_220_100, likes: 402_330, comments: 2_880, reposts: 1_120, saves: 6_330, shares: 9_910 }, extraMentions: ['@wwd'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-3/', account: '@harpersbazaarus', caption: 'Best dressed at Paris Fashion Week.', tierId: 't1-ig-post', stats: { likes: 288_440, comments: 1_930, reposts: 640, saves: 4_120, shares: 5_330 }, extraMentions: ['@harpersbazaarus'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'tiktok', url: 'https://www.tiktok.com/@elleusa/video/0000000000000000005', account: '@elleusa', caption: 'LISA at LV SS27 🔥', tierId: 't2-tiktok', stats: { views: 2_110_300, likes: 330_220, comments: 3_110, saves: 18_330, shares: 7_440 }, extraMentions: ['@elleusa'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-4/', account: '@vogue_thailand', caption: 'ลิซ่า ที่งานโชว์ Louis Vuitton', tierId: 't2-ig-post', stats: { likes: 120_330, comments: 1_210, reposts: 220, saves: 1_880, shares: 2_440 }, extraMentions: ['@vogue_thailand'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'ig-reel', url: 'https://www.instagram.com/reel/SAMPLE-M-5/', account: '@hypebeast', caption: 'LISA x LV', tierId: 't2-ig-reel', stats: { views: 980_330, likes: 140_220, comments: 980, reposts: 330, saves: 2_210, shares: 3_120 }, extraMentions: ['@hypebeast'] }),
  post({ kind: 'media', campaignId: 'lvss27', platform: 'tiktok', url: 'https://www.tiktok.com/@fashionnews/video/0000000000000000006', account: '@fashionnews', caption: 'Who wore it best?', tierId: 't3-tiktok', stats: { views: 420_000, likes: 61_220, comments: 740, saves: 3_100, shares: 1_220 }, extraMentions: ['@fashionnews'] }),

  // ── Media · BVLGARI
  post({ kind: 'media', campaignId: 'bvlgari', platform: 'ig-post', url: 'https://www.instagram.com/p/SAMPLE-M-6/', account: '@vogueitalia', caption: 'LISA in Bulgari high jewelry.', tierId: 't1-ig-post', stats: { likes: 330_100, comments: 2_440, reposts: 710, saves: 5_120, shares: 6_210 }, extraMentions: ['@vogueitalia'] }),
  post({ kind: 'media', campaignId: 'bvlgari', platform: 'tiktok', url: 'https://www.tiktok.com/@ellethailand/video/0000000000000000007', account: '@ellethailand', caption: 'ลิซ่า x บุลการี', tierId: 't3-tiktok', stats: { views: 610_220, likes: 88_330, comments: 1_020, saves: 4_440, shares: 1_880 }, extraMentions: ['@ellethailand'] }),

]

const lineTypes: LineType[] = [
  { id: 'hype', name: 'Over-the-top Hype', description: 'Big, dramatic praise that still sounds like a real fan.', style: 'hype' },
  { id: 'sweet', name: 'Sweet & Natural', description: 'Warm, casual comments that read like a friend talking.', style: 'sweet' },
  { id: 'concept', name: 'Campaign Concept', description: 'Mentions the campaign and brand by name (e.g. LV SS27, BVLGARI).', style: 'concept' },
  { id: 'fashion', name: 'Fashion & Styling', description: 'Talks about the look, the outfit and the details.', style: 'fashion' },
  { id: 'story', name: 'Story Caption', description: 'Short captions for sharing media posts to IG Story.', style: 'story' },
]

const tips: Tip[] = [
  { id: 'tip1', category: 'EMV', title: 'What is EMV?', body: 'Earned Media Value estimates how much the exposure from a post would cost as paid advertising. Likes, comments, shares and saves on posts about LISA add up.' },
  { id: 'tip2', category: 'MIV', title: 'What is MIV?', body: 'Media Impact Value (by Launchmetrics) measures the impact of every mention across media, influencers and celebrities. Engaging with posts helps track LISA\'s real presence.' },
  { id: 'tip3', category: 'Like', title: 'Like early, like everything', body: 'Engagement in the first hour matters most. Like the post, then like the top comments under it as well.' },
  { id: 'tip4', category: 'Comment', title: 'Write real sentences', body: 'Comments with several words count more than single emojis and are less likely to be filtered as spam. Avoid pasting the same comment everywhere.' },
  { id: 'tip5', category: 'Share', title: 'Share to story with tags', body: 'Share media posts to your story and keep the brand and LISA tags. Leave the story up for the full 24 hours.' },
  { id: 'tip6', category: 'Repost', title: 'Use the repost button', body: 'Instagram and TikTok reposts push the post to your followers\' feeds — tap repost on every campaign post.' },
]

export const defaultData: SiteData = {
  settings: {
    heroImage: '',
    tagline: 'Every like, comment and share — together for LISA.',
    credits: 'Made with love by LISA fans · Not affiliated with LISA, LLOUD or any brand.',
    lastSyncedAt: new Date().toISOString(),
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
