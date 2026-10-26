import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useHousehold } from '@/core/household/useHousehold'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { ConnectionBanner } from '@/core/sync/ConnectionStatus'
import { Button } from '@/core/ui/Button'
import { EventRow } from './components/EventRow'
import { EventSheet } from './components/EventSheet'
import {
  addDays,
  dayLabel,
  eventDays,
  gridRange,
  groupByDay,
  LIST_DAYS,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
  todayIn,
  WEEKDAYS,
  type AgendaEvent,
} from './model'
import { AgendaError } from './queries'
import { useAgenda } from './useAgenda'
import { usePullToRefresh } from './usePullToRefresh'

type View = 'liste' | 'mois'

const clock = new Intl.DateTimeFormat('fr-CA', { hour: 'numeric', minute: '2-digit' })

/** Agenda Google commun, en lecture : la liste des jours à venir ou la grille d'un mois. */
export function AgendaScreen() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('vue') === 'mois' ? 'mois' : 'liste'
  const [opened, setOpened] = useState<AgendaEvent | null>(null)
  // Les jours se comptent dans le fuseau de l'espace, comme côté serveur.
  const zone = useHousehold().household.timezone
  const today = todayIn(zone)
  const month = /^\d{4}-\d{2}$/.test(params.get('mois') ?? '') ? (params.get('mois') as string) : monthOf(today)
  const range = view === 'mois' ? gridRange(month) : { from: today, to: addDays(today, LIST_DAYS) }
  const agenda = useAgenda(range.from, range.to)
  const { pull, ready } = usePullToRefresh(agenda.refresh)

  const setView = (next: View) =>
    setParams((p) => {
      if (next === 'mois') p.set('vue', 'mois')
      else {
        p.delete('vue')
        p.delete('mois')
      }
      return p
    }, { replace: true })

  return (
    <div className="flex flex-col pb-24">
      <ScreenHeader
        title="Agenda"
        actions={
          <button
            type="button"
            onClick={() => void agenda.refresh()}
            disabled={agenda.isFetching}
            aria-label="Actualiser l’agenda"
            className="flex size-11 items-center justify-center rounded-pill text-accent-ink hover:bg-accent-tint disabled:opacity-60"
          >
            <RefreshCw size={20} aria-hidden="true" className={cn(agenda.isFetching && 'animate-spin')} />
          </button>
        }
      />
      <ConnectionBanner updatedAt={agenda.dataUpdatedAt || undefined} />

      {pull > 0 ? (
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-ink-3" style={{ height: pull }}>
          <RefreshCw size={16} aria-hidden="true" style={{ transform: `rotate(${pull * 3}deg)` }} />
          {ready ? 'Relâche pour actualiser' : 'Tire pour actualiser'}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 px-5 pt-1 pb-2">
        <div role="radiogroup" aria-label="Affichage" className="flex rounded-pill bg-surface-2 p-1">
          {(['liste', 'mois'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn('min-h-11 flex-1 rounded-pill text-sm font-semibold', view === v ? 'bg-accent-ink text-surface' : 'text-ink-2')}
            >
              {v === 'liste' ? 'Liste' : 'Mois'}
            </button>
          ))}
        </div>
        {agenda.data ? (
          <p className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            Agenda Google · lu à {clock.format(new Date(agenda.data.fetched_at))}
          </p>
        ) : null}
      </div>

      {agenda.isPending ? (
        <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
          Chargement de l’agenda…
        </p>
      ) : !agenda.data ? (
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          <p className="text-ink-2">
            {agenda.error instanceof AgendaError ? agenda.error.message : 'L’agenda ne s’est pas chargé. Vérifie la connexion puis réessaie.'}
          </p>
          <Button onClick={() => void agenda.refresh()}>Réessayer</Button>
        </div>
      ) : view === 'liste' ? (
        <ListView events={agenda.data.events} zone={zone} today={today} onOpen={setOpened} />
      ) : (
        <MonthView
          events={agenda.data.events}
          zone={zone}
          today={today}
          month={month}
          onMonth={(m) => setParams((p) => (p.set('mois', m), p), { replace: true })}
          onOpen={setOpened}
        />
      )}

      <EventSheet event={opened} zone={zone} onClose={() => setOpened(null)} />
    </div>
  )
}

function ListView({ events, zone, today, onOpen }: { events: AgendaEvent[]; zone: string; today: string; onOpen: (e: AgendaEvent) => void }) {
  const days = groupByDay(events, zone, today, addDays(today, LIST_DAYS))
  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent-ink">
          <CalendarDays size={24} aria-hidden="true" />
        </span>
        <h2 className="font-display text-xl font-semibold text-ink">Rien de prévu</h2>
        <p className="text-ink-2">Aucun événement dans les {LIST_DAYS} prochains jours. Ajoutez-en dans Google Agenda.</p>
      </div>
    )
  }
  return days.map(({ day, events: list }) => (
    <section key={day} aria-label={dayLabel(day, today)} className="px-5">
      <h2 className={cn('pt-4 pb-2 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase', day === today ? 'text-accent-ink' : 'text-ink-3')}>
        {dayLabel(day, today)}
      </h2>
      <ul className="flex flex-col gap-2">
        {list.map((event) => (
          <EventRow key={event.id} event={event} day={day} zone={zone} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  ))
}

function MonthView({
  events,
  zone,
  today,
  month,
  onMonth,
  onOpen,
}: {
  events: AgendaEvent[]
  zone: string
  today: string
  month: string
  onMonth: (month: string) => void
  onOpen: (e: AgendaEvent) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const selected = picked && monthOf(picked) === month ? picked : monthOf(today) === month ? today : `${month}-01`
  const counts = new Map<string, number>()
  for (const event of events) for (const day of eventDays(event, zone)) counts.set(day, (counts.get(day) ?? 0) + 1)
  const dayEvents = groupByDay(events, zone, selected, addDays(selected, 1))[0]?.events ?? []
  const long = new Intl.DateTimeFormat('fr-CA', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-4 px-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(shiftMonth(month, -1))}
          aria-label="Mois précédent"
          className="-ml-3 flex size-11 items-center justify-center rounded-pill text-ink hover:bg-surface-2"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h2 className="font-display text-xl font-semibold text-ink" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <button
          type="button"
          onClick={() => onMonth(shiftMonth(month, 1))}
          aria-label="Mois suivant"
          className="-mr-3 flex size-11 items-center justify-center rounded-pill text-ink hover:bg-surface-2"
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="pb-1 font-mono text-[11px] font-normal tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const count = counts.get(day) ?? 0
                const inMonth = monthOf(day) === month
                const label = `${long.format(new Date(`${day}T00:00:00Z`))}${count ? `, ${count} événement${count > 1 ? 's' : ''}` : ''}`
                return (
                  <td key={day} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => (inMonth ? setPicked(day) : onMonth(monthOf(day)))}
                      aria-label={label}
                      aria-pressed={day === selected}
                      aria-current={day === today ? 'date' : undefined}
                      className={cn(
                        'flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-md text-sm tabular-nums',
                        inMonth ? 'text-ink' : 'text-ink-3',
                        day === today && 'bg-accent-tint font-semibold text-accent-ink',
                        day === selected && 'outline-2 -outline-offset-2 outline-accent-ink',
                      )}
                    >
                      {Number(day.slice(8))}
                      <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                          <span key={i} className="size-1.5 rounded-pill bg-accent" />
                        ))}
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-label={dayLabel(selected, today)} className="flex flex-col gap-2">
        <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">{dayLabel(selected, today)}</h2>
        {dayEvents.length === 0 ? (
          <p className="text-ink-2">Rien de prévu ce jour-là.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayEvents.map((event) => (
              <EventRow key={event.id} event={event} day={selected} zone={zone} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
