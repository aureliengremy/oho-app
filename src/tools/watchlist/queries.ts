import type { OhoClient } from '@/core/client'
import type { TablesInsert, TablesUpdate } from '@/core/db/database.types'
import type { Media, SearchResult, WatchData } from './model'

export const watchKey = (householdId: string) => ['watchlist', householdId] as const

export const WATCH_TABLES = ['watch_item', 'watch_rating', 'watch_platform'] as const

async function rows<T>(request: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await request
  if (error) throw error
  return data ?? []
}

/** Titres, notes et plateformes de l'espace, puis les fiches TMDB qu'ils citent. */
export async function fetchWatchlist(client: OhoClient, householdId: string): Promise<WatchData> {
  const [items, ratings, platforms] = await Promise.all([
    rows(client.from('watch_item').select('*').eq('household_id', householdId).is('deleted_at', null).order('created_at', { ascending: false })),
    rows(client.from('watch_rating').select('*').eq('household_id', householdId).is('deleted_at', null)),
    rows(client.from('watch_platform').select('*').eq('household_id', householdId).is('deleted_at', null).order('sort_order', { ascending: true })),
  ])
  const ids = [...new Set(items.map((i) => i.media_id).filter((id): id is string => id !== null))]
  const media = ids.length === 0 ? [] : await rows(client.from('external_media').select('*').in('id', ids))
  const itemIds = new Set(items.map((i) => i.id))
  return { items, ratings: ratings.filter((r) => itemIds.has(r.watch_item_id)), platforms, media }
}

/** Erreur lisible d'un appel à la fonction serveur « tmdb ». */
export class TmdbError extends Error {
  readonly code: 'non_configure' | 'indisponible'
  constructor(code: 'non_configure' | 'indisponible') {
    super(code === 'non_configure' ? 'La recherche TMDB n’est pas encore branchée : ajoutez le titre sans fiche.' : 'TMDB ne répond pas. Réessaie, ou ajoute le titre sans fiche.')
    this.code = code
  }
}

async function invoke<T>(client: OhoClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.functions.invoke<T>('tmdb', { body })
  if (error || !data) {
    const status = (error as { context?: { status?: number } } | null)?.context?.status
    throw new TmdbError(status === 503 ? 'non_configure' : 'indisponible')
  }
  return data
}

export const tmdb = {
  search: async (client: OhoClient, query: string) => (await invoke<{ results: SearchResult[] }>(client, { action: 'search', query })).results,
  import: async (client: OhoClient, result: Pick<SearchResult, 'media_type' | 'external_id'>) =>
    (await invoke<{ media: Media }>(client, { action: 'import', media_type: result.media_type, external_id: result.external_id })).media,
}

async function check<T extends { error: unknown }>(request: PromiseLike<T>): Promise<T> {
  const result = await request
  if (result.error) throw result.error
  return result
}

type Writable = 'watch_item' | 'watch_rating' | 'watch_platform'

export const writes = {
  insert: <T extends Writable>(client: OhoClient, table: T, row: TablesInsert<T>) => check(client.from(table).insert(row as never)),
  // Toutes ces tables ont une colonne id : on passe par 'watch_item' pour le typage du filtre.
  update: <T extends Writable>(client: OhoClient, table: T, id: string, patch: TablesUpdate<T>) =>
    check(client.from(table as 'watch_item').update(patch as never).eq('id', id)),
}
