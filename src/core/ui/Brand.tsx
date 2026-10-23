import { cn } from '../lib/cn'

/** Mot-symbole OhO : serif, second O en bleu océan (décision P1). */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-semibold tracking-[var(--ls-head)] text-ink', className)}>
      Oh<span className="text-accent">O</span>
    </span>
  )
}
