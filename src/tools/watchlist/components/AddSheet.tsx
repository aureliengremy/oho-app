import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/core/ui/Button'
import { SelectField } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import type { SearchResult, WatchKind } from '../model'
import { useWatch } from '../WatchProvider'
import { Poster } from './Poster'

/** Ajouter un titre : recherche TMDB par la fonction serveur, ou ajout sans fiche. */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Ajouter un titre" eyebrow="À regarder" focusField>
      {open ? <AddForm onDone={onClose} /> : null}
    </Sheet>
  )
}

type SearchState = { status: 'idle' | 'loading' } | { status: 'done'; results: SearchResult[] } | { status: 'error'; message: string }

function AddForm({ onDone }: { onDone: () => void }) {
  const { data, search, addFromTmdb, addItem } = useWatch()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [platformId, setPlatformId] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const [adding, setAdding] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < 2) return
    let live = true
    const timer = setTimeout(() => {
      setState({ status: 'loading' })
      search(trimmed)
        .then((results) => live && setState({ status: 'done', results }))
        .catch((cause: Error) => live && setState({ status: 'error', message: cause.message }))
    }, 350)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [trimmed, search])

  const inList = (r: SearchResult) =>
    data?.media.some((m) => m.media_type === r.media_type && m.external_id === r.external_id && data.items.some((i) => i.media_id === m.id))

  const done = (id: string) => {
    onDone()
    navigate(`/a-regarder/${id}`)
  }

  const fromTmdb = async (result: SearchResult) => {
    setAdding(result.external_id)
    setProblem(null)
    try {
      done(await addFromTmdb(result, platformId || null))
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : 'Le titre n’a pas été ajouté.')
      setAdding(null)
    }
  }

  const withoutCard = (kind: WatchKind) => done(addItem({ title: trimmed, kind, platform_id: platformId || null }))
  const results = trimmed.length >= 2 && state.status === 'done' ? state.results : []

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          aria-label="Rechercher un film ou une série"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Titre d’un film ou d’une série"
          enterKeyHint="search"
          className="min-h-12 w-full rounded-md border border-transparent bg-surface-2 pr-4 pl-11 text-base text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none"
        />
      </div>
      {data && data.platforms.length > 0 ? (
        <SelectField
          label="Où le regarder"
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          options={[{ value: '', label: 'Plus tard' }, ...data.platforms.map((p) => ({ value: p.id, label: p.name }))]}
        />
      ) : null}

      {trimmed.length >= 2 && state.status === 'loading' ? (
        <p role="status" className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
          RECHERCHE…
        </p>
      ) : null}
      {trimmed.length >= 2 && state.status === 'error' ? <p className="rounded-md bg-warn-tint px-4 py-2 text-sm text-warn">{state.message}</p> : null}
      {problem ? (
        <p role="alert" className="rounded-md bg-bad-tint px-4 py-2 text-sm text-bad">
          {problem}
        </p>
      ) : null}

      {results.length > 0 ? (
        <section aria-label="Résultats TMDB" className="flex flex-col gap-1">
          <h3 className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">RÉSULTATS TMDB · {results.length}</h3>
          <ul className="flex flex-col">
            {results.map((r) => {
              const already = inList(r)
              return (
                <li key={`${r.media_type}-${r.external_id}`} className="flex min-h-16 items-center gap-3 py-1.5">
                  <Poster path={r.poster_path} title="" size="w185" className="w-11 flex-none rounded-sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-ink">{r.title}</span>
                    <span className="text-sm text-ink-3">{[r.media_type === 'movie' ? 'Film' : 'Série', r.year].filter(Boolean).join(' · ')}</span>
                  </span>
                  {already ? (
                    <span className="font-mono text-xs text-ink-3">DANS LA LISTE</span>
                  ) : (
                    <Button
                      variant="ghost"
                      className="min-h-11 px-3 text-sm"
                      disabled={adding !== null}
                      onClick={() => fromTmdb(r)}
                      aria-label={`Ajouter ${r.title}`}
                    >
                      {adding === r.external_id ? 'Ajout…' : 'Ajouter'}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {trimmed.length >= 2 ? (
        <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-4">
          <p className="text-sm text-ink-2">Pas trouvé ? Ajoutez « {trimmed} » sans fiche :</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 bg-surface" onClick={() => withoutCard('movie')}>
              Film
            </Button>
            <Button variant="secondary" className="flex-1 bg-surface" onClick={() => withoutCard('series')}>
              Série
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
