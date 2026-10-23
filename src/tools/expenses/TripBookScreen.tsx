import { Navigate, useParams, useSearchParams } from 'react-router'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { Button } from '@/core/ui/Button'
import { useExpenses } from './ExpensesProvider'

/**
 * `/depenses/voyage/:tripId` : le lien de la fiche voyage. Ouvre le carnet du voyage, ou propose
 * d'en créer un (pas de carnet automatique, M20). Avec `?reservation=`, enchaîne sur la dépense.
 */
export function TripBookScreen() {
  const { data, isPending, settled, addBook } = useExpenses()
  const { tripId } = useParams()
  const [params] = useSearchParams()
  const booking = params.get('reservation')
  const trip = data?.trips.find((t) => t.id === tripId)
  const book = data?.books.find((b) => b.trip_id === tripId)

  if (book) {
    const suffix = booking ? `/depense/nouvelle?reservation=${encodeURIComponent(booking)}` : ''
    return <Navigate to={`/depenses/${book.id}${suffix}`} replace />
  }
  if (isPending || !data || (!trip && !settled)) {
    return (
      <>
        <ScreenHeader title="Dépenses" back="/depenses" />
        <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
          Chargement des dépenses…
        </p>
      </>
    )
  }
  if (!trip) return <Navigate to="/depenses" replace />
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title={trip.title} eyebrow="Dépenses du voyage" back={`/voyages/${trip.id}/budget`} />
      <div className="flex flex-col items-start gap-4 px-5">
        <p className="text-ink-2">Ce voyage n’a pas encore de carnet. Un carnet garde les dépenses du voyage à part et calcule qui doit quoi, en dollars canadiens.</p>
        <Button onClick={() => addBook({ name: trip.title.slice(0, 60), currency: 'CAD', trip_id: trip.id })}>Ouvrir un carnet pour ce voyage</Button>
      </div>
    </div>
  )
}
