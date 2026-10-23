import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { Button } from '@/core/ui/Button'
import { Field } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import type { Category } from './model'
import { useShopping } from './useShopping'

/** Ordre des rayons, commun à l'espace (décision M6) : monter, descendre, renommer, ajouter. */
export function CategoriesScreen() {
  const { data, error, dismissError, createCategory, moveCategory } = useShopping()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)

  const categories = [...(data?.categories ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const counts = new Map<string, number>()
  for (const item of data?.items ?? [])
    if (!item.checked && item.category_id) counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createCategory(trimmed)
    setName('')
  }

  return (
    <>
      <ScreenHeader title="Ordre des rayons" eyebrow="Courses" back />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <p className="text-ink-2">
          Rangez les rayons dans l’ordre où vous marchez dans le magasin. Toutes les listes suivent cet ordre.
        </p>
        {error ? (
          <div role="alert" className="flex items-center gap-3 rounded-md bg-bad-tint px-4 py-3 text-bad">
            <p className="flex-1 text-sm">{error}</p>
            <button type="button" onClick={dismissError} className="min-h-11 px-2 text-sm font-semibold">
              Fermer
            </button>
          </div>
        ) : null}
        {!data ? (
          <p role="status" className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            Chargement des rayons…
          </p>
        ) : null}
        <ol aria-label="Rayons" className="flex flex-col gap-1">
          {categories.map((c, index) => (
            <li key={c.id} className="flex min-h-14 items-center gap-1 rounded-md bg-surface-2 pl-3">
              <span className="w-7 font-mono text-xs text-ink-3 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
              <button
                type="button"
                onClick={() => setEditing(c)}
                aria-label={`Modifier le rayon ${c.name}`}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left text-ink"
              >
                <span className="truncate">{c.name}</span>
                <span className="font-mono text-xs text-ink-3 tabular-nums" aria-label={`${counts.get(c.id) ?? 0} à acheter`}>
                  {counts.get(c.id) ?? 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => moveCategory(c, -1)}
                disabled={index === 0}
                aria-label={`Monter ${c.name}`}
                className="flex size-11 items-center justify-center rounded-pill text-ink-2 disabled:opacity-30"
              >
                <ArrowUp size={20} />
              </button>
              <button
                type="button"
                onClick={() => moveCategory(c, 1)}
                disabled={index === categories.length - 1}
                aria-label={`Descendre ${c.name}`}
                className="flex size-11 items-center justify-center rounded-pill text-ink-2 disabled:opacity-30"
              >
                <ArrowDown size={20} />
              </button>
            </li>
          ))}
        </ol>
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Nouveau rayon" value={name} onChange={(e) => setName(e.target.value)} placeholder="Boissons, Bébé…" maxLength={60} />
          </div>
          <Button type="submit" aria-label="Ajouter le rayon" className="w-12 px-0">
            <Plus size={20} />
          </Button>
        </form>
      </div>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.name ?? ''} eyebrow="Rayon">
        {editing ? <CategoryForm key={editing.id} category={editing} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  )
}

function CategoryForm({ category, onDone }: { category: Category; onDone: () => void }) {
  const { renameCategory, removeCategory } = useShopping()
  const [name, setName] = useState(category.name)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed && trimmed !== category.name) renameCategory(category, trimmed)
    onDone()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nom du rayon" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      <p className="text-sm text-ink-3">Supprimer un rayon range ses articles dans « Sans rayon ».</p>
      <div className="flex flex-col gap-2">
        <Button type="submit">Enregistrer</Button>
        <Button
          variant="ghost"
          className="text-bad hover:bg-bad-tint"
          onClick={() => {
            removeCategory(category)
            onDone()
          }}
        >
          Supprimer le rayon
        </Button>
      </div>
    </form>
  )
}
