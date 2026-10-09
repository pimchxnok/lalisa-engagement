/**
 * Caption & comment generator.
 * Each (type, language, length) combination yields 1,000+ unique lines built
 * from phrase banks. Lines that were already copied are tracked by id and are
 * never served again.
 */
import type { Campaign, CustomLine, Lang, LineLength, LineStyle, LineType, Platform } from './types'

type Bank = { openers: string[]; cores: string[] }
type LangBank = Record<LineStyle, Bank> & { extras: string[]; closers: string[]; emojis: string[] }

const banks: Record<Lang, LangBank> = {
  en: {
    hype: {
      openers: ['OMG', 'I’m screaming', 'Stop it right now', 'Not me crying again', 'Excuse me??', 'Hold on', 'I can’t breathe', 'Someone call 911', 'Okay this is illegal', 'Breaking news:'],
      cores: [
        'LISA just broke the internet again',
        'she is the definition of a superstar',
        'this is the most iconic post of the year',
        'nobody does it like LISA',
        'the queen has arrived and we are not ready',
        'she looks like a literal masterpiece',
        'this visual should be in a museum',
        'LISA is on a whole different level',
        'my heart can’t handle this much beauty',
        'she is serving perfection in every frame',
      ],
    },
    sweet: {
      openers: ['Aww', 'Honestly', 'Lili', 'Our girl', 'Seeing this', 'Today’s mood', 'Ahh', 'Can we talk about how', 'Just wanted to say', 'Lisa'],
      cores: [
        'you look so happy and it makes me happy too',
        'this made my whole day better',
        'your smile is everything',
        'you always shine so naturally',
        'so proud of you, always',
        'you look so pretty and so comfortable',
        'we love you so much',
        'thank you for sharing this with us',
        'this is such a beautiful moment',
        'you deserve all the love in the world',
      ],
    },
    concept: {
      openers: ['{brand} x LISA', '{campaign}', 'LISA for {brand}', 'The {campaign} moment', '{brand} really chose right', 'LISA at {campaign}', 'This {brand} era', 'LISA in {brand}', '{campaign} belongs to LISA', 'Face of {brand}'],
      cores: [
        'is the best collaboration ever',
        'and she makes the whole collection look priceless',
        'is everything I hoped for and more',
        'proves she is the perfect ambassador',
        'just set a new standard',
        'feels like a dream come true',
        'deserves every headline',
        'is pure elegance from start to finish',
        'is officially my favorite campaign',
        'shows why the world is watching',
      ],
    },
    fashion: {
      openers: ['That silhouette', 'The styling', 'This whole look', 'The details on this outfit', 'Her hair and makeup', 'The color palette', 'That walk', 'This fit', 'The accessories', 'The way she carries it'],
      cores: [
        'is absolutely flawless',
        'is giving runway royalty',
        'was made for her',
        'is so elegant and modern',
        'is a 10 out of 10',
        'looks effortless on LISA',
        'is my new inspiration',
        'deserves a spot on every best-dressed list',
        'is pure luxury',
        'is chef’s kiss perfect',
      ],
    },
    story: {
      openers: ['LISA ✦', 'Our queen', 'LISA x {brand}', '{campaign}', 'Look at her', 'So proud', 'Stunning', 'Iconic', 'Main character', 'Breathtaking'],
      cores: ['always and forever', 'in {brand}', 'at {campaign}', 'did it again', 'never misses', 'shining bright', 'pure elegance', 'the moment', 'a true icon', 'look of the day'],
    },
    extras: [
      'Everyone needs to see this.',
      'I have watched this a hundred times already.',
      'This is why she is the best.',
      'The talent, the visuals, the aura — all of it.',
      'Can’t stop smiling looking at this.',
      'History is being made right here.',
      'She keeps outdoing herself every single time.',
      'This deserves millions of likes.',
    ],
    closers: [
      'We will always support you, LISA!',
      'Lilies are so proud of you forever.',
      'Please never stop sharing moments like this.',
      'Thank you for always giving us your best.',
      'Sending you all my love from here.',
      'You make every Lily’s day brighter.',
      'Forever your biggest fan.',
      'Can’t wait to see what you do next!',
    ],
    emojis: ['👑✨', '😍🔥', '💛💛💛', '🤍✨', '🔥🔥', '😭💛', '🫶🏻', '✨💎', '🌟👑', '💫🤍'],
  },
  th: {
    hype: {
      openers: ['กรี๊ดดด', 'ไม่ไหวแล้ว', 'ตายแล้ววว', 'ใจจะวาย', 'พอเลยค่ะ', 'ขอตัวไปกรี๊ดแป๊บ', 'นี่มันอะไรกัน', 'ร้องไห้หนักมาก', 'ด่วนที่สุด', 'โอ้โหหห'],
      cores: [
        'ลิซ่าสวยระดับทำลายล้างมาก',
        'นี่คือซูเปอร์สตาร์ตัวจริง',
        'โพสต์นี้คือไอคอนิกที่สุดของปี',
        'ไม่มีใครทำได้แบบลิซ่าแล้ว',
        'ราชินีมาแล้ว ทุกคนหลบไป',
        'สวยเหมือนงานศิลปะเดินได้',
        'ภาพนี้ควรเอาไปไว้ในพิพิธภัณฑ์',
        'ลิซ่าอยู่คนละเลเวลกับโลกนี้',
        'หัวใจรับความสวยไม่ไหวแล้ว',
        'เพอร์เฟกต์ทุกเฟรมจริง ๆ',
      ],
    },
    sweet: {
      openers: ['น่ารักจัง', 'จริง ๆ นะ', 'ลิลี่', 'ลูกสาวเรา', 'เห็นแล้ว', 'วันนี้', 'อ๊าาา', 'ขอพูดหน่อย', 'อยากบอกว่า', 'ลิซ่า'],
      cores: [
        'เห็นลิซ่ายิ้มแล้วมีความสุขตามเลย',
        'โพสต์นี้ทำให้ทั้งวันดีขึ้นมาก',
        'รอยยิ้มนี้คือทุกอย่าง',
        'เปล่งประกายแบบเป็นธรรมชาติตลอด',
        'ภูมิใจในตัวลิซ่าเสมอนะ',
        'ดูสวยแล้วก็ดูสบายใจมาก',
        'รักลิซ่ามาก ๆ เลย',
        'ขอบคุณที่แบ่งปันโมเมนต์นี้นะ',
        'เป็นช่วงเวลาที่สวยงามมาก',
        'สมควรได้รับความรักทั้งโลก',
      ],
    },
    concept: {
      openers: ['{brand} x LISA', '{campaign}', 'ลิซ่ากับ {brand}', 'โมเมนต์ {campaign}', '{brand} เลือกถูกคนมาก', 'ลิซ่าที่งาน {campaign}', 'ยุค {brand}', 'ลิซ่าในลุค {brand}', '{campaign} เป็นของลิซ่า', 'หน้าตาของ {brand}'],
      cores: [
        'คือคอลแลบที่ดีที่สุด',
        'ใส่แล้วทำให้ทั้งคอลเลกชันดูล้ำค่า',
        'ดีเกินกว่าที่หวังไว้มาก',
        'พิสูจน์แล้วว่าคือแอมบาสเดอร์ที่เพอร์เฟกต์',
        'ตั้งมาตรฐานใหม่ไปแล้ว',
        'เหมือนฝันที่เป็นจริง',
        'สมควรได้ขึ้นทุกหน้าข่าว',
        'หรูหราตั้งแต่ต้นจนจบ',
        'คือแคมเปญที่ชอบที่สุด',
        'ทั้งโลกต้องจับตามอง',
      ],
    },
    fashion: {
      openers: ['ทรงชุดนี้', 'สไตลิ่งวันนี้', 'ลุคนี้ทั้งลุค', 'ดีเทลชุด', 'ผมกับเมคอัพ', 'โทนสีนี้', 'ท่าเดินนั้น', 'ชุดนี้', 'เครื่องประดับ', 'การแบกลุคของลิซ่า'],
      cores: [
        'ไร้ที่ติมาก',
        'คือราชินีรันเวย์',
        'เกิดมาเพื่อลิซ่า',
        'หรูและโมเดิร์นสุด ๆ',
        'ให้สิบเต็มสิบ',
        'ดูง่ายแต่ปังมาก',
        'เป็นแรงบันดาลใจใหม่เลย',
        'ต้องติดลิสต์แต่งตัวดีที่สุด',
        'คือความลักชัวรี่',
        'เพอร์เฟกต์ไม่มีอะไรต้องแก้',
      ],
    },
    story: {
      openers: ['ลิซ่า ✦', 'ราชินีของเรา', 'LISA x {brand}', '{campaign}', 'ดูเธอสิ', 'ภูมิใจมาก', 'สวยมาก', 'ไอคอนิก', 'ตัวแม่', 'ใจละลาย'],
      cores: ['ตลอดไป', 'ในลุค {brand}', 'ที่งาน {campaign}', 'ทำได้อีกแล้ว', 'ไม่เคยพลาด', 'เปล่งประกาย', 'หรูหราสุด ๆ', 'โมเมนต์นี้', 'ไอคอนตัวจริง', 'ลุคประจำวัน'],
    },
    extras: [
      'ทุกคนต้องได้เห็นโพสต์นี้',
      'ดูซ้ำไปร้อยรอบแล้ว',
      'นี่แหละเหตุผลที่เธอคือที่สุด',
      'ทั้งความสามารถ ทั้งวิชวล ทั้งออร่า ครบมาก',
      'ยิ้มไม่หุบเลยตอนดู',
      'นี่คือการสร้างประวัติศาสตร์',
      'เก่งขึ้นทุกครั้งจริง ๆ',
      'สมควรได้ไลก์เป็นล้าน',
    ],
    closers: [
      'จะซัพพอร์ตลิซ่าตลอดไปนะ!',
      'ลิลี่ภูมิใจในตัวลิซ่าที่สุด',
      'อย่าหยุดแชร์โมเมนต์แบบนี้นะ',
      'ขอบคุณที่ทุ่มเทให้เราเสมอ',
      'ส่งความรักไปให้เยอะ ๆ เลย',
      'ทำให้วันของลิลี่สดใสทุกวัน',
      'เป็นแฟนคลับตลอดไป',
      'รอดูผลงานต่อไปเลย!',
    ],
    emojis: ['👑✨', '😍🔥', '💛💛💛', '🤍✨', '🔥🔥', '😭💛', '🫶🏻', '✨💎', '🌟👑', '💫🤍'],
  },
}

function radix(style: LineStyle, lang: Lang, length: LineLength) {
  const b = banks[lang]
  const s = b[style]
  const r = [s.openers.length, s.cores.length, b.emojis.length]
  if (style === 'story' || length === 'short') return r
  if (length === 'medium') return [...r, b.extras.length]
  return [...r, b.extras.length, b.closers.length]
}

/** Number of unique generated lines for a type/lang/length */
export function poolSize(style: LineStyle, lang: Lang, length: LineLength) {
  return radix(style, lang, length).reduce((a, x) => a * x, 1)
}

function fill(t: string, c?: Campaign) {
  return t.replaceAll('{brand}', c?.brand ?? 'LISA').replaceAll('{campaign}', c?.name ?? 'this')
}

function build(style: LineStyle, lang: Lang, length: LineLength, index: number, c?: Campaign) {
  const b = banks[lang]
  const s = b[style]
  const r = radix(style, lang, length)
  const d: number[] = []
  let i = index
  for (const base of r) {
    d.push(i % base)
    i = Math.floor(i / base)
  }
  const sep = lang === 'th' ? ' ' : style === 'story' ? ' · ' : ', '
  let text = `${s.openers[d[0]]}${sep}${s.cores[d[1]]}`
  if (lang === 'en' && style !== 'story') text += d[1] % 2 ? '!' : '.'
  if (d[3] !== undefined) text += ` ${b.extras[d[3]]}`
  if (d[4] !== undefined) text += ` ${b.closers[d[4]]}`
  return fill(`${text} ${b.emojis[d[2]]}`, c)
}

export type PickedLine = { id: string; text: string; custom: boolean }

export function pickLine(opts: {
  type: LineType
  lang: Lang
  length: LineLength
  campaign?: Campaign
  customLines: CustomLine[]
  used: Record<string, true>
  exclude?: string
}): PickedLine | null {
  const { type, lang, length, campaign, used, exclude } = opts
  const customs = opts.customLines.filter(
    (l) => l.typeId === type.id && l.lang === lang && !used[`u:${l.id}`] && `u:${l.id}` !== exclude,
  )
  // Owner-written lines get served first, half of the time
  if (customs.length && Math.random() < 0.5) {
    const l = customs[Math.floor(Math.random() * customs.length)]
    return { id: `u:${l.id}`, text: fill(l.text, campaign), custom: true }
  }
  const len = type.style === 'story' ? 'short' : length
  const size = poolSize(type.style, lang, len)
  const prefix = `g:${type.style}:${lang}:${len}:${campaign?.id ?? '-'}:`
  const start = Math.floor(Math.random() * size)
  // Stride by a prime that never divides the pool sizes so every index is visited
  for (let k = 0; k < size; k++) {
    const idx = (start + k * 7919) % size
    const id = prefix + idx
    if (!used[id] && id !== exclude) {
      return { id, text: build(type.style, lang, len, idx, campaign), custom: false }
    }
  }
  if (customs.length) {
    const l = customs[0]
    return { id: `u:${l.id}`, text: fill(l.text, campaign), custom: true }
  }
  return null
}

/** Adapts a line for the target platform's comment conventions */
export function formatForPlatform(text: string, tags: string[], platform: Platform) {
  if (!tags.length) return text
  return platform === 'tiktok' ? `${text} ${tags.join(' ')}` : `${text}\n\n${tags.join(' ')}`
}

export const platformLimits: Record<Platform, number> = {
  tiktok: 150,
  'ig-post': 2200,
  'ig-reel': 2200,
}
