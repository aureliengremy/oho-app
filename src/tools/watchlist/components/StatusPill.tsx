import { cn } from '@/core/lib/cn'
import { statusLabel, type WatchStatus } from '../model'

const styles: Record<WatchStatus, string> = {
  to_watch: 'bg-surface-2 text-ink-2',
  watching: 'bg-accent-tint text-accent-ink',
  watched: 'bg-ok-tint text-ok',
  dropped: 'bg-warn-tint text-warn',
}

export function StatusPill({ status, className }: { status: WatchStatus; className?: string }) {
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
