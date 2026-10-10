/**
 * src/components/studio/fields.tsx
 * Updated to include SyncStatusBadge display in studio
 */

import { ChevronDown, Trash2, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

export const inputCls =
  'rounded-full border border-gold-300 bg-white/80 px-4 py-2 text-sm text-gold-900 placeholder-gold-600/60 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gold-800">{label}</span>
      {hint && <p className="text-xs text-gold-600/80">{hint}</p>}
      {children}
    </label>
  )
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-gold-200 bg-white/70 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-gold-900">{title}</h2>
        {action && <div className="flex flex-wrap justify-end gap-2">{action}</div>}
      </div>
      {children}
    </div>
  )
}

export function SmallBtn({
  children,
  onClick,
  disabled,
  type = 'button',
  tone = 'default',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  tone?: 'default' | 'gold' | 'danger'
}) {
  const baseClass = 'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const toneClass = {
    default: 'border border-gold-300 bg-white/70 text-gold-800 hover:bg-white hover:border-gold-400',
    gold: 'bg-gold-500 text-white hover:bg-gold-600',
    danger: 'bg-red-500/80 text-white hover:bg-red-600',
  }[tone]

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseClass} ${toneClass}`}>
      {children}
    </button>
  )
}

export function ConfirmButton({
  children,
  onConfirm,
  message = 'Are you sure?',
}: {
  children: ReactNode
  onConfirm: () => void
  message?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  return confirming ? (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === ref.current) setConfirming(false)
      }}
    >
      <div className="rounded-3xl border border-gold-200 bg-white p-6 shadow-lg max-w-sm">
        <p className="text-gold-900 mb-4">{message}</p>
        <div className="flex gap-2">
          <SmallBtn tone="danger" onClick={() => { onConfirm(); setConfirming(false) }}>Confirm</SmallBtn>
          <SmallBtn onClick={() => setConfirming(false)}>Cancel</SmallBtn>
        </div>
      </div>
    </div>
  ) : (
    <SmallBtn onClick={() => setConfirming(true)}>{children}</SmallBtn>
  )
}

export function ChipInput({
  prefix,
  value,
  onChange,
  placeholder = '',
}: {
  prefix: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  return (
    <div className="rounded-full border border-gold-300 bg-white/80 p-2 flex flex-wrap gap-2 items-center">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-sm text-gold-800">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="text-gold-600 hover:text-gold-900"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const clean = (prefix + input.replace(prefix, '')).trim()
            if (clean && !value.includes(clean)) {
              onChange([...value, clean])
              setInput('')
            }
          }
        }}
        placeholder={placeholder}
        className="flex-1 min-w-24 bg-transparent text-sm text-gold-900 placeholder-gold-600/60 focus:outline-none"
      />
    </div>
  )
}
