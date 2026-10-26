import { MapPin } from 'lucide-react'
import { timeLabel, type AgendaEvent } from '../model'

/** Une ligne d'événement : l'heure à gauche (mono), le titre et le lieu. */
export function EventRow({ event, day, zone, onOpen }: { event: AgendaEvent; day: string; zone: string; onOpen: (event: AgendaEvent) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(event)}
        className="flex min-h-[52px] w-full items-center gap-3 rounded-lg bg-surface-2 px-4 py-2 text-left hover:bg-card focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="w-20 flex-none font-mono text-sm text-ink-3 tabular-nums">{timeLabel(event, day, zone)}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-ink">{event.title}</span>
          {event.location ? (
            <span className="flex items-center gap-1 truncate text-sm text-ink-3">
              <MapPin size={13} aria-hidden="true" className="flex-none" />
              <span className="truncate">{event.location}</span>
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}
