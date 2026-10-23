import type { ReactNode } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router'
import { useHousehold } from '@/core/household/useHousehold'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { Button } from '@/core/ui/Button'
import { useExpenses } from '../useExpenses'
import type { Book, ExpensesData } from '../model'
import { expensesKey } from '../queries'

/** Charge le carnet de l'adresse (`:bookId`) avant d'afficher l'écran ; revient à la liste s'il n'existe plus. */
export function BookGate({ title, children }: { title: string; children: (book: Book, data: ExpensesData) => ReactNode }) {
  const { data, isPending, isError, refetch, settled } = useExpenses()
  const { bookId } = useParams()
  const { household } = useHousehold()
  const writing = useIsMutating({ mutationKey: expensesKey(household.id) }) > 0
  const book = data?.books.find((b) => b.id === bookId)

  // Un carnet tout juste créé, ou absent du cache de l'appareil, arrive avec la relecture.
  if (isPending || isError || !data || (!book && (writing || !settled))) {
    return (
      <>
        <ScreenHeader title={title} back="/depenses" />
        {!isError ? (
          <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            Chargement des dépenses…
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-ink-2">Les dépenses ne se sont pas chargées. Vérifie la connexion puis réessaie.</p>
            <Button onClick={refetch}>Réessayer</Button>
          </div>
        )}
      </>
    )
  }
  if (!book) return <Navigate to="/depenses" replace />
  return <>{children(book, data)}</>
}
