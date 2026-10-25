// Edge Function « tmdb » : la seule à connaître la clé TMDB (secret TMDB_API_KEY).
//
//   POST { action: 'search', query }                   → { results: SearchResult[] }
//   POST { action: 'import', media_type, external_id } → { media: external_media }
//
// L'appel exige un compte connecté (JWT vérifié par Supabase). L'import écrit le
// cache global external_media avec la clé service, puis le renvoie.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isStale, mapDetails, mapSearch, REGION, tmdbRequest } from './map.ts'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

async function tmdb(path: string, key: string, params: Record<string, string> = {}) {
  const { url, headers } = tmdbRequest(path, key, params)
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`tmdb ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return reply(405, { error: 'méthode non permise' })

  const key = Deno.env.get('TMDB_API_KEY')
  if (!key) return reply(503, { error: 'tmdb_non_configure' })

  // Un compte connecté seulement : la clé anon seule ne suffit pas.
  // Le jeton est passé à getUser : sans argument, supabase-js cherche une session
  // locale (vide côté serveur) et ne lit pas l'en-tête.
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: user } = jwt ? await asUser.auth.getUser(jwt) : { data: null }
  if (!user?.user) return reply(401, { error: 'non_connecte' })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return reply(400, { error: 'json_invalide' })
  }

  try {
    if (body.action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100) : ''
      if (query.length < 2) return reply(200, { results: [] })
      const found = await tmdb('/search/multi', key, { query, region: REGION, include_adult: 'false' })
      return reply(200, { results: mapSearch(found) })
    }

    if (body.action === 'import') {
      const mediaType = body.media_type === 'movie' || body.media_type === 'tv' ? body.media_type : null
      const externalId = typeof body.external_id === 'string' && /^\d{1,12}$/.test(body.external_id) ? body.external_id : null
      if (!mediaType || !externalId) return reply(400, { error: 'parametres_invalides' })

      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: cached } = await admin
        .from('external_media')
        .select('*')
        .eq('source', 'tmdb')
        .eq('media_type', mediaType)
        .eq('external_id', externalId)
        .maybeSingle()
      if (cached && !isStale(cached.fetched_at)) return reply(200, { media: cached })

      const details = await tmdb(`/${mediaType}/${externalId}`, key, { append_to_response: 'watch/providers' })
      const { data, error } = await admin
        .from('external_media')
        .upsert(mapDetails(mediaType, details), { onConflict: 'source,media_type,external_id' })
        .select('*')
        .single()
      if (error) throw error
      return reply(200, { media: data })
    }

    return reply(400, { error: 'action_inconnue' })
  } catch (cause) {
    console.error(cause)
    return reply(502, { error: 'tmdb_indisponible' })
  }
})
