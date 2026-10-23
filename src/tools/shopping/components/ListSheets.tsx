import { useState, type FormEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/core/ui/Button'
import { Field } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import type { ShoppingList } from '../model'
import { useShopping } from '../ShoppingProvider'

/** Créer une liste (Pharmacie, Costco…). */
export function NewListSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { createList } = useShopping()
  const [name, setName] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const id = createList(trimmed)
    setName('')
    onCreated(id)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle liste" eyebrow="Courses" focusField>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pharmacie, Costco…" maxLength={60} required />
        <Button type="submit">Créer la liste</Button>
      </form>
    </Sheet>
  )
}

/** Options d'une liste : renommer, ordre des rayons, supprimer (sauf la liste par défaut). */
export function ListOptionsSheet({
  list,
  open,
  onClose,
  onRemoved,
}: {
  list: ShoppingList
  open: boolean
  onClose: () => void
  onRemoved: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={list.name} eyebrow="Liste">
      <ListOptions key={list.id} list={list} onClose={onClose} onRemoved={onRemoved} />
    </Sheet>
  )
}

function ListOptions({ list, onClose, onRemoved }: { list: ShoppingList; onClose: () => void; onRemoved: () => void }) {
  const { renameList, removeList } = useShopping()
  const [name, setName] = useState(list.name)
  const [confirming, setConfirming] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed && trimmed !== list.name) renameList(list, trimmed)
    onClose()
  }
  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nom de la liste" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        <Button type="submit" variant="secondary">
          Renommer
        </Button>
      </form>
      {/* replace : remplace l’entrée d’historique de la feuille, Retour revient à la liste. */}
      <Link
        to="/courses/rayons"
        replace
        className="flex min-h-12 items-center justify-between rounded-md bg-surface-2 px-4 font-semibold text-ink"
      >
        Ordre des rayons
        <ChevronRight size={20} className="text-ink-3" aria-hidden="true" />
      </Link>
      <Link
        to="/activite?outil=shopping"
        replace
        className="-mt-3 flex min-h-12 items-center justify-between rounded-md bg-surface-2 px-4 font-semibold text-ink"
      >
        Activité des courses
        <ChevronRight size={20} className="text-ink-3" aria-hidden="true" />
      </Link>
      {list.is_default ? (
        <p className="text-sm text-ink-3">C’est la liste par défaut : elle ne se supprime pas.</p>
      ) : confirming ? (
        <div className="flex flex-col gap-2 rounded-md bg-bad-tint p-4">
          <p className="text-bad">Supprimer « {list.name} » et ses articles ?</p>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-bad text-surface hover:opacity-90"
              onClick={() => {
                removeList(list)
                onRemoved()
              }}
            >
              Supprimer
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="text-bad hover:bg-bad-tint" onClick={() => setConfirming(true)}>
          Supprimer la liste
        </Button>
      )}
    </div>
  )
}
