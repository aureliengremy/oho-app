import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

/** En-tête d'écran : titre serif, retour facultatif, actions à droite. */
export function ScreenHeader({
  title,
  eyebrow,
  back,
  actions,
}: {
  title: string
  eyebrow?: string
  back?: boolean
  actions?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="flex items-center gap-2 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
      {back ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-3 flex size-11 items-center justify-center rounded-pill text-ink hover:bg-surface-2"
          aria-label="Retour"
        >
          <ChevronLeft size={24} />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {eyebrow ? (
          <p className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">{eyebrow.toUpperCase()}</p>
        ) : null}
        <h1 className="truncate font-display text-3xl font-semibold tracking-[var(--ls-head)] text-ink">{title}</h1>
      </div>
      {actions}
    </header>
  )
}
