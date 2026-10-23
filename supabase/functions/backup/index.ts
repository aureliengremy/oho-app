// Edge Function « backup » : sauvegarde hebdomadaire de chaque espace (lot 11, S16).
//
// Appelée le dimanche par pg_cron (pg_net), sans JWT : l'en-tête x-cron-secret doit
// valoir PUSH_CRON_SECRET (le secret partagé des tâches planifiées). Pour chaque
// espace, export_household → bucket privé « backups » ({espace}/{AAAA-MM-JJ}.json),
// puis rotation : les huit plus récentes restent.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { backupPath, toPrune } from './plan.ts'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (request) => {
  const secret = Deno.env.get('PUSH_CRON_SECRET')
  if (!secret || request.headers.get('x-cron-secret') !== secret) return reply(401, { error: 'non_autorise' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: households, error } = await admin.from('household').select('id')
  if (error) return reply(500, { error: 'lecture_impossible' })

  const saved: string[] = []
  const failed: string[] = []
  for (const { id } of households ?? []) {
    const { data: dump, error: exportError } = await admin.rpc('export_household', { p_household: id })
    const path = backupPath(id, new Date())
    const upload = exportError
      ? { error: exportError }
      : await admin.storage.from('backups').upload(path, new Blob([JSON.stringify(dump)], { type: 'application/json' }), {
          contentType: 'application/json',
          upsert: true,
        })
    if (upload.error) {
      failed.push(id)
      continue
    }
    saved.push(path)
    const { data: files } = await admin.storage.from('backups').list(id, { limit: 100 })
    const old = toPrune((files ?? []).map((f) => f.name))
    if (old.length > 0) await admin.storage.from('backups').remove(old.map((n) => `${id}/${n}`))
  }
  return reply(failed.length > 0 ? 207 : 200, { saved, failed })
})
