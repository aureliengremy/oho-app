import { useState, type FormEvent } from 'react'
import { Button } from '@/core/ui/Button'
import { Field, SelectField, TextAreaField } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import { statusLabel, type Trip, type TripStatus } from '../model'
import { useTrips } from '../useTrips'

const statusOptions = (Object.keys(statusLabel) as TripStatus[]).map((value) => ({ value, label: statusLabel[value] }))

/** Créer un voyage, ou modifier et supprimer celui passé en `trip`. */
export function TripSheet({
  open,
  trip,
  onClose,
  onSaved,
  onRemoved,
}: {
  open: boolean
  trip?: Trip
  onClose: () => void
  onSaved?: (id: string) => void
  onRemoved?: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={trip ? trip.title : 'Nouveau voyage'} eyebrow="Voyage" focusField={!trip}>
      {open ? <TripForm key={trip?.id ?? 'nouveau'} trip={trip} onSaved={onSaved ?? onClose} onRemoved={onRemoved} /> : null}
    </Sheet>
  )
}

function TripForm({ trip, onSaved, onRemoved }: { trip?: Trip; onSaved: (id: string) => void; onRemoved?: () => void }) {
  const { createTrip, updateTrip, removeTrip } = useTrips()
  const [title, setTitle] = useState(trip?.title ?? '')
  const [emoji, setEmoji] = useState(trip?.cover_emoji ?? '')
  const [destination, setDestination] = useState(trip?.destination ?? '')
  const [start, setStart] = useState(trip?.start_date ?? '')
  const [end, setEnd] = useState(trip?.end_date ?? '')
  const [status, setStatus] = useState<TripStatus>(trip?.status ?? 'idea')
  const [notes, setNotes] = useState(trip?.notes ?? '')
  const [confirming, setConfirming] = useState(false)
  const datesInvalid = Boolean(start && end && end < start)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || datesInvalid) return
    const fields = {
      title: trimmed,
      cover_emoji: emoji.trim() || null,
      destination: destination.trim() || null,
      start_date: start || null,
      end_date: end || null,
      // Des dates sans statut choisi : le voyage devient planifié.
      status: !trip && status === 'idea' && start ? ('planned' as const) : status,
      notes: notes.trim() || null,
    }
    if (trip) {
      updateTrip(trip, fields)
      onSaved(trip.id)
    } else onSaved(createTrip(fields))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-[72px_1fr] gap-3">
        <Field label="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={16} placeholder="🧳" className="text-center" />
        <Field label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} placeholder="Lisbonne & Porto" />
      </div>
      <Field label="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={120} placeholder="Portugal" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Départ" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Field label="Retour" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {datesInvalid ? (
        <p role="alert" className="rounded-md bg-bad-tint px-4 py-2 text-sm text-bad">
          Le retour doit suivre le départ.
        </p>
      ) : null}
      <SelectField label="Statut" value={status} onChange={(e) => setStatus(e.target.value as TripStatus)} options={statusOptions} />
      <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={datesInvalid}>
          {trip ? 'Enregistrer' : 'Créer le voyage'}
        </Button>
        {trip ? (
          confirming ? (
            <Button
              variant="ghost"
              className="bg-bad-tint text-bad hover:bg-bad-tint"
              onClick={() => {
                removeTrip(trip)
                onRemoved?.()
              }}
            >
              Supprimer « {trip.title} » et tout son contenu
            </Button>
          ) : (
            <Button variant="ghost" className="text-bad hover:bg-bad-tint" onClick={() => setConfirming(true)}>
              Supprimer le voyage
            </Button>
          )
        ) : null}
      </div>
    </form>
  )
}
