import type { ReactNode } from 'react'
import { cn } from '@/core/lib/cn'

/** Groupe de pastilles à choix unique (payé par, partage, catégorie), cibles de 44 px. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  wrap = false,
}: {
  label: string
  value: T
  options: readonly { value: T; label: ReactNode; name?: string }[]
  onChange: (value: T) => void
  wrap?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3" aria-hidden="true">
        {label.toUpperCase()}
      </span>
      <div role="radiogroup" aria-label={label} className={cn('flex gap-2', wrap ? 'flex-wrap' : 'overflow-x-auto')}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.name}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-11 flex-none items-center gap-2 rounded-pill border px-4 text-[15px] font-semibold',
              value === o.value ? 'border-accent-ink bg-accent-tint text-accent-ink' : 'border-rule text-ink-2',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
