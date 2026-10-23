import { useState, type FormEvent } from 'react'
import { ListChecks } from 'lucide-react'
import { ItemRow } from '@/core/checklist/ItemRow'
import { Button } from '@/core/ui/Button'
import { Field } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import { AddBar } from '@/core/ui/AddBar'
import { progress, type PrepItem, type Trip, type TripsData } from '../model'
import { useTrips } from '../TripsProvider'

/** Onglet Checklist : la préparation du voyage, même mécanique que les courses (M8 : une par voyage). */
export function PrepTab({ trip, data }: { trip: Trip; data: TripsData }) {
  const { createPrepList, addPrepItems, togglePrepItem } = useTrips()
  const [editing, setEditing] = useState<PrepItem | null>(null)
  const [announce, setAnnounce] = useState('')
  const list = data.prepLists.find((l) => l.trip_id === trip.id)

  if (!list) {
    return (
      <div className="flex flex-col items-center gap-3 px-8 py-8 text-center">
        <ListChecks size={22} aria-hidden="true" className="text-ink-3" />
        <p className="text-ink-2">Passeports, adaptateur, réserver le chat-sitter : tout ce qu’il faut avant de partir.</p>
        <Button onClick={() => createPrepList(trip)}>Créer la checklist</Button>
      </div>
    )
  }

  const items = data.prepItems.filter((i) => i.checklist_id === list.id)
  const sorted = [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)]
  const { done, total, percent } = progress(items)

  return (
    <div className="flex flex-col">
      {total > 0 ? (
        <div className="flex flex-col gap-2 px-5 pt-2 pb-1">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold text-ink">Prêt à {percent} %</p>
            <p className="font-mono text-sm text-ink-3 tabular-nums">
              {done} / {total}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Préparation"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded-pill bg-surface-2"
          >
            <div className="h-full rounded-pill bg-accent" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}
      <AddBar
        label="Ajouter à la checklist"
        placeholder="Ajouter : passeports, adaptateur…"
        onAdd={(text) => {
          const n = addPrepItems(list.id, text)
          setAnnounce(n === 0 ? 'Déjà dans la checklist' : n === 1 ? '1 élément ajouté' : `${n} éléments ajoutés`)
        }}
      />
      <ul aria-label="Checklist de préparation">
        {sorted.map((item) => (
          <ItemRow key={item.id} item={item} onToggle={() => togglePrepItem(item)} onEdit={() => setEditing(item)} />
        ))}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.label ?? ''} eyebrow="Préparation">
        {editing ? <PrepItemForm key={editing.id} item={editing} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </div>
  )
}

function PrepItemForm({ item, onDone }: { item: PrepItem; onDone: () => void }) {
  const { updatePrepItem, removePrepItem } = useTrips()
  const [label, setLabel] = useState(item.label)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [note, setNote] = useState(item.note ?? '')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!label.trim()) return
    updatePrepItem(item, { label: label.trim(), quantity: quantity.trim() || null, note: note.trim() || null })
    onDone()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nom" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantité" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="2" />
        <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Button type="submit">Enregistrer</Button>
        <Button
          variant="ghost"
          className="text-bad hover:bg-bad-tint"
          onClick={() => {
            removePrepItem(item)
            onDone()
          }}
        >
          Supprimer
        </Button>
      </div>
    </form>
  )
}
