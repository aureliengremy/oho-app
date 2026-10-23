import { useMemo, useState, type FormEvent } from 'react'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { isoToZoned, timeZones, zonedToIso } from '@/core/lib/zoned'
import { Button } from '@/core/ui/Button'
import { Field, SelectField, TextAreaField } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import { bookingKindLabel, type Booking, type BookingKind } from '../model'
import { useTrips } from '../TripsProvider'

const kindOptions = (Object.keys(bookingKindLabel) as BookingKind[]).map((value) => ({ value, label: bookingKindLabel[value] }))

/** Ajouter ou modifier une réservation. Les heures se saisissent dans le fuseau du lieu. */
export function BookingSheet({ tripId, booking, open, onClose }: { tripId: string; booking?: Booking; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={booking ? booking.title : 'Nouvelle réservation'} eyebrow="Réservation" focusField={!booking}>
      {open ? <BookingForm key={booking?.id ?? 'nouvelle'} tripId={tripId} booking={booking} onDone={onClose} /> : null}
    </Sheet>
  )
}

function BookingForm({ tripId, booking, onDone }: { tripId: string; booking?: Booking; onDone: () => void }) {
  const { household } = useHousehold()
  const { saveBooking, removeBooking } = useTrips()
  const initialZone = booking?.tz ?? household.timezone
  const [kind, setKind] = useState<BookingKind>(booking?.kind ?? 'flight')
  const [title, setTitle] = useState(booking?.title ?? '')
  const [tz, setTz] = useState(initialZone)
  const [starts, setStarts] = useState(booking?.starts_at ? isoToZoned(booking.starts_at, initialZone) : '')
  const [ends, setEnds] = useState(booking?.ends_at ? isoToZoned(booking.ends_at, initialZone) : '')
  const [reference, setReference] = useState(booking?.reference ?? '')
  const [amount, setAmount] = useState(booking?.amount?.toString().replace('.', ',') ?? '')
  const [currency, setCurrency] = useState(booking?.currency ?? 'CAD')
  const [url, setUrl] = useState(booking?.url ?? '')
  const [note, setNote] = useState(booking?.note ?? '')
  const zones = useMemo(() => timeZones().map((z) => ({ value: z, label: z.replace(/_/g, ' ') })), [])

  const parsedAmount = amount.trim() === '' ? null : Number(amount.replace(/\s/g, '').replace(',', '.'))
  const problems = [
    starts && ends && ends < starts ? 'La fin doit suivre le début.' : null,
    parsedAmount !== null && (Number.isNaN(parsedAmount) || parsedAmount < 0) ? 'Le montant n’est pas un nombre.' : null,
    parsedAmount !== null && !/^[A-Za-z]{3}$/.test(currency.trim()) ? 'La devise s’écrit en trois lettres (CAD, EUR…).' : null,
    url.trim() !== '' && !/^https?:\/\//.test(url.trim()) ? 'Le lien doit commencer par https://' : null,
  ].filter(Boolean)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || problems.length > 0) return
    saveBooking(
      tripId,
      {
        kind,
        title: title.trim(),
        tz,
        starts_at: starts ? zonedToIso(starts, tz) : null,
        ends_at: ends ? zonedToIso(ends, tz) : null,
        reference: reference.trim() || null,
        amount: parsedAmount,
        currency: parsedAmount === null ? null : currency.trim().toUpperCase(),
        url: url.trim() || null,
        note: note.trim() || null,
      },
      booking,
    )
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-[130px_1fr] gap-3">
        <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as BookingKind)} options={kindOptions} />
        <Field label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="Vol YUL → LIS" />
      </div>
      <Field label={kind === 'lodging' ? 'Arrivée' : 'Début'} type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
      <Field label={kind === 'lodging' ? 'Départ' : 'Fin'} type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
      <SelectField label="Fuseau des heures" value={tz} onChange={(e) => setTz(e.target.value)} options={zones} />
      <Field label="Référence" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} placeholder="QX7P2M" className="font-mono" />
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Montant" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1 486,00" />
        <Field label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" />
      </div>
      <Field label="Lien" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="boîte à clés, siège…" />
      {problems.length > 0 ? (
        <ul role="alert" className="rounded-md bg-bad-tint px-4 py-2 text-sm text-bad">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={problems.length > 0}>
          {booking ? 'Enregistrer' : 'Ajouter la réservation'}
        </Button>
        {booking ? (
          <Button
            variant="ghost"
            className="text-bad hover:bg-bad-tint"
            onClick={() => {
              removeBooking(booking)
              onDone()
            }}
          >
            Supprimer la réservation
          </Button>
        ) : null}
      </div>
    </form>
  )
}
