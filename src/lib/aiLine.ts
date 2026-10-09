import type { PickedLine } from './generator'
import type { LineRequest } from './aiWriter'

/** Asks the server's AI line writer for a fresh line. AI lines get an `a:` id so copying them is still recorded. */
export async function requestAiLine(req: Omit<LineRequest, 'typeDescription' | 'postCaption' | 'avoid'> & Partial<LineRequest>): Promise<PickedLine> {
  const res = await fetch('/api/write-line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
  if (!res.ok || !body.text) throw new Error(body.error ?? 'The AI writer is busy — try again or use Random.')
  return { id: `a:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: body.text, custom: false }
}
