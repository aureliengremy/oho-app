import { useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { useIsMutating } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useHousehold } from '@/core/household/useHousehold'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { ConnectionBanner, LiveBadge } from '@/core/sync/ConnectionStatus'
import { Button } from '@/core/ui/Button'
import { StatusPill } from './components/StatusPill'
import { TripSheet } from './components/TripSheet'
import { countdown, formatLongRange, isoDay, nights, nightsLabel, statusLabel, suggestedStatus, type Trip, type TripsData } from './model'
import { tripsKey } from './queries'
import { BookingsTab } from './tabs/BookingsTab'
import { BudgetTab } from './tabs/BudgetTab'
import { IdeasTab } from './tabs/IdeasTab'
import { PrepTab } from './tabs/PrepTab'
import { useTrips } from './useTrips'

const tabs = [
  { slug: 'idees', label: 'Idées' },
  { slug: 'checklist', label: 'Checklist' },
  { slug: 'reservations', label: 'Réservations' },
  { slug: 'budget', label: 'Budget' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

/** La fiche d'un voyage : en-tête, suggestion de statut et quatre onglets. */
export function TripScreen() {
  const { data, isPending, isError, refetch, settled } = useTrips()
  const { tripId, tab } = useParams()
  const { household } = useHousehold()
  const writing = useIsMutating({ mutationKey: tripsKey(household.id) }) > 0
  const trip = data?.trips.find((t) => t.id === tripId)

  // Un voyage tout juste créé, ou absent du cache de l'appareil, arrive avec la relecture.
  if (isPending || isError || !data || (!trip && (writing || !settled))) {
    return (
      <>
        <ScreenHeader title="Voyage" back="/voyages" />
        {!isError ? (
          <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            Chargement du voyage…
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-ink-2">Le voyage ne s’est pas chargé. Vérifie la connexion puis réessaie.</p>
            <Button onClick={refetch}>Réessayer</Button>
          </div>
        )}
      </>
    )
  }
  if (!trip) return <Navigate to="/voyages" replace />
  const current = tabs.find((t) => t.slug === tab)?.slug
  if (!current) return <Navigate to={`/voyages/${trip.id}/idees`} replace />
  return <TripView trip={trip} data={data} tab={current} />
}

function TripView({ trip, data, tab }: { trip: Trip; data: TripsData; tab: TabSlug }) {
  const { updatedAt, error, dismissError, updateTrip } = useTrips()
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const today = isoDay()
  const hint = countdown(trip, today)
  const suggestion = suggestedStatus(trip, today)
  const n = nightsLabel(nights(trip))

  return (
    <div className="flex flex-col pb-8">
      <ScreenHeader
        title=""
        back="/voyages"
        actions={
          <>
            <LiveBadge />
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Modifier le voyage"
              className="flex size-11 items-center justify-center rounded-pill text-ink hover:bg-surface-2"
            >
              <Ellipsis size={22} />
            </button>
          </>
        }
      />
      <ConnectionBanner updatedAt={updatedAt} />

      <div className="flex flex-col gap-1.5 px-5 pb-3">
        <div className="flex items-center gap-2">
          <StatusPill status={trip.status} />
          {hint ? <span className="font-mono text-xs text-ink-3">{hint}</span> : null}
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-[var(--ls-head)] text-ink">
          {trip.cover_emoji ? <span aria-hidden="true">{trip.cover_emoji} </span> : null}
          {trip.title}
        </h1>
        <p className="text-ink-2">{[formatLongRange(trip.start_date, trip.end_date), n, trip.destination].filter(Boolean).join(' · ')}</p>
        {trip.notes ? <p className="text-sm whitespace-pre-line text-ink-3">{trip.notes}</p> : null}
      </div>

      {suggestion ? (
        <div className="mx-5 mb-3 flex items-center gap-3 rounded-md bg-accent-tint px-4 py-2">
          <p className="flex-1 text-sm text-accent-ink">
            {suggestion === 'ongoing' ? 'Le voyage a commencé.' : suggestion === 'done' ? 'Le voyage est fini.' : 'Les dates sont posées.'}{' '}
            Passer en « {statusLabel[suggestion]} » ?
          </p>
          <button
            type="button"
            onClick={() => updateTrip(trip, { status: suggestion })}
            className="min-h-11 px-2 text-sm font-semibold text-accent-ink"
          >
            Oui
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mx-5 mb-2 flex items-center gap-3 rounded-md bg-bad-tint px-4 py-3 text-bad">
          <p className="flex-1 text-sm">{error}</p>
          <button type="button" onClick={dismissError} className="min-h-11 px-2 text-sm font-semibold">
            Fermer
          </button>
        </div>
      ) : null}

      <nav aria-label="Sections du voyage" className="flex overflow-x-auto border-b border-rule px-3">
        {tabs.map((t) => (
          <Link
            key={t.slug}
            to={`/voyages/${trip.id}/${t.slug}`}
            replace
            aria-current={t.slug === tab ? 'page' : undefined}
            className={cn(
              '-mb-px flex min-h-12 flex-none items-center border-b-2 px-3 text-[15px] font-semibold',
              t.slug === tab ? 'border-accent-ink text-accent-ink' : 'border-transparent text-ink-3',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="pt-2">
        {tab === 'idees' ? <IdeasTab trip={trip} data={data} /> : null}
        {tab === 'checklist' ? <PrepTab trip={trip} data={data} /> : null}
        {tab === 'reservations' ? <BookingsTab trip={trip} data={data} /> : null}
        {tab === 'budget' ? <BudgetTab trip={trip} data={data} /> : null}
      </div>

      <TripSheet
        open={editing}
        trip={trip}
        onClose={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        onRemoved={() => {
          setEditing(false)
          navigate('/voyages', { replace: true })
        }}
      />
    </div>
  )
}
