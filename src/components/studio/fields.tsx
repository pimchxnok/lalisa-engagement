import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export const inputCls =
  'w-full rounded-xl border border-gold-200 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.15em] text-gold-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gold-600">{hint}</span>}
    </label>
  )
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-gold-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ChipInput({ value, onChange, prefix, placeholder }: { value: string[]; onChange: (v: string[]) => void; prefix: '#' | '@'; placeholder: string }) {
  const [draft, setDraft] = useState('')
  function add() {
    const items = draft
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith(prefix) ? t : prefix + t.replace(/^[#@]/, '')))
    if (items.length) onChange([...new Set([...value, ...items])])
    setDraft('')
  }
  return (
    <div className="rounded-xl border border-gold-200 bg-white/80 p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="chip-on inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm focus:outline-none"
        />
      </div>
    </div>
  )
}

export function SmallBtn({ children, onClick, tone = 'plain', type = 'button', disabled }: { children: ReactNode; onClick?: () => void; tone?: 'plain' | 'gold' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean }) {
  const t =
    tone === 'gold'
      ? 'btn-gold'
      : tone === 'danger'
        ? 'border border-rose-200 bg-white/70 text-rose-600 hover:bg-rose-50'
        : 'border border-gold-300 bg-white/70 text-gold-800 hover:bg-white'
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm disabled:opacity-50 ${t}`}>
      {children}
    </button>
  )
}

export function ConfirmButton({ children, onConfirm, message = 'Delete this item? This cannot be undone.' }: { children: ReactNode; onConfirm: () => void; message?: string }) {
  const [pending, setPending] = useState(false)
  if (!pending) return <SmallBtn tone="danger" onClick={() => setPending(true)}>{children}</SmallBtn>
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-2" role="group" aria-label={message}>
      <span className="text-xs text-rose-800" role="status">{message}</span>
      <SmallBtn tone="danger" onClick={() => { onConfirm(); setPending(false) }}>Confirm</SmallBtn>
      <SmallBtn onClick={() => setPending(false)}>Cancel</SmallBtn>
    </div>
  )
}
