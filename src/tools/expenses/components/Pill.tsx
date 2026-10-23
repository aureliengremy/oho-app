import { cn } from '@/core/lib/cn'

const tones = { ok: 'bg-ok-tint text-ok', warn: 'bg-warn-tint text-warn', neutral: 'bg-surface-2 text-ink-2' } as const

/** Pastille mono capitales : fond et texte vont par paire, toujours avec un mot. */
export function Pill({ tone, children, className }: { tone: keyof typeof tones; children: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 flex-none items-center rounded-pill px-2.5 font-mono text-[11.5px] font-semibold tracking-[0.06em] uppercase', tones[tone], className)}>
      {children}
    </span>
  )
}
