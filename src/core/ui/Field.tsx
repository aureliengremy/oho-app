import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
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
      <label htmlFor={id} className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
        {label}
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

const control =
  'min-h-12 w-full rounded-md border border-transparent bg-surface-2 px-4 text-base text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none'

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
      {children}
    </label>
  )
}

/** Liste déroulante libellée, même gabarit que `Field`. */
export function SelectField({
  label,
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: readonly { value: string; label: string }[] }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={cn(control, 'px-3', className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Zone de texte libellée pour les notes. */
export function TextAreaField({ label, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea id={id} rows={3} className={cn(control, 'py-3', className)} {...props} />
    </div>
  )
}
