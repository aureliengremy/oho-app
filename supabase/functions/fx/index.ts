// Edge Function « fx » : propose le taux du jour d'une devise vers celle du carnet (M15).
// Le client l'affiche, la personne peut le corriger, puis il est figé dans expense.fx_rate.
//
//   POST { from: 'EUR', to: 'CAD' } → { rate: 1.52, date: '2026-11-09' }
import { createClient } from 'npm:@supabase/supabase-js@2'
import { CURRENCY, rateUrl, readRate } from './rate.ts'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return reply(405, { error: 'méthode non permise' })

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { authorization: request.headers.get('authorization') ?? '' } },
  })
  const { data: user } = await asUser.auth.getUser()
  if (!user?.user) return reply(401, { error: 'non_connecte' })

  const body = (await request.json().catch(() => null)) as { from?: string; to?: string } | null
  const from = body?.from?.toUpperCase() ?? ''
  const to = body?.to?.toUpperCase() ?? ''
  if (!CURRENCY.test(from) || !CURRENCY.test(to)) return reply(400, { error: 'devise_invalide' })
  if (from === to) return reply(200, { rate: 1, date: new Date().toISOString().slice(0, 10) })

  try {
    const response = await fetch(rateUrl(from, to))
    const found = response.ok ? readRate(await response.json(), to) : null
    if (!found) return reply(502, { error: 'taux_indisponible' })
    return reply(200, found)
  } catch {
    return reply(502, { error: 'taux_indisponible' })
  }
})
