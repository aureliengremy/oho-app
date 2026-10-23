// Edge Function « push-send » : envoie les notifications regroupées (lot 10).
//
// Appelée chaque minute par pg_cron (pg_net), sans JWT : l'en-tête x-push-secret
// doit valoir le secret PUSH_CRON_SECRET. Elle prend les résumés échus
// (claim_push_digests), les envoie en Web Push signé VAPID, puis rend compte
// des appareils livrés, disparus ou en échec (report_push).
//
// Secrets : PUSH_CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { type Digest, formatDigest, outcome } from './message.ts'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('PUSH_CRON_SECRET')
  if (!secret || request.headers.get('x-push-secret') !== secret) return reply(401, { error: 'non_autorise' })

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return reply(503, { error: 'vapid_non_configure' })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:oho@example.com', publicKey, privateKey)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.rpc('claim_push_digests', { p_limit: 100 })
  if (error) return reply(500, { error: 'lecture_impossible' })

  const ok: string[] = []
  const gone: string[] = []
  const failed: string[] = []
  for (const digest of (data ?? []) as (Digest & { subscriptions: Subscription[] })[]) {
    const payload = JSON.stringify(formatDigest(digest))
    await Promise.all(
      digest.subscriptions.map(async (s) => {
        let status: number
        try {
          const result = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: 'normal' })
          status = result.statusCode
        } catch (cause) {
          status = (cause as { statusCode?: number }).statusCode ?? 0
        }
        ;({ ok, gone, failed })[outcome(status)].push(s.id)
      }),
    )
  }

  await admin.rpc('report_push', { p_ok: ok, p_gone: gone, p_failed: failed })
  return reply(200, { sent: ok.length, gone: gone.length, failed: failed.length })
})
