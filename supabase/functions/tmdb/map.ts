// Mise en forme des réponses TMDB, sans dépendance Deno : testée par Vitest
// (supabase/functions/tmdb/map.test.ts) et utilisée par index.ts.

export const REGION = 'CA'
export const LANGUAGE = 'fr-CA'

/** Un résultat de recherche, tel que l'écran « Ajouter un titre » l'affiche. */
export interface SearchResult {
  media_type: 'movie' | 'tv'
  external_id: string
  title: string
  year: number | null
  poster_path: string | null
  overview: string | null
}

/** La ligne `external_media` à écrire (sans id ni horodatage). */
export interface MediaRow {
  source: 'tmdb'
  media_type: 'movie' | 'tv'
  external_id: string
  title: string
  original_title: string | null
  year: number | null
  overview: string | null
  poster_path: string | null
  runtime_min: number | null
  number_of_seasons: number | null
  genres: string[] | null
  providers: { id: number; name: string; logo_path: string | null }[] | null
  fetched_at: string
}

type Json = Record<string, unknown>

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null)

function yearOf(date: unknown): number | null {
  const d = text(date)
  const y = d ? Number(d.slice(0, 4)) : NaN
  return y >= 1870 && y <= 2200 ? y : null
}

/** Chemin d'affiche TMDB (« /abc.jpg ») ; tout autre format est ignoré. */
function poster(v: unknown): string | null {
  const p = text(v)
  return p && /^\/[A-Za-z0-9._-]+$/.test(p) ? p : null
}

/** Résultats de /search/multi : films et séries seulement, 20 au plus. */
export function mapSearch(body: Json): SearchResult[] {
  const results = Array.isArray(body.results) ? (body.results as Json[]) : []
  return results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .flatMap((r) => {
      const title = text(r.media_type === 'movie' ? r.title : r.name)
      if (!title || r.id === undefined) return []
      return [
        {
          media_type: r.media_type as 'movie' | 'tv',
          external_id: String(r.id),
          title,
          year: yearOf(r.media_type === 'movie' ? r.release_date : r.first_air_date),
          poster_path: poster(r.poster_path),
          overview: text(r.overview),
        },
      ]
    })
    .slice(0, 20)
}

/** Détails d'un film ou d'une série (avec `append_to_response=watch/providers`). */
export function mapDetails(mediaType: 'movie' | 'tv', body: Json, now = new Date()): MediaRow {
  const isMovie = mediaType === 'movie'
  const title = text(isMovie ? body.title : body.name) ?? text(isMovie ? body.original_title : body.original_name) ?? 'Sans titre'
  const episodeRuntimes = Array.isArray(body.episode_run_time) ? (body.episode_run_time as unknown[]) : []
  const genres = Array.isArray(body.genres) ? (body.genres as Json[]).map((g) => text(g.name)).filter((g): g is string => g !== null) : []
  const watch = (body['watch/providers'] as Json | undefined)?.results as Record<string, Json> | undefined
  const flatrate = (watch?.[REGION]?.flatrate as Json[] | undefined) ?? []
  return {
    source: 'tmdb',
    media_type: mediaType,
    external_id: String(body.id),
    title: title.slice(0, 300),
    original_title: text(isMovie ? body.original_title : body.original_name),
    year: yearOf(isMovie ? body.release_date : body.first_air_date),
    overview: text(body.overview),
    poster_path: poster(body.poster_path),
    runtime_min: isMovie ? positive(body.runtime) : positive(episodeRuntimes[0]),
    number_of_seasons: isMovie ? null : positive(body.number_of_seasons),
    genres: genres.length > 0 ? genres : null,
    providers:
      flatrate.length > 0
        ? flatrate.map((p) => ({ id: Number(p.provider_id), name: text(p.provider_name) ?? '?', logo_path: poster(p.logo_path) }))
        : null,
    fetched_at: now.toISOString(),
  }
}

/** Une fiche en cache est rafraîchie après 30 jours. */
export function isStale(fetchedAt: string, now = new Date()): boolean {
  return now.getTime() - new Date(fetchedAt).getTime() > 30 * 86_400_000
}

/** En-têtes d'appel : jeton de lecture v4 (Bearer) ou clé v3 passée en paramètre. */
export function tmdbRequest(path: string, key: string, params: Record<string, string> = {}): { url: string; headers: Record<string, string> } {
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  url.searchParams.set('language', LANGUAGE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const headers: Record<string, string> = { accept: 'application/json' }
  if (key.length > 40) headers.authorization = `Bearer ${key}`
  else url.searchParams.set('api_key', key)
  return { url: url.toString(), headers }
}
