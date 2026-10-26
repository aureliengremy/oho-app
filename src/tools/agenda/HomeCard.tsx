import { useState } from 'react'
import { Link } from 'react-router'
import { useHousehold } from '@/core/household/useHousehold'
import { EventRow } from './components/EventRow'
import { EventSheet } from './components/EventSheet'
import { addDays, dayLabel, firstEvents, groupByDay, LIST_DAYS, todayIn, type AgendaEvent } from './model'
import { useAgenda } from './useAgenda'

/** Au plus, sur l'accueil ; le reste est dans l'agenda. */
const MAX_EVENTS = 6

/** Carte « Cette semaine » de l'accueil : les sept prochains jours de l'agenda Google commun. */
export default function AgendaHomeCard() {
  const zone = useHousehold().household.timezone
  const today = todayIn(zone)
  // Même période que la liste de l'agenda : une seule lecture pour les deux écrans.
  const agenda = useAgenda(today, addDays(today, LIST_DAYS))
  const [opened, setOpened] = useState<AgendaEvent | null>(null)
  // Agenda pas encore relié ou injoignable : l'accueil n'en parle pas, l'écran Agenda l'explique.
  if (!agenda.data) return null

  const { shown, hidden } = firstEvents(groupByDay(agenda.data.events, zone, today, addDays(today, 7)), MAX_EVENTS)

  return (
    <section aria-labelledby="cette-semaine" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id="cette-semaine" className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
          Cette semaine
        </h2>
        <Link to="/agenda" className="-mx-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-accent-ink">
          {hidden > 0 ? `Voir l’agenda (+${hidden})` : 'Voir l’agenda'}
        </Link>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-4 py-4 text-ink-2">Rien de prévu dans les sept prochains jours.</p>
      ) : (
        shown.map(({ day, events }) => (
          <div key={day} className="flex flex-col gap-1.5">
            <h3 className="pt-1 text-sm font-semibold text-ink-2">{dayLabel(day, today)}</h3>
            <ul className="flex flex-col gap-1.5">
              {events.map((event) => (
                <EventRow key={event.id} event={event} day={day} zone={zone} onOpen={setOpened} />
              ))}
            </ul>
          </div>
        ))
      )}
      <EventSheet event={opened} zone={zone} onClose={() => setOpened(null)} />
    </section>
  )
}
