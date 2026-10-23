import { useState, type FormEvent } from 'react'
import { Check, ExternalLink, Lightbulb } from 'lucide-react'
import { useHousehold } from '@/core/household/useHousehold'
import { cn } from '@/core/lib/cn'
import { Avatar } from '@/core/ui/Avatar'
import { Button } from '@/core/ui/Button'
import { Field, TextAreaField } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import { AddBar } from '@/core/ui/AddBar'
import { formatDateRange, type Trip, type TripIdea, type TripsData } from '../model'
import { useTrips } from '../useTrips'

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Onglet Idées : ce qu'on veut voir ou faire sur place, cochable une fois fait. */
export function IdeasTab({ trip, data }: { trip: Trip; data: TripsData }) {
  const { addIdea, updateIdea } = useTrips()
  const { memberById } = useHousehold()
  const [editing, setEditing] = useState<TripIdea | null>(null)
  const ideas = data.ideas.filter((i) => i.trip_id === trip.id)
  const sorted = [...ideas.filter((i) => !i.done), ...ideas.filter((i) => i.done)]

  return (
    <div className="flex flex-col">
      <AddBar label="Nouvelle idée" placeholder="Ajouter une idée : Pastéis de Belém…" onAdd={(title) => addIdea(trip.id, title)} />
      {ideas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-8 py-8 text-center">
          <Lightbulb size={22} aria-hidden="true" className="text-ink-3" />
          <p className="text-ink-2">Les endroits, les restos et les activités à ne pas manquer.</p>
        </div>
      ) : (
        <ul aria-label="Idées">
          {sorted.map((idea) => {
            const author = memberById(idea.created_by)
            const detail = [idea.planned_date ? formatDateRange(idea.planned_date, null) : null, idea.note].filter(Boolean).join(' · ')
            return (
              <li key={idea.id} className="grid min-h-[52px] grid-cols-[48px_1fr_auto] items-center gap-x-1 pr-4">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={idea.done}
                  aria-label={idea.title}
                  onClick={() => updateIdea(idea, { done: !idea.done })}
                  className="flex size-12 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span
                    className={cn(
                      'flex size-[22px] items-center justify-center rounded-[7px] border-2',
                      idea.done ? 'border-accent-ink bg-accent-ink text-surface' : 'border-rule-strong bg-surface',
                    )}
                  >
                    {idea.done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(idea)}
                  aria-label={`Modifier ${idea.title}`}
                  className="flex min-h-11 min-w-0 flex-col justify-center py-1 text-left"
                >
                  <span className={cn('text-[16.5px] leading-snug', idea.done ? 'text-ink-3 line-through decoration-ink-4' : 'text-ink')}>
                    {idea.title}
                  </span>
                  {detail ? <span className="truncate text-sm text-ink-3">{detail}</span> : null}
                </button>
                <div className="flex items-center gap-1">
                  {idea.url ? (
                    <a
                      href={idea.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Ouvrir le lien (${host(idea.url)})`}
                      className="flex size-11 items-center justify-center rounded-pill text-accent-ink hover:bg-accent-tint"
                    >
                      <ExternalLink size={18} aria-hidden="true" />
                    </a>
                  ) : null}
                  {author ? <Avatar name={author.profile.display_name} chosenInitials={author.profile.initials} slot={author.slot} /> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.title ?? ''} eyebrow="Idée">
        {editing ? <IdeaForm key={editing.id} idea={editing} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </div>
  )
}

function IdeaForm({ idea, onDone }: { idea: TripIdea; onDone: () => void }) {
  const { updateIdea, removeIdea } = useTrips()
  const [title, setTitle] = useState(idea.title)
  const [note, setNote] = useState(idea.note ?? '')
  const [url, setUrl] = useState(idea.url ?? '')
  const [date, setDate] = useState(idea.planned_date ?? '')
  const urlInvalid = url.trim() !== '' && !/^https?:\/\//.test(url.trim())

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || urlInvalid) return
    updateIdea(idea, { title: title.trim(), note: note.trim() || null, url: url.trim() || null, planned_date: date || null })
    onDone()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Idée" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
      <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="aller tôt, réserver…" />
      <Field
        label="Lien"
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        aria-invalid={urlInvalid}
      />
      {urlInvalid ? <p className="text-sm text-bad">Le lien doit commencer par https://</p> : null}
      <Field label="Jour prévu" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={urlInvalid}>
          Enregistrer
        </Button>
        <Button
          variant="ghost"
          className="text-bad hover:bg-bad-tint"
          onClick={() => {
            removeIdea(idea)
            onDone()
          }}
        >
          Supprimer l’idée
        </Button>
      </div>
    </form>
  )
}
