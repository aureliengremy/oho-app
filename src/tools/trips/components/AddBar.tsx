import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'

/** Champ d'ajout d'une ligne : Entrée ou le bouton « + » ajoutent, le champ se vide. */
export function AddBar({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-4 py-2">
      <input
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="done"
        className="min-h-12 flex-1 rounded-pill border border-transparent bg-surface-2 px-4 text-base text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Ajouter"
        disabled={!text.trim()}
        className="flex size-12 flex-none items-center justify-center rounded-pill bg-accent-ink text-surface disabled:opacity-40"
      >
        <Plus size={20} aria-hidden="true" />
      </button>
    </form>
  )
}
