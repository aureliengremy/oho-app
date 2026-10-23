import { useState, type FormEvent } from 'react'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { relativeTime } from '@/core/lib/time'
import { Button } from '@/core/ui/Button'
import { Field } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import type { Category, Item } from '../model'
import { useShopping } from '../ShoppingProvider'

/** Modifier un article : libellé, quantité, note, rayon ; ou le supprimer. */
export function ItemSheet({ item, categories, onClose }: { item: Item | null; categories: Category[]; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onClose={onClose} title={item?.label ?? ''} eyebrow="Article">
      {item ? <ItemForm key={item.id} item={item} categories={categories} onDone={onClose} /> : null}
    </Sheet>
  )
}

function ItemForm({ item, categories, onDone }: { item: Item; categories: Category[]; onDone: () => void }) {
  const { updateItem, removeItem } = useShopping()
  const { memberById } = useHousehold()
  const [label, setLabel] = useState(item.label)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [note, setNote] = useState(item.note ?? '')
  const [categoryId, setCategoryId] = useState(item.category_id ?? '')
  const author = memberById(item.created_by)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return
    updateItem(item, {
      label: trimmed,
      quantity: quantity.trim() || null,
      note: note.trim() || null,
      category_id: categoryId || null,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nom" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantité" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="2, 500 g…" />
        <div className="flex flex-col gap-2">
          <label htmlFor="item-category" className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
            RAYON
          </label>
          <select
            id="item-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-h-12 w-full rounded-md border border-transparent bg-surface-2 px-3 text-base text-ink focus:border-accent focus:outline-none"
          >
            <option value="">Sans rayon</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="bien mûrs, marque…" />
      {author ? (
        <p className="text-sm text-ink-3">
          Ajouté par {author.profile.display_name} · {relativeTime(item.created_at)}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="submit">Enregistrer</Button>
        <Button
          variant="ghost"
          className="text-bad hover:bg-bad-tint"
          onClick={() => {
            removeItem(item)
            onDone()
          }}
        >
          Supprimer l’article
        </Button>
      </div>
    </form>
  )
}
