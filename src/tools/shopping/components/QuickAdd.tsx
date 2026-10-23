import { useId, useState, type FormEvent } from 'react'
import { ArrowUp, Plus } from 'lucide-react'
import type { AddResult } from '../ShoppingProvider'
import { suggest, type CatalogEntry, type Category } from '../model'
import { currentFragment, dropFragment, parseQuickAdd, type QuickEntry } from '@/core/checklist/parse'

/** Phrase courte pour la zone d'annonce : ce que l'ajout a fait. */
export function describeAdd({ added, restored, skipped }: AddResult): string {
  const parts: string[] = []
  if (added.length === 1) parts.push(`${added[0]} ajouté`)
  else if (added.length > 1) parts.push(`${added.length} articles ajoutés`)
  if (restored.length > 0) parts.push(`${restored.join(', ')} ressorti${restored.length > 1 ? 's' : ''} du panier`)
  if (skipped.length > 0) parts.push(`${skipped.join(', ')} déjà dans la liste`)
  return parts.join(' · ')
}

function Highlight({ label, fragment }: { label: string; fragment: string }) {
  const at = label.toLowerCase().indexOf(fragment.toLowerCase())
  if (!fragment || at === -1) return <>{label}</>
  return (
    <>
      {label.slice(0, at)}
      <mark className="rounded-sm bg-accent-tint text-accent-ink">{label.slice(at, at + fragment.length)}</mark>
      {label.slice(at + fragment.length)}
    </>
  )
}

/**
 * Champ d'ajout collé en bas : « lait, œufs, pain » + Entrée ajoute trois articles.
 * Au-dessus, le catalogue propose ce qu'on a déjà acheté, avec son rayon et sa fréquence.
 */
export function QuickAdd({
  catalog,
  categories,
  exclude,
  placeholder,
  onAdd,
}: {
  catalog: CatalogEntry[]
  categories: Category[]
  exclude: ReadonlySet<string>
  placeholder: string
  onAdd: (entries: QuickEntry[]) => void
}) {
  const [text, setText] = useState('')
  const listId = useId()
  const fragment = currentFragment(text)
  const suggestions = suggest(catalog, fragment, exclude)
  const entries = parseQuickAdd(text)
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (entries.length === 0) return
    onAdd(entries)
    setText('')
  }

  return (
    <div className="flex flex-col bg-surface">
      {fragment && suggestions.length > 0 ? (
        <div className="border-t border-rule px-2 pt-2">
          <p className="flex justify-between px-3 pb-1 font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
            <span>DÉJÀ ACHETÉS</span>
          </p>
          <ul id={listId} aria-label="Suggestions du catalogue">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd([{ label: s.label, quantity: null }])
                    setText(dropFragment(text))
                  }}
                  aria-label={`Ajouter ${s.label}`}
                  className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ink">
                      <Highlight label={s.label} fragment={fragment} />
                    </span>
                    <span className="text-sm text-ink-3">
                      {[s.default_category_id ? categoryName.get(s.default_category_id) : null, `${s.usage_count} fois`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <Plus size={18} className="text-accent-ink" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form onSubmit={submit} className="flex items-center gap-2 px-3 pt-2 pb-2.5">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-pill border border-rule bg-surface-2 px-4 focus-within:border-2 focus-within:border-accent-ink focus-within:bg-surface focus-within:pl-[15px]">
          <Plus size={18} className="flex-none text-ink-3" aria-hidden="true" />
          <span className="sr-only">Ajouter des articles, séparés par des virgules</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            enterKeyHint="done"
            autoComplete="off"
            aria-controls={fragment && suggestions.length > 0 ? listId : undefined}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </label>
        {entries.length > 0 ? (
          <button
            type="submit"
            aria-label={entries.length > 1 ? `Ajouter ${entries.length} articles` : 'Ajouter'}
            className="flex size-12 flex-none items-center justify-center rounded-pill bg-accent-ink text-surface"
          >
            <ArrowUp size={20} aria-hidden="true" />
          </button>
        ) : null}
      </form>
    </div>
  )
}
