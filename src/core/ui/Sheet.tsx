import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useBackDismiss } from '../hooks/useBackDismiss'

/**
 * Feuille du bas (modale). Retour d'Android, Échap et un toucher sur le fond la ferment.
 * Le focus entre dans la feuille à l'ouverture (dans son premier champ si `focusField`, ce qui
 * ouvre le clavier) et revient à l'élément d'origine à la fermeture.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  focusField = false,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  focusField?: boolean
  children: ReactNode
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useBackDismiss(open, onClose)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const field = focusField ? panel.current?.querySelector<HTMLElement>('input, textarea, select') : null
    ;(field ?? panel.current)?.focus()
    return () => opener?.focus?.()
  }, [open, focusField])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <div className="absolute inset-0 bg-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[22px] bg-surface px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] outline-none"
      >
        <div className="mx-auto h-1 w-10 rounded-pill bg-rule-strong" aria-hidden="true" />
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            {eyebrow ? (
              <p className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">{eyebrow}</p>
            ) : null}
            <h2 id={titleId} className="font-display text-2xl font-semibold tracking-[var(--ls-head)] text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-2 flex size-11 items-center justify-center rounded-pill text-ink-2 hover:bg-surface-2"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
