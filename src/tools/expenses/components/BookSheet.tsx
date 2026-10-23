import { useState, type FormEvent } from 'react'
import { COMMON_CURRENCIES } from '@/core/lib/money'
import { Button } from '@/core/ui/Button'
import { Field, SelectField } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import { useExpenses } from '../useExpenses'
import type { Book } from '../model'

/** Créer ou régler un carnet : nom, devise des soldes, voyage lié (au plus un carnet par voyage, M18). */
export function BookSheet({ open, book, onClose, onSaved }: { open: boolean; book?: Book; onClose: () => void; onSaved?: (id: string | null) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={book ? book.name : 'Nouveau carnet'} eyebrow={book ? 'Réglages du carnet' : 'Dépenses'} focusField={!book}>
      {open ? <BookForm key={book?.id ?? 'nouveau'} book={book} onSaved={(id) => (onSaved ?? onClose)(id)} /> : null}
    </Sheet>
  )
}

function BookForm({ book, onSaved }: { book?: Book; onSaved: (id: string | null) => void }) {
  const { data, addBook, updateBook, removeBook } = useExpenses()
  const [name, setName] = useState(book?.name ?? '')
  const [currency, setCurrency] = useState(book?.currency ?? 'CAD')
  const [tripId, setTripId] = useState(book?.trip_id ?? '')
  const [confirming, setConfirming] = useState(false)
  const count = book ? (data?.expenses.filter((e) => e.book_id === book.id).length ?? 0) : 0
  const taken = new Set((data?.books ?? []).filter((b) => b.id !== book?.id).map((b) => b.trip_id))
  const trips = (data?.trips ?? []).filter((t) => !taken.has(t.id))
  const invalid = name.trim() === '' || !/^[A-Z]{3}$/.test(currency)
  const currencies = [...new Set([currency, ...COMMON_CURRENCIES])]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (invalid) return
    const fields = { name: name.trim(), currency, trip_id: tripId || null }
    if (book) {
      updateBook(book, fields)
      onSaved(book.id)
    } else onSaved(addBook(fields))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quotidien, Lisbonne…" maxLength={60} />
      <SelectField
        label="Devise des soldes"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        disabled={count > 0}
        options={currencies.map((c) => ({ value: c, label: c }))}
      />
      {count > 0 ? <p className="-mt-2 text-sm text-ink-3">La devise ne change plus une fois des dépenses saisies.</p> : null}
      <SelectField
        label="Voyage lié"
        value={tripId}
        onChange={(e) => setTripId(e.target.value)}
        options={[{ value: '', label: 'Aucun' }, ...trips.map((t) => ({ value: t.id, label: `${t.cover_emoji ?? ''} ${t.title}`.trim() }))]}
      />
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={invalid}>
          {book ? 'Enregistrer' : 'Créer le carnet'}
        </Button>
        {book ? (
          <Button
            variant="ghost"
            className="text-bad hover:bg-bad-tint"
            onClick={() => {
              if (!confirming) return setConfirming(true)
              removeBook(book)
              onSaved(null)
            }}
          >
            {confirming ? `Confirmer : supprimer avec ${count} dépense${count > 1 ? 's' : ''}` : 'Supprimer le carnet'}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
