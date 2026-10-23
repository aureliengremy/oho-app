import { cn } from '@/core/lib/cn'
import { statusLabel, type TripStatus } from '../model'

const styles: Record<TripStatus, string> = {
  idea: 'bg-surface-2 text-ink-2',
  planned: 'bg-accent-tint text-accent-ink',
  ongoing: 'bg-accent-ink text-surface',
  done: 'bg-ok-tint text-ok',
}

/** La pastille écrit le statut : idée neutre, planifié en teinte, en cours plein, terminé en paire conforme. */
export function StatusPill({ status, className }: { status: TripStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-pill px-2.5 font-mono text-[11.5px] font-semibold tracking-[0.06em] uppercase',
        styles[status],
        className,
      )}
    >
      {statusLabel[status]}
    </span>
  )
}
