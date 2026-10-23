import { useState } from 'react'
import { Minus, Plus, Star } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useIsMutating } from '@tanstack/react-query'
import { useHousehold } from '@/core/household/HouseholdProvider'
import type { Member } from '@/core/household/queries'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { relativeTime } from '@/core/lib/time'
import { ConnectionBanner, LiveBadge } from '@/core/sync/ConnectionStatus'
import { Avatar } from '@/core/ui/Avatar'
import { Button } from '@/core/ui/Button'
import { SelectField, TextAreaField } from '@/core/ui/Field'
import { Poster } from './components/Poster'
import { StatusPill } from './components/StatusPill'
import { describeMedia, formatRuntime, runtimeOf, statusLabel, type Rating, type WatchData, type WatchItem, type WatchStatus } from './model'
import { watchKey } from './queries'
import { useWatch } from './WatchProvider'

const statuses: WatchStatus[] = ['to_watch', 'watching', 'watched', 'dropped']

/** La fiche d'un titre : affiche, synopsis, statut, progression de série, nos deux notes. */
export function WatchItemScreen() {
  const { data, isPending, isError, refetch, settled } = useWatch()
  const { itemId } = useParams()
  const { household } = useHousehold()
  const writing = useIsMutating({ mutationKey: watchKey(household.id) }) > 0
  const item = data?.items.find((i) => i.id === itemId)

  if (isPending || isError || !data || (!item && (writing || !settled))) {
    return (
      <>
        <ScreenHeader title="" back="/a-regarder" />
        {!isError ? (
          <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            Chargement…
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-ink-2">Le titre ne s’est pas chargé. Vérifie la connexion puis réessaie.</p>
            <Button onClick={refetch}>Réessayer</Button>
          </div>
        )}
      </>
    )
  }
  if (!item) return <Navigate to="/a-regarder" replace />
  return <ItemView key={item.id} item={item} data={data} />
}

function ItemView({ item, data }: { item: WatchItem; data: WatchData }) {
  const { updatedAt, error, dismissError, updateItem, removeItem } = useWatch()
  const { members, memberById, me } = useHousehold()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const media = data.media.find((m) => m.id === item.media_id)
  const platform = data.platforms.find((p) => p.id === item.platform_id)
  const suggester = memberById(item.suggested_by)
  const ratings = data.ratings.filter((r) => r.watch_item_id === item.id)
  const mine = ratings.find((r) => r.user_id === me?.profile.id)
  const runtime = formatRuntime(runtimeOf(item, media))
  const meta = [platform?.name, runtime ? `${item.kind === 'series' ? '≈ ' : ''}${runtime}` : null].filter(Boolean).join(' · ')
  const seasons = media?.number_of_seasons ?? null

  const setStatus = (status: WatchStatus) => {
    if (status === item.status) return
    // Commencer une série la place au premier épisode.
    const start = status === 'watching' && item.kind === 'series' && !item.season_current ? { season_current: 1, episode_current: 1 } : {}
    updateItem(item, { status, ...start })
  }

  return (
    <div className="flex flex-col pb-10">
      <ScreenHeader title="" back="/a-regarder" actions={<LiveBadge />} />
      <ConnectionBanner updatedAt={updatedAt} />

      <div className="flex gap-4 px-5 pb-4">
        <Poster path={media?.poster_path} title={item.title} className="w-28 flex-none" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <StatusPill status={item.status} className="self-start" />
          <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[var(--ls-head)] text-ink">{item.title}</h1>
          <p className="text-sm text-ink-2">{describeMedia(item, media)}</p>
          {meta ? <p className="text-sm text-ink-3">{meta}</p> : null}
          {suggester ? (
            <p className="flex items-center gap-2 text-sm text-ink-3">
              <Avatar name={suggester.profile.display_name} chosenInitials={suggester.profile.initials} slot={suggester.slot} />
              Proposé par {suggester.profile.display_name}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div role="alert" className="mx-5 mb-3 flex items-center gap-3 rounded-md bg-bad-tint px-4 py-3 text-bad">
          <p className="flex-1 text-sm">{error}</p>
          <button type="button" onClick={dismissError} className="min-h-11 px-2 text-sm font-semibold">
            Fermer
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 px-5">
        {media?.overview ? (
          <section className="flex flex-col gap-1.5">
            <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">Synopsis · TMDB</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">{media.overview}</p>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">Statut</h2>
          <div role="radiogroup" aria-label="Statut" className="grid grid-cols-4 gap-1 rounded-pill bg-surface-2 p-1">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={item.status === s}
                onClick={() => setStatus(s)}
                className={cn('min-h-11 rounded-pill text-[13.5px] font-semibold', item.status === s ? 'bg-accent-ink text-surface' : 'text-ink-2')}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
          {item.watched_at && item.status === 'watched' ? <p className="text-sm text-ink-3">Vu {relativeTime(item.watched_at)}</p> : null}
        </section>

        {item.kind === 'series' && (item.status === 'watching' || item.season_current) ? (
          <section className="flex flex-col gap-2">
            <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">Où on en est</h2>
            <div className="grid grid-cols-2 gap-3">
              <Stepper
                label="Saison"
                value={item.season_current ?? 1}
                max={seasons}
                onChange={(season_current) => updateItem(item, { season_current, episode_current: 1 })}
              />
              <Stepper label="Épisode" value={item.episode_current ?? 1} onChange={(episode_current) => updateItem(item, { season_current: item.season_current ?? 1, episode_current })} />
            </div>
            <Button
              variant="secondary"
              onClick={() => updateItem(item, { season_current: item.season_current ?? 1, episode_current: (item.episode_current ?? 0) + 1 })}
            >
              Épisode suivant
            </Button>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">Nos notes</h2>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <RatingRow
                key={m.profile.id}
                item={item}
                member={m}
                rating={ratings.find((r) => r.user_id === m.profile.id)}
                editable={m.profile.id === me?.profile.id}
              />
            ))}
          </ul>
          {ratings
            .filter((r) => r.comment)
            .map((r) => (
              <blockquote key={r.id} className="border-l-2 border-rule-strong pl-3 text-[15px] text-ink-2 italic">
                « {r.comment} » — {memberById(r.user_id)?.profile.display_name}
              </blockquote>
            ))}
          {mine || me ? <CommentField key={mine?.id ?? 'nouvelle'} item={item} rating={mine} /> : null}
        </section>

        <SelectField
          label="Où le regarder"
          value={item.platform_id ?? ''}
          onChange={(e) => updateItem(item, { platform_id: e.target.value || null })}
          options={[{ value: '', label: 'Pas encore décidé' }, ...data.platforms.map((p) => ({ value: p.id, label: p.name }))]}
        />

        {confirming ? (
          <Button
            variant="ghost"
            className="bg-bad-tint text-bad hover:bg-bad-tint"
            onClick={() => {
              removeItem(item)
              navigate('/a-regarder', { replace: true })
            }}
          >
            Retirer « {item.title} » et nos notes
          </Button>
        ) : (
          <Button variant="ghost" className="text-bad hover:bg-bad-tint" onClick={() => setConfirming(true)}>
            Retirer de la liste
          </Button>
        )}
      </div>
    </div>
  )
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max?: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface-2 p-2">
      <span className="text-center font-mono text-[11.5px] tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
        {label}
        {max ? ` · SUR ${max}` : ''}
      </span>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={`${label} : moins`}
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          className="flex size-11 items-center justify-center rounded-pill bg-surface text-ink disabled:opacity-40"
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <output aria-label={label} className="font-mono text-2xl font-semibold text-ink tabular-nums">
          {value}
        </output>
        <button
          type="button"
          aria-label={`${label} : plus`}
          disabled={max !== null && max !== undefined && value >= max}
          onClick={() => onChange(value + 1)}
          className="flex size-11 items-center justify-center rounded-pill bg-surface text-ink disabled:opacity-40"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function RatingRow({ item, member, rating, editable }: { item: WatchItem; member: Member; rating?: Rating; editable: boolean }) {
  const { rate } = useWatch()
  const value = rating?.rating ?? 0
  const name = member.profile.display_name
  const score = <span className="font-mono text-sm text-ink-2 tabular-nums">{value ? `${value}/5` : '—'}</span>
  return (
    <li className="flex flex-col rounded-lg bg-surface-2 px-3 py-1">
      <div className="flex min-h-12 items-center gap-3">
        <Avatar name={name} chosenInitials={member.profile.initials} slot={member.slot} />
        <span className="flex-1 font-semibold text-ink">{name}</span>
        {editable ? null : (
          <span className="flex text-accent-ink" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={16} className={cn(n <= value ? 'fill-current' : 'text-ink-4')} />
            ))}
          </span>
        )}
        {score}
      </div>
      {editable ? (
        <div role="radiogroup" aria-label="Ma note" className="-mx-1 flex justify-between pb-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} sur 5`}
              onClick={() => rate(item, n, rating?.comment ?? null)}
              className="flex size-11 items-center justify-center text-accent-ink"
            >
              <Star size={24} aria-hidden="true" className={cn(n <= value ? 'fill-current' : 'text-ink-4')} />
            </button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

function CommentField({ item, rating }: { item: WatchItem; rating?: Rating }) {
  const { rate } = useWatch()
  const [comment, setComment] = useState(rating?.comment ?? '')
  if (!rating) return <p className="text-sm text-ink-3">Notez le titre pour y ajouter un mot.</p>
  const changed = comment.trim() !== (rating.comment ?? '')
  return (
    <div className="flex flex-col gap-2">
      <TextAreaField label="Mon mot" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={2} placeholder="Lent au début, puis…" />
      {changed ? (
        <Button variant="secondary" onClick={() => rate(item, rating.rating, comment.trim() || null)}>
          Enregistrer mon mot
        </Button>
      ) : null}
    </div>
  )
}
