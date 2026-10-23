import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import type { Json, TablesUpdate } from '@/core/db/database.types'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { uuidv7 } from '@/core/lib/uuid'
import { isSettled, useLiveQuery } from '@/core/sync/SyncProvider'
import { useOptimisticWrites } from '@/core/sync/useOptimisticWrites'
import { DEFAULT_TONIGHT_MAX, nextSortOrder, type Media, type Platform, type Rating, type SearchResult, type WatchData, type WatchItem, type WatchKind } from './model'
import { fetchWatchlist, tmdb, WATCH_TABLES, watchKey, writes } from './queries'

export interface NewItem {
  title: string
  kind: WatchKind
  platform_id: string | null
  runtime_min?: number | null
}

interface WatchValue {
  data: WatchData | undefined
  updatedAt: number
  isPending: boolean
  /** Les données ont été relues depuis l'ouverture (et pas seulement restaurées du cache de l'appareil). */
  settled: boolean
  isError: boolean
  refetch: () => void
  error: string | null
  dismissError: () => void
  /** Durée max du filtre « ce soir » pour l'espace, en minutes. */
  tonightMax: number
  setTonightMax: (minutes: number) => Promise<void>
  addItem: (fields: NewItem, media?: Media) => string
  /** Importe la fiche TMDB (fonction serveur) puis ajoute le titre ; rejette avec un message lisible. */
  addFromTmdb: (result: SearchResult, platformId: string | null) => Promise<string>
  search: (query: string) => Promise<SearchResult[]>
  updateItem: (item: WatchItem, patch: TablesUpdate<'watch_item'>) => void
  removeItem: (item: WatchItem) => void
  rate: (item: WatchItem, rating: number, comment: string | null) => void
  addPlatform: (name: string) => void
  updatePlatform: (platform: Platform, patch: TablesUpdate<'watch_platform'>) => void
  removePlatform: (platform: Platform) => void
}

const WatchContext = createContext<WatchValue | null>(null)

const now = () => new Date().toISOString()

const stamps = (myId: string | null) => {
  const stamp = now()
  return { created_at: stamp, updated_at: stamp, created_by: myId, updated_by: myId, deleted_at: null }
}

/** Données et écritures de l'outil À regarder, optimistes comme les autres outils. */
export function WatchProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household, me, activations } = useHousehold()
  const myId = me?.profile.id ?? null
  const key = watchKey(household.id)
  const query = useLiveQuery({ tables: WATCH_TABLES, queryKey: key, queryFn: () => fetchWatchlist(client, household.id) })
  const { write, error, dismissError } = useOptimisticWrites<WatchData>(key)
  const activation = activations.find((a) => a.tool_key === 'watchlist')
  const settings = (activation?.settings ?? {}) as { tonight_max_min?: number }
  const tonightMax = settings.tonight_max_min ?? DEFAULT_TONIGHT_MAX

  const value = useMemo<WatchValue>(() => {
    const current = () => queryClient.getQueryData<WatchData>(key)
    const replace = <R extends { id: string }>(list: R[], id: string, patch: Partial<R>) =>
      list.map((r) => (r.id === id ? { ...r, ...patch } : r))
    const without = <R extends { id: string }>(list: R[], id: string) => list.filter((r) => r.id !== id)

    const addItem = (fields: NewItem, media?: Media): string => {
      const existing = media ? current()?.items.find((i) => i.media_id === media.id) : undefined
      if (existing) return existing.id
      const item: WatchItem = {
        id: uuidv7(),
        household_id: household.id,
        title: fields.title,
        kind: fields.kind,
        status: 'to_watch',
        platform_id: fields.platform_id,
        media_id: media?.id ?? null,
        season_current: null,
        episode_current: null,
        runtime_min: fields.runtime_min ?? null,
        suggested_by: myId,
        comment: null,
        watched_at: null,
        ...stamps(myId),
      }
      write(
        (d) => ({ ...d, items: [item, ...d.items], media: media && !d.media.some((m) => m.id === media.id) ? [...d.media, media] : d.media }),
        () =>
          writes.insert(client, 'watch_item', {
            id: item.id,
            household_id: household.id,
            title: item.title,
            kind: item.kind,
            status: item.status,
            suggested_by: item.suggested_by,
            platform_id: item.platform_id,
            media_id: item.media_id,
            runtime_min: item.runtime_min,
          }),
        `« ${item.title} » n’a pas été ajouté. Réessaie.`,
      )
      return item.id
    }

    return {
      data: query.data,
      updatedAt: query.dataUpdatedAt,
      isPending: query.isPending,
      settled: isSettled(query),
      isError: query.isError,
      refetch: () => void query.refetch(),
      error,
      dismissError,
      tonightMax,

      async setTonightMax(minutes) {
        const next = { ...(activation?.settings as Record<string, Json> | undefined), tonight_max_min: minutes }
        const { error: failure } = await client
          .from('tool_activation')
          .update({ settings: next })
          .eq('household_id', household.id)
          .eq('tool_key', 'watchlist')
        if (failure) throw new Error('La durée n’a pas été enregistrée.')
        await queryClient.invalidateQueries({ queryKey: ['household'] })
      },

      addItem,

      async addFromTmdb(result, platformId) {
        const media = await tmdb.import(client, result)
        return addItem({ title: media.title, kind: media.media_type === 'tv' ? 'series' : 'movie', platform_id: platformId }, media)
      },

      search: (q) => tmdb.search(client, q),

      updateItem(item, patch) {
        const optimistic: Partial<WatchItem> = { ...(patch as Partial<WatchItem>) }
        if (patch.status === 'watched' && item.status !== 'watched') optimistic.watched_at = now()
        else if (patch.status && patch.status !== 'watched') optimistic.watched_at = null
        write(
          (d) => ({ ...d, items: replace(d.items, item.id, optimistic) }),
          () => writes.update(client, 'watch_item', item.id, patch),
          `« ${item.title} » n’a pas été modifié. Réessaie.`,
        )
      },

      removeItem(item) {
        write(
          (d) => ({ ...d, items: without(d.items, item.id), ratings: d.ratings.filter((r) => r.watch_item_id !== item.id) }),
          () => writes.update(client, 'watch_item', item.id, { deleted_at: now() }),
          `« ${item.title} » n’a pas été supprimé. Réessaie.`,
        )
      },

      rate(item, rating, comment) {
        const mine = current()?.ratings.find((r) => r.watch_item_id === item.id && r.user_id === myId)
        if (mine) {
          write(
            (d) => ({ ...d, ratings: replace(d.ratings, mine.id, { rating, comment }) }),
            () => writes.update(client, 'watch_rating', mine.id, { rating, comment }),
            'La note n’a pas été enregistrée. Réessaie.',
          )
          return
        }
        if (!myId) return
        const row: Rating = { id: uuidv7(), household_id: household.id, watch_item_id: item.id, user_id: myId, rating, comment, ...stamps(myId) }
        write(
          (d) => ({ ...d, ratings: [...d.ratings, row] }),
          () =>
            writes.insert(client, 'watch_rating', {
              id: row.id,
              household_id: household.id,
              watch_item_id: item.id,
              user_id: myId,
              rating,
              comment,
            }),
          'La note n’a pas été enregistrée. Réessaie.',
        )
      },

      addPlatform(name) {
        const platforms = current()?.platforms ?? []
        if (platforms.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())) return
        const platform: Platform = {
          id: uuidv7(),
          household_id: household.id,
          name: name.trim(),
          is_subscribed: true,
          tmdb_provider_id: null,
          sort_order: nextSortOrder(platforms),
          ...stamps(myId),
        }
        write(
          (d) => ({ ...d, platforms: [...d.platforms, platform] }),
          () =>
            writes.insert(client, 'watch_platform', {
              id: platform.id,
              household_id: household.id,
              name: platform.name,
              sort_order: platform.sort_order,
            }),
          'La plateforme n’a pas été ajoutée. Réessaie.',
        )
      },

      updatePlatform(platform, patch) {
        write(
          (d) => ({ ...d, platforms: replace(d.platforms, platform.id, patch as Partial<Platform>) }),
          () => writes.update(client, 'watch_platform', platform.id, patch),
          'La plateforme n’a pas été modifiée. Réessaie.',
        )
      },

      removePlatform(platform) {
        write(
          (d) => ({
            ...d,
            platforms: without(d.platforms, platform.id),
            items: d.items.map((i) => (i.platform_id === platform.id ? { ...i, platform_id: null } : i)),
          }),
          async () => {
            // La clé étrangère ne joue qu'à la purge : on détache les titres tout de suite.
            const attached = (current()?.items ?? []).filter((i) => i.platform_id === platform.id)
            await writes.update(client, 'watch_platform', platform.id, { deleted_at: now() })
            await Promise.all(attached.map((i) => writes.update(client, 'watch_item', i.id, { platform_id: null })))
          },
          'La plateforme n’a pas été retirée. Réessaie.',
        )
      },
    }
    // key est dérivée de household.id ; query change quand ses données changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queryClient, household.id, myId, query.data, query.dataUpdatedAt, query.isPending, query.isError, query.isFetchedAfterMount, query.fetchStatus, error, dismissError, write, tonightMax, activation])

  return <WatchContext.Provider value={value}>{children}</WatchContext.Provider>
}

export function useWatch(): WatchValue {
  const value = useContext(WatchContext)
  if (!value) throw new Error('useWatch doit être appelé sous <WatchProvider>')
  return value
}
