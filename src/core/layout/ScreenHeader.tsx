import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

/** En-tête d'écran : titre serif, retour facultatif, actions à droite. Sans titre, l'écran pose le sien plus bas. */
export function ScreenHeader({
  title,
  eyebrow,
  back,
  actions,
}: {
  title: string
  eyebrow?: string
  /** Bouton retour : `true` revient à l'écran précédent, un chemin y mène (lien ouvert directement). */
  back?: boolean | string
  actions?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="flex items-center gap-2 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
      {back ? (
        <button
          type="button"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
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
        {title ? <h1 className="truncate font-display text-3xl font-semibold tracking-[var(--ls-head)] text-ink">{title}</h1> : null}
      </div>
      {actions}
    </header>
  )
}
