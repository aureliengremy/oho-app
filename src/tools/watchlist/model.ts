import type { Enums, Tables } from '@/core/db/database.types'

export type WatchItem = Tables<'watch_item'>
export type WatchStatus = Enums<'watch_status'>
export type WatchKind = Enums<'watch_kind'>
export type Rating = Tables<'watch_rating'>
export type Platform = Tables<'watch_platform'>
export type Media = Tables<'external_media'>

/** Ce que l'outil lit pour l'espace : titres, notes, plateformes et fiches TMDB en cache. */
export interface WatchData {
  items: WatchItem[]
  ratings: Rating[]
  platforms: Platform[]
  media: Media[]
}

/** Un résultat de la recherche TMDB (fonction serveur « tmdb »). */
export interface SearchResult {
  media_type: 'movie' | 'tv'
  external_id: string
  title: string
  year: number | null
  poster_path: string | null
  overview: string | null
}

export const statusLabel: Record<WatchStatus, string> = {
  to_watch: 'À voir',
  watching: 'En cours',
  watched: 'Vu',
  dropped: 'Abandonné',
}

export const kindLabel: Record<WatchKind, string> = { movie: 'Film', series: 'Série' }

/** Durée max par défaut du filtre « ce soir », en minutes (réglable dans tool_activation.settings). */
export const DEFAULT_TONIGHT_MAX = 120
export const TONIGHT_CHOICES = [90, 120, 150, 180] as const

/** URL d'une affiche TMDB ; la taille w342 suffit pour une grille de deux. */
export function posterUrl(path: string | null | undefined, size: 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

/** La durée retenue : celle saisie, sinon celle de la fiche (épisode pour une série). */
export function runtimeOf(item: WatchItem, media: Media | undefined): number | null {
  return item.runtime_min ?? media?.runtime_min ?? null
}

/** « 1 h 46 », « 50 min ». */
export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

/** « 1 h 30 », « 2 h » pour les choix du filtre. */
export const formatMax = (minutes: number) => `≤ ${formatRuntime(minutes)}`

/**
 * Le filtre « ce soir » : à voir ou en cours, qui tient dans la soirée, sur une plateforme où
 * l'on est abonnés. Un titre sans durée ou sans plateforme connue reste dans la liste : on ne
 * l'écarte que si l'on sait qu'il ne va pas.
 */
export function tonight(data: WatchData, maxMinutes: number): WatchItem[] {
  const media = new Map(data.media.map((m) => [m.id, m]))
  const platforms = new Map(data.platforms.map((p) => [p.id, p]))
  return data.items.filter((item) => {
    if (item.status !== 'to_watch' && item.status !== 'watching') return false
    const runtime = runtimeOf(item, item.media_id ? media.get(item.media_id) : undefined)
    if (runtime !== null && runtime > maxMinutes) return false
    const platform = item.platform_id ? platforms.get(item.platform_id) : undefined
    return !platform || platform.is_subscribed
  })
}

/** Tire un titre au hasard, en évitant ceux déjà proposés tant qu'il en reste. */
export function draw(pool: readonly WatchItem[], seen: ReadonlySet<string>, random: () => number = Math.random): WatchItem | null {
  const fresh = pool.filter((i) => !seen.has(i.id))
  const from = fresh.length > 0 ? fresh : pool
  if (from.length === 0) return null
  return from[Math.floor(random() * from.length)]
}

/** Ordre de la liste : en cours d'abord, puis les plus récemment ajoutés. */
export function sortItems(items: readonly WatchItem[]): WatchItem[] {
  const rank: Record<WatchStatus, number> = { watching: 0, to_watch: 1, watched: 2, dropped: 3 }
  return [...items].sort((a, b) => rank[a.status] - rank[b.status] || b.created_at.localeCompare(a.created_at))
}

/** « Série · 2022 · 2 saisons ». */
export function describeMedia(item: WatchItem, media: Media | undefined): string {
  const seasons = media?.number_of_seasons
  return [
    kindLabel[item.kind],
    media?.year ? String(media.year) : null,
    item.kind === 'series' && seasons ? (seasons === 1 ? '1 saison' : `${seasons} saisons`) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function nextSortOrder(rows: readonly { sort_order: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1
}
