import { useRef, useState, type ChangeEvent } from 'react'
import { BedDouble, Car, FileText, Paperclip, Pencil, Plane, Plus, Ticket, TrainFront, Tag, Wallet, X, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { formatZoned, zoneName } from '@/core/lib/zoned'
import { Button } from '@/core/ui/Button'
import { BookingSheet } from '../components/BookingSheet'
import { bookingKindLabel, formatMoney, formatSize, type Attachment, type Booking, type BookingKind, type Trip, type TripsData } from '../model'
import { useTrips } from '../TripsProvider'

const kindIcon: Record<BookingKind, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  lodging: BedDouble,
  car: Car,
  activity: Ticket,
  other: Tag,
}

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone

/** Onglet Réservations : vols, logements et billets, dans l'ordre du voyage, avec leurs pièces jointes. */
export function BookingsTab({ trip, data }: { trip: Trip; data: TripsData }) {
  const [editing, setEditing] = useState<Booking | 'new' | null>(null)
  const bookings = data.bookings
    .filter((b) => b.trip_id === trip.id)
    .sort((a, b) => (a.starts_at ?? '9999').localeCompare(b.starts_at ?? '9999'))

  return (
    <div className="flex flex-col gap-3 px-5 pt-2">
      {bookings.length === 0 ? (
        <p className="py-4 text-center text-ink-2">Les vols, le logement et les billets, avec leurs confirmations en pièce jointe.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Réservations">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              attachments={data.attachments.filter((a) => a.entity_id === booking.id)}
              onEdit={() => setEditing(booking)}
            />
          ))}
        </ul>
      )}
      <Button variant="secondary" onClick={() => setEditing('new')}>
        <Plus size={18} aria-hidden="true" />
        Ajouter une réservation
      </Button>
      <BookingSheet
        tripId={trip.id}
        booking={editing === 'new' ? undefined : (editing ?? undefined)}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function When({ label, iso, tz }: { label: string; iso: string; tz: string }) {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[11.5px] tracking-[var(--ls-eyebrow)] text-ink-3">{label.toUpperCase()}</dt>
      <dd className="text-ink">
        {formatZoned(iso, tz)}
        {tz !== deviceZone ? <span className="text-ink-3"> · {zoneName(tz)}</span> : null}
      </dd>
    </div>
  )
}

function BookingCard({ booking, attachments, onEdit }: { booking: Booking; attachments: Attachment[]; onEdit: () => void }) {
  const { household, activations } = useHousehold()
  const expensesOn = activations.some((a) => a.tool_key === 'expenses' && a.enabled)
  const { attach, removeAttachment, signedUrl } = useTrips()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const Icon = kindIcon[booking.kind]
  const tz = booking.tz ?? household.timezone

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setProblem(null)
    try {
      await attach(booking, file)
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : 'Le fichier n’a pas été envoyé.')
    } finally {
      setBusy(false)
    }
  }

  const open = async (attachment: Attachment) => {
    // Ouvert tout de suite pour ne pas être bloqué comme une fenêtre surgissante, puis dirigé vers l'URL signée.
    const tab = window.open('', '_blank')
    try {
      const url = await signedUrl(attachment)
      if (tab) tab.location.href = url
      else window.location.assign(url)
    } catch (cause) {
      tab?.close()
      setProblem(cause instanceof Error ? cause.message : 'La pièce jointe ne s’ouvre pas.')
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-md bg-accent-tint text-accent-ink">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-semibold text-ink">{booking.title}</h3>
          <p className="text-sm text-ink-3">
            {[bookingKindLabel[booking.kind], booking.amount !== null && booking.currency ? formatMoney(booking.amount, booking.currency) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Modifier ${booking.title}`}
          className="-mt-2 -mr-2 flex size-11 items-center justify-center rounded-pill text-ink-2 hover:bg-card"
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
      </div>

      {booking.starts_at || booking.ends_at || booking.reference ? (
        <dl className="grid grid-cols-1 gap-2 text-[15px]">
          {booking.starts_at ? <When label={booking.kind === 'lodging' ? 'Arrivée' : 'Départ'} iso={booking.starts_at} tz={tz} /> : null}
          {booking.ends_at ? <When label={booking.kind === 'lodging' ? 'Départ' : 'Arrivée'} iso={booking.ends_at} tz={tz} /> : null}
          {booking.reference ? (
            <div className="flex flex-col">
              <dt className="font-mono text-[11.5px] tracking-[var(--ls-eyebrow)] text-ink-3">RÉF.</dt>
              <dd className="font-mono text-ink select-all">{booking.reference}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {booking.note ? <p className="text-sm whitespace-pre-line text-ink-2">{booking.note}</p> : null}
      {booking.url ? (
        <a href={booking.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-sm font-semibold text-accent-ink">
          Ouvrir la réservation en ligne
        </a>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label={`Pièces jointes de ${booking.title}`}>
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-1 rounded-md bg-surface">
              <button type="button" onClick={() => open(a)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 text-left">
                <FileText size={18} aria-hidden="true" className="flex-none text-accent-ink" />
                <span className="truncate text-[15px] text-ink">{a.file_name}</span>
                <span className="flex-none font-mono text-xs text-ink-3">{formatSize(a.size_bytes)}</span>
              </button>
              <button
                type="button"
                onClick={() => removeAttachment(a)}
                aria-label={`Retirer ${a.file_name}`}
                className="flex size-11 flex-none items-center justify-center rounded-md text-ink-3 hover:text-bad"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {problem ? (
        <p role="alert" className="rounded-md bg-bad-tint px-3 py-2 text-sm text-bad">
          {problem}
        </p>
      ) : null}
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={upload} />
      <div className="flex flex-wrap gap-x-5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex min-h-11 items-center gap-2 rounded-pill px-1 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          <Paperclip size={16} aria-hidden="true" />
          {busy ? 'Envoi…' : 'Joindre un fichier'}
        </button>
        {/* Simple lien vers l'outil Dépenses : il lit la réservation lui-même (un outil n'importe pas un autre). */}
        {expensesOn ? (
          <Link
            to={`/depenses/voyage/${booking.trip_id}?reservation=${booking.id}`}
            aria-label={`Créer la dépense de ${booking.title}`}
            className="flex min-h-11 items-center gap-2 rounded-pill px-1 text-sm font-semibold text-accent-ink"
          >
            <Wallet size={16} aria-hidden="true" />
            Créer la dépense
          </Link>
        ) : null}
      </div>
    </li>
  )
}
