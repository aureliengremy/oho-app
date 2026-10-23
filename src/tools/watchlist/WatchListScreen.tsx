import { useState } from 'react'
import { Dices, Moon, Plus, Settings2, Tv } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { ConnectionBanner, LiveBadge } from '@/core/sync/ConnectionStatus'
import { Avatar } from '@/core/ui/Avatar'
import { Button } from '@/core/ui/Button'
import { AddSheet } from './components/AddSheet'
import { DrawSheet } from './components/DrawSheet'
import { PlatformsSheet } from './components/PlatformsSheet'
import { Poster } from './components/Poster'
import { formatMax, formatRuntime, kindLabel, runtimeOf, sortItems, statusLabel, tonight, TONIGHT_CHOICES, type WatchData, type WatchItem, type WatchStatus } from './model'
import { useWatch } from './WatchProvider'

const statuses: WatchStatus[] = ['to_watch', 'watching', 'watched', 'dropped']

/** La liste À regarder : statuts, filtre « ce soir », affiches en grille de deux, tirage au sort. */
export function WatchListScreen() {
  const { data, isPending, isError, refetch, updatedAt, error, dismissError, tonightMax, setTonightMax } = useWatch()
  const [params] = useSearchParams()
  const [sheet, setSheet] = useState<'add' | 'draw' | 'platforms' | null>(null)
  const status = (params.get('statut') as WatchStatus | null) ?? 'to_watch'
  const isTonight = params.get('soir') === '1'

  if (isPending || isError || !data) {
    return (
      <>
        <ScreenHeader title="À regarder" />
        {isPending ? (
          <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            Chargement des titres…
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-ink-2">Les titres ne se sont pas chargés. Vérifie la connexion puis réessaie.</p>
            <Button onClick={refetch}>Réessayer</Button>
          </div>
        )}
      </>
    )
  }

  const tonightItems = tonight(data, tonightMax)
  const shown = isTonight ? tonightItems : sortItems(data.items.filter((i) => i.status === status))
  const pool = isTonight ? tonightItems : data.items.filter((i) => i.status === 'to_watch')
  const subscribed = data.platforms.filter((p) => p.is_subscribed).length

  return (
    <div className="flex flex-col pb-28">
      <ScreenHeader
        title="À regarder"
        actions={
          <>
            <LiveBadge />
            <button
              type="button"
              onClick={() => setSheet('platforms')}
              aria-label="Nos plateformes"
              className="flex size-11 items-center justify-center rounded-pill text-ink hover:bg-surface-2"
            >
              <Settings2 size={20} />
            </button>
          </>
        }
      />
      <ConnectionBanner updatedAt={updatedAt} />

      <nav aria-label="Filtrer les titres" className="flex gap-2 overflow-x-auto px-5 pt-1 pb-2">
        {statuses.map((s) => (
          <Link
            key={s}
            to={`/a-regarder?statut=${s}`}
            replace
            aria-current={!isTonight && status === s ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-none items-center gap-2 rounded-pill border px-4 text-[15px] font-semibold',
              !isTonight && status === s ? 'border-accent-ink bg-accent-tint text-accent-ink' : 'border-rule text-ink-2',
            )}
          >
            {statusLabel[s]}
            <span className="font-mono text-xs tabular-nums">{data.items.filter((i) => i.status === s).length}</span>
          </Link>
        ))}
        <Link
          to={isTonight ? '/a-regarder' : '/a-regarder?soir=1'}
          replace
          aria-current={isTonight ? 'page' : undefined}
          className={cn(
            'flex min-h-11 flex-none items-center gap-2 rounded-pill border px-4 text-[15px] font-semibold',
            isTonight ? 'border-accent-ink bg-accent-ink text-surface' : 'border-rule text-ink-2',
          )}
        >
          <Moon size={16} aria-hidden="true" />
          Ce soir
        </Link>
      </nav>

      {isTonight ? (
        <div className="mx-5 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-accent-tint px-4 py-2 text-accent-ink">
          <p className="flex-1 text-sm">
            <b className="font-semibold">Ce soir</b> · {subscribed} plateforme{subscribed > 1 ? 's' : ''} · {tonightItems.length} titre
            {tonightItems.length > 1 ? 's' : ''}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Durée maximale</span>
            <select
              value={tonightMax}
              onChange={(e) => void setTonightMax(Number(e.target.value)).catch(() => undefined)}
              className="min-h-11 rounded-md bg-surface px-2 font-mono text-sm text-accent-ink"
            >
              {TONIGHT_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {formatMax(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mx-5 mb-2 flex items-center gap-3 rounded-md bg-bad-tint px-4 py-3 text-bad">
          <p className="flex-1 text-sm">{error}</p>
          <button type="button" onClick={dismissError} className="min-h-11 px-2 text-sm font-semibold">
            Fermer
          </button>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent-ink">
            <Tv size={24} aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-semibold text-ink">
            {isTonight ? 'Rien qui tienne ce soir' : data.items.length === 0 ? 'La liste est vide' : `Rien en « ${statusLabel[status]} »`}
          </h2>
          <p className="text-ink-2">
            {isTonight ? 'Allongez la durée ou cochez une plateforme de plus.' : 'Ajoutez un film ou une série : la recherche remplit l’affiche et la durée.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 px-5 pt-2" aria-label="Titres">
          {shown.map((item) => (
            <ItemCard key={item.id} item={item} data={data} />
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 flex justify-center gap-3 px-5">
        {pool.length > 1 ? (
          <Button variant="secondary" onClick={() => setSheet('draw')} className="shadow-lg">
            <Dices size={18} aria-hidden="true" />
            Tirer au sort
          </Button>
        ) : null}
        <Button onClick={() => setSheet('add')} className="shadow-lg">
          <Plus size={18} aria-hidden="true" />
          Titre
        </Button>
      </div>

      <AddSheet open={sheet === 'add'} onClose={() => setSheet(null)} />
      <DrawSheet open={sheet === 'draw'} pool={pool} label={isTonight ? 'ce soir' : 'à voir'} onClose={() => setSheet(null)} />
      <PlatformsSheet open={sheet === 'platforms'} onClose={() => setSheet(null)} />
    </div>
  )
}

function ItemCard({ item, data }: { item: WatchItem; data: WatchData }) {
  const { memberById } = useHousehold()
  const media = data.media.find((m) => m.id === item.media_id)
  const platform = data.platforms.find((p) => p.id === item.platform_id)
  const suggester = memberById(item.suggested_by)
  const runtime = formatRuntime(runtimeOf(item, media))
  const progress = item.kind === 'series' && item.season_current ? `S${item.season_current} · É${item.episode_current ?? 1}` : null
  const detail = [progress ?? runtime, platform?.name].filter(Boolean).join(' · ')
  return (
    <li>
      <Link
        to={`/a-regarder/${item.id}`}
        aria-label={[item.title, kindLabel[item.kind], detail, suggester ? `proposé par ${suggester.profile.display_name}` : null].filter(Boolean).join(', ')}
        className="flex flex-col gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-accent">
        <div className="relative">
          <Poster path={media?.poster_path} title={item.title} />
          {suggester ? (
            <span aria-hidden="true" className="absolute right-2 bottom-2">
              <Avatar name={suggester.profile.display_name} chosenInitials={suggester.profile.initials} slot={suggester.slot} />
            </span>
          ) : null}
        </div>
        <span className="flex flex-col">
          <span className="font-mono text-[11.5px] tracking-[var(--ls-eyebrow)] uppercase text-ink-3">{kindLabel[item.kind]}</span>
          <span className="leading-snug font-semibold text-ink">{item.title}</span>
          <span className="text-sm text-ink-3">{detail || ' '}</span>
        </span>
      </Link>
    </li>
  )
}
