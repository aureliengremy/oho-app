import { useState } from 'react'
import { BriefcaseBusiness, Plus } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { ConnectionBanner, LiveBadge } from '@/core/sync/ConnectionStatus'
import { Button } from '@/core/ui/Button'
import { StatusPill } from './components/StatusPill'
import { TripSheet } from './components/TripSheet'
import { countdown, dDay, formatDateRange, groupLabel, groupTrips, isoDay, nights, nightsLabel, statusLabel, type Trip, type TripStatus } from './model'
import { useTrips } from './useTrips'

const filters: (TripStatus | 'all')[] = ['all', 'idea', 'planned', 'ongoing', 'done']

/** Liste des voyages, groupés par moment plutôt que par statut. */
export function TripsListScreen() {
  const { data, isPending, isError, refetch, updatedAt } = useTrips()
  const [params] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const filter = (params.get('statut') as TripStatus | null) ?? 'all'

  if (isPending || isError || !data) {
    return (
      <>
        <ScreenHeader title="Voyages" />
        {isPending ? (
          <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            Chargement des voyages…
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-ink-2">Les voyages ne se sont pas chargés. Vérifie la connexion puis réessaie.</p>
            <Button onClick={refetch}>Réessayer</Button>
          </div>
        )}
      </>
    )
  }

  const today = isoDay()
  const shown = filter === 'all' ? data.trips : data.trips.filter((t) => t.status === filter)
  const groups = groupTrips(shown, today)
  const count = (f: TripStatus | 'all') => (f === 'all' ? data.trips.length : data.trips.filter((t) => t.status === f).length)

  return (
    <div className="flex flex-col pb-24">
      <ScreenHeader title="Voyages" actions={<LiveBadge />} />
      <ConnectionBanner updatedAt={updatedAt} />

      {data.trips.length > 0 ? (
        <nav aria-label="Filtrer par statut" className="flex gap-2 overflow-x-auto px-5 pt-1 pb-2">
          {filters.map((f) => (
            <Link
              key={f}
              to={f === 'all' ? '/voyages' : `/voyages?statut=${f}`}
              replace
              aria-current={filter === f ? 'page' : undefined}
              className={cn(
                'flex min-h-11 flex-none items-center gap-2 rounded-pill border px-4 text-[15px] font-semibold',
                filter === f ? 'border-accent-ink bg-accent-tint text-accent-ink' : 'border-rule text-ink-2',
              )}
            >
              {f === 'all' ? 'Tous' : statusLabel[f]}
              <span className="font-mono text-xs tabular-nums">{count(f)}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {data.trips.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent-ink">
            <BriefcaseBusiness size={24} aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-semibold text-ink">Pas encore de voyage</h2>
          <p className="text-ink-2">Notez une idée, même sans dates : elle attendra dans « Un jour ».</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="px-5 py-6 text-ink-2">Aucun voyage avec ce statut.</p>
      ) : (
        groups.map(({ group, trips }) => (
          <section key={group} aria-label={groupLabel[group]} className="px-5">
            <h2 className="pt-4 pb-2 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">{groupLabel[group]}</h2>
            <ul className="flex flex-col gap-2">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} today={today} />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] z-10">
        <Button onClick={() => setCreating(true)} className="shadow-lg">
          <Plus size={18} aria-hidden="true" />
          Voyage
        </Button>
      </div>

      <TripSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => {
          setCreating(false)
          navigate(`/voyages/${id}`)
        }}
      />
    </div>
  )
}

function TripCard({ trip, today }: { trip: Trip; today: string }) {
  const n = nightsLabel(nights(trip))
  const detail = [formatDateRange(trip.start_date, trip.end_date), n ?? trip.destination].filter(Boolean).join(' · ')
  const hint = trip.status === 'ongoing' ? countdown(trip, today) : trip.status === 'planned' ? dDay(trip, today) : null
  return (
    <li>
      <Link
        to={`/voyages/${trip.id}`}
        className="flex min-h-[72px] items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 hover:bg-card focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-md bg-surface text-2xl">
          {trip.cover_emoji || '🧳'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-ink">{trip.title}</span>
          <span className="truncate text-sm text-ink-3">{detail}</span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          <StatusPill status={trip.status} />
          {hint ? <span className="font-mono text-xs text-ink-3">{hint}</span> : null}
        </span>
      </Link>
    </li>
  )
}
