import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/cn'

/** Champ libellé : étiquette mono capitales au-dessus, cible de 48 px. */
export function Field({
  label,
  trailing,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; trailing?: ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
        {label.toUpperCase()}
      </label>
      <div className="relative">
        <input
          id={id}
          className={cn(
            'min-h-12 w-full rounded-md border border-transparent bg-surface-2 px-4 text-base text-ink',
            'placeholder:text-ink-4 focus:border-accent focus:outline-none',
            trailing ? 'pr-12' : null,
            className,
          )}
          {...props}
        />
        {trailing ? <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div> : null}
      </div>
    </div>
  )
}
