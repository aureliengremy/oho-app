import { Link } from 'react-router'
import { useClient } from '@/core/client'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { useLiveQuery } from '@/core/sync/SyncProvider'
import { StatusPill } from './components/StatusPill'
import { countdown, formatDateRange, isoDay, nextTrip, progress } from './model'
import { fetchTrips, TRIP_TABLES, tripsKey } from './queries'

/** Carte « Prochain voyage » de l'accueil : celui en cours ou le plus proche, et sa préparation. */
export default function TripsHomeCard() {
  const client = useClient()
  const { household } = useHousehold()
  const query = useLiveQuery({ tables: TRIP_TABLES, queryKey: tripsKey(household.id), queryFn: () => fetchTrips(client, household.id) })
  if (!query.data) return null
  const today = isoDay()
  const trip = nextTrip(query.data.trips, today)
  if (!trip) return null
  const list = query.data.prepLists.find((l) => l.trip_id === trip.id)
  const prep = list ? progress(query.data.prepItems.filter((i) => i.checklist_id === list.id)) : null
  const hint = countdown(trip, today)

  return (
    <section aria-labelledby="prochain-voyage" className="flex flex-col gap-2">
      <h2 id="prochain-voyage" className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
        {trip.status === 'ongoing' ? 'VOYAGE EN COURS' : 'PROCHAIN VOYAGE'}
      </h2>
      <Link
        to={`/voyages/${trip.id}`}
        className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4 hover:bg-card focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-md bg-surface text-2xl">
            {trip.cover_emoji || '🧳'}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-display text-xl font-semibold text-ink">{trip.title}</span>
            <span className="text-sm text-ink-3">{[formatDateRange(trip.start_date, trip.end_date), hint].filter(Boolean).join(' · ')}</span>
          </span>
          <StatusPill status={trip.status} />
        </span>
        {prep && prep.total > 0 ? (
          <span className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">Checklist de préparation</span>
              <span className="font-mono text-ink-3 tabular-nums">
                {prep.done} / {prep.total}
              </span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-pill bg-surface" aria-hidden="true">
              <span className="block h-full rounded-pill bg-accent" style={{ width: `${prep.percent}%` }} />
            </span>
          </span>
        ) : null}
      </Link>
    </section>
  )
}
