import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import { BACKUP_BUCKET, backupFileName, downloadJson, exportHousehold, readBackup, restoreBackup, type Backup, type BackupSummary } from '@/core/backup/backup'
import { useHousehold } from '@/core/household/useHousehold'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { relativeTime } from '@/core/lib/time'
import { useSync } from '@/core/sync/useSync'
import { Button } from '@/core/ui/Button'

const heading = 'font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3'
const tones = { ok: 'bg-ok-tint text-ok', warn: 'bg-warn-tint text-warn', bad: 'bg-bad-tint text-bad', neutral: 'bg-surface text-ink-2' } as const
const longDate = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const shortDate = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })

function Row({ label, tone, value, detail }: { label: string; tone: keyof typeof tones; value: string; detail?: ReactNode }) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span className="flex flex-1 flex-col">
        <span className="text-ink">{label}</span>
        {detail ? <span className="text-sm text-ink-3">{detail}</span> : null}
      </span>
      <span className={cn('rounded-pill px-2.5 py-0.5 font-mono text-[11.5px] font-semibold tracking-[0.06em] uppercase', tones[tone])}>{value}</span>
    </li>
  )
}

/** « État du système » : la santé de l'app, les sauvegardes et les erreurs récentes (lot 11). */
export function StatusScreen() {
  return (
    <>
      <ScreenHeader title="État du système" back="/reglages" />
      <div className="flex flex-col gap-8 px-5 pb-10">
        <Health />
        <Backups />
        <Errors />
      </div>
    </>
  )
}

function Health() {
  const client = useClient()
  const { online, realtime, outbox } = useSync()
  const ping = useQuery({
    queryKey: ['status-ping'],
    queryFn: async () => {
      const start = performance.now()
      const { error } = await client.rpc('ping')
      if (error) throw error
      return Math.round(performance.now() - start)
    },
    retry: false,
  })

  return (
    <section className="flex flex-col gap-3" aria-labelledby="etat">
      <h2 id="etat" className={heading}>
        État
      </h2>
      <ul className="flex flex-col divide-y divide-rule rounded-lg bg-surface-2">
        <Row label="Réseau" tone={online ? 'ok' : 'warn'} value={online ? 'En ligne' : 'Hors ligne'} />
        <Row
          label="Serveur"
          tone={ping.isPending ? 'neutral' : ping.isError ? 'bad' : 'ok'}
          value={ping.isPending ? 'Test…' : ping.isError ? 'Injoignable' : 'Joignable'}
          detail={ping.data !== undefined ? `Réponse en ${ping.data} ms` : undefined}
        />
        <Row
          label="Temps réel"
          tone={realtime === 'live' ? 'ok' : realtime === 'connecting' ? 'neutral' : 'warn'}
          value={realtime === 'live' ? 'En direct' : realtime === 'connecting' ? 'Connexion…' : 'Coupé'}
          detail={realtime === 'down' ? 'Les écrans se rechargent toutes les 30 s.' : undefined}
        />
        <Row
          label="Modifications en attente"
          tone={outbox.length > 0 ? 'warn' : 'ok'}
          value={outbox.length > 0 ? `${outbox.length} en attente` : 'Aucune'}
        />
        <Row label="Version" tone="neutral" value={__APP_RELEASE__} detail={`Construite le ${longDate.format(new Date(__APP_BUILT_AT__))}`} />
      </ul>
    </section>
  )
}

function Backups() {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household } = useHousehold()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(null)

  const weekly = useQuery({
    queryKey: ['backups', household.id],
    queryFn: async () => {
      const { data, error } = await client.storage.from(BACKUP_BUCKET).list(household.id, { limit: 20, sortBy: { column: 'name', order: 'desc' } })
      if (error) throw error
      return (data ?? []).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name))
    },
  })

  const exportNow = async () => {
    setBusy('export')
    setMessage(null)
    try {
      downloadJson(backupFileName(), await exportHousehold(client, household.id))
      setMessage({ tone: 'ok', text: 'Export téléchargé. Garde-le en lieu sûr : il contient toutes les données de l’espace.' })
    } catch (cause) {
      setMessage({ tone: 'bad', text: (cause as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage(null)
    const result = readBackup(await file.text(), household.id)
    if ('error' in result) {
      setPending(null)
      setMessage({ tone: 'bad', text: result.error })
    } else setPending(result)
  }

  const restore = async () => {
    if (!pending) return
    setBusy('restore')
    try {
      const count = await restoreBackup(client, pending.backup)
      setPending(null)
      setMessage({ tone: 'ok', text: `Restauré : ${count} ligne${count > 1 ? 's' : ''} remises comme dans la sauvegarde.` })
      await queryClient.invalidateQueries()
    } catch (cause) {
      setMessage({ tone: 'bad', text: (cause as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const open = async (name: string) => {
    const tab = window.open('', '_blank')
    const { data, error } = await client.storage.from(BACKUP_BUCKET).createSignedUrl(`${household.id}/${name}`, 60)
    if (error || !data) {
      tab?.close()
      setMessage({ tone: 'bad', text: 'La sauvegarde ne s’ouvre pas. Réessaie.' })
    } else if (tab) tab.location.href = data.signedUrl
    else window.location.assign(data.signedUrl)
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="sauvegardes">
      <h2 id="sauvegardes" className={heading}>
        Sauvegardes
      </h2>
      <p className="text-sm text-ink-2">Un export contient tout l’espace : listes, voyages, titres, dépenses et réglages, en un fichier JSON.</p>
      <div className="flex flex-col gap-2">
        <Button onClick={exportNow} disabled={busy !== null}>
          <Download size={18} aria-hidden="true" />
          {busy === 'export' ? 'Export…' : 'Exporter l’espace'}
        </Button>
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy !== null}>
          <Upload size={18} aria-hidden="true" />
          Restaurer depuis un fichier
        </Button>
        <input ref={input} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Fichier de sauvegarde" onChange={choose} />
      </div>

      {pending ? (
        <div role="dialog" aria-label="Restaurer cette sauvegarde ?" className="flex flex-col gap-3 rounded-lg border border-warn bg-warn-tint px-4 py-4 text-warn">
          <p className="font-semibold">Restaurer la sauvegarde du {pending.summary.exportedAt ? longDate.format(new Date(pending.summary.exportedAt)) : '?'} ?</p>
          <p className="text-sm">
            {pending.summary.rows} lignes reviendront comme à ce moment-là, y compris ce qui a été supprimé ou modifié depuis. Ce qui a été ajouté après la sauvegarde reste en place.
          </p>
          <div className="flex gap-2">
            <Button onClick={restore} disabled={busy !== null} className="flex-1">
              <RotateCcw size={18} aria-hidden="true" />
              {busy === 'restore' ? 'Restauration…' : 'Restaurer'}
            </Button>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy !== null}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p role={message.tone === 'bad' ? 'alert' : 'status'} className={cn('rounded-md px-4 py-2 text-sm', tones[message.tone])}>
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <h3 className={heading}>Chaque dimanche</h3>
        {weekly.isPending ? null : weekly.isError || weekly.data.length === 0 ? (
          <p className="text-sm text-ink-2">La sauvegarde automatique n’a pas encore tourné : elle part chaque dimanche une fois branchée sur le serveur.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rule" aria-label="Sauvegardes automatiques">
            {weekly.data.map((f) => (
              <li key={f.name}>
                <button type="button" onClick={() => open(f.name)} className="flex min-h-12 w-full items-center gap-3 text-left">
                  <span className="flex-1 text-ink">{shortDate.format(new Date(`${f.name.slice(0, 10)}T00:00:00Z`))}</span>
                  <span className="text-sm font-semibold text-accent-ink">Télécharger</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Errors() {
  const client = useClient()
  const { household, memberById } = useHousehold()
  const errors = useQuery({
    queryKey: ['client-errors', household.id],
    queryFn: async () => {
      const { data, error } = await client
        .from('client_error')
        .select('id, message, path, release, user_id, created_at')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <section className="flex flex-col gap-3" aria-labelledby="erreurs">
      <h2 id="erreurs" className={heading}>
        Erreurs récentes
      </h2>
      {errors.isPending ? null : errors.isError ? (
        <p className="text-sm text-ink-2">Le journal d’erreurs ne s’est pas chargé.</p>
      ) : errors.data.length === 0 ? (
        <p className="rounded-lg bg-ok-tint px-4 py-3 text-ok">Aucune erreur signalée depuis 30 jours.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule" aria-label="Erreurs récentes">
          {errors.data.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 py-2">
              <span className="font-mono text-sm break-words text-ink">{e.message}</span>
              <span className="text-sm text-ink-3">
                {[memberById(e.user_id)?.profile.display_name, e.path, e.release, relativeTime(e.created_at)].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
