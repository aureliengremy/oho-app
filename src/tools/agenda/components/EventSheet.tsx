import { MapPin } from 'lucide-react'
import { Sheet } from '@/core/ui/Sheet'
import { whenLabel, type AgendaEvent } from '../model'

/** Fiche d'un événement, en lecture : il se modifie dans Google Agenda. */
export function EventSheet({ event, zone, onClose }: { event: AgendaEvent | null; zone: string; onClose: () => void }) {
  return (
    <Sheet open={event !== null} onClose={onClose} title={event?.title ?? ''} eyebrow="Agenda Google">
      {event ? (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-ink-2 first-letter:uppercase">{whenLabel(event, zone)}</p>
          {event.location ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noreferrer"
              className="-mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold text-accent-ink hover:bg-accent-tint"
            >
              <MapPin size={18} aria-hidden="true" className="flex-none" />
              <span className="min-w-0 break-words">{event.location}</span>
            </a>
          ) : null}
          {event.description ? <p className="whitespace-pre-line break-words text-ink">{event.description}</p> : null}
          <p className="text-sm text-ink-3">Pour le modifier, passe par Google Agenda : OhO l’affichera à la prochaine mise à jour.</p>
        </div>
      ) : null}
    </Sheet>
  )
}
