import type { ReactNode } from 'react'
import { ScreenHeader } from './ScreenHeader'

/** Écran d'un outil activé dont le contenu arrive dans un lot suivant. */
export function ToolPlaceholder({ title, lot, children }: { title: string; lot: string; children: ReactNode }) {
  return (
    <>
      <ScreenHeader title={title} />
      <div className="flex flex-col gap-3 px-5 py-8">
        <span className="w-fit rounded-pill bg-accent-tint px-3 py-1 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-accent-ink">
          {lot}
        </span>
        <p className="max-w-prose text-ink-2">{children}</p>
      </div>
    </>
  )
}
