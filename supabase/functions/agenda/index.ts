// Edge Function « agenda » : la seule à connaître l'adresse secrète iCal de l'agenda Google commun
// (secret AGENDA_ICAL_URL, https://calendar.google.com/calendar/ical/…/basic.ics). Lecture seule.
//
//   POST { from: 'AAAA-MM-JJ', to: 'AAAA-MM-JJ', fresh?: boolean } → { events: AgendaEvent[], zone, fetched_at }
//
// `to` est exclu ; les jours sont lus dans le fuseau de l'espace. Le flux est gardé une minute en
// mémoire (deux personnes, rechargement toutes les 2 min) ; `fresh` force une relecture.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { expandCalendar, wallToInstant } from './expand.ts'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const CACHE_MS = 60_000
const MAX_DAYS = 400
const MAX_BYTES = 5_000_000
let cache: { text: string; at: number } | null = null

async function readFeed(url: string, fresh: boolean): Promise<{ text: string; at: number }> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { accept: 'text/calendar' } })
  if (!response.ok) throw new Error(`ical ${response.status}`)
  const text = await response.text()
  if (text.length > MAX_BYTES || !text.includes('BEGIN:VCALENDAR')) throw new Error('ical illisible')
  cache = { text, at: Date.now() }
  return cache
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return reply(405, { error: 'méthode non permise' })

  const feedUrl = Deno.env.get('AGENDA_ICAL_URL')
  // Toujours un agenda Google : on refuse toute autre adresse (la fonction ne lit rien d'autre).
  if (!feedUrl?.startsWith('https://calendar.google.com/calendar/ical/')) return reply(503, { error: 'agenda_non_configure' })

  // Un membre d'un espace seulement. Le jeton est passé à getUser (voir la fonction tmdb).
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: user } = jwt ? await asUser.auth.getUser(jwt) : { data: null }
  if (!user?.user) return reply(401, { error: 'non_connecte' })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: membership } = await admin
    .from('membership')
    .select('household:household_id (timezone)')
    .eq('user_id', user.user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (!membership) return reply(403, { error: 'hors_espace' })
  const zone = (membership.household as { timezone?: string } | null)?.timezone ?? 'America/Toronto'

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return reply(400, { error: 'json_invalide' })
  }
  const from = typeof body.from === 'string' ? DAY.exec(body.from) : null
  const to = typeof body.to === 'string' ? DAY.exec(body.to) : null
  if (!from || !to) return reply(400, { error: 'parametres_invalides' })
  const midnight = (m: RegExpExecArray) => wallToInstant({ year: +m[1], month: +m[2], day: +m[3], hour: 0, minute: 0, second: 0 }, zone)
  const start = midnight(from)
  const end = midnight(to)
  if (!(end > start) || end - start > MAX_DAYS * 86_400_000) return reply(400, { error: 'periode_invalide' })

  try {
    const feed = await readFeed(feedUrl, body.fresh === true)
    const events = expandCalendar(feed.text, new Date(start), new Date(end), zone)
    return reply(200, { events, zone, fetched_at: new Date(feed.at).toISOString() })
  } catch (cause) {
    // L'adresse secrète ne doit jamais finir dans les journaux.
    console.error('agenda', cause instanceof Error ? cause.message : 'erreur')
    return reply(502, { error: 'agenda_indisponible' })
  }
})
