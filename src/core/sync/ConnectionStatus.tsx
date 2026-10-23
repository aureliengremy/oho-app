import { RefreshCw, WifiOff } from 'lucide-react'
import { useSync } from './useSync'

const clock = new Intl.DateTimeFormat('fr-CA', { hour: 'numeric', minute: '2-digit' })

function modifications(count: number): string {
  return count > 1 ? `${count} modifications` : '1 modification'
}

/** « En direct » quand le canal temps réel tient : ce que fait l'autre arrive tout seul. */
export function LiveBadge() {
  const { online, realtime } = useSync()
  if (!online || realtime !== 'live') return null
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-[0.06em] text-ok uppercase">
      <RefreshCw size={13} strokeWidth={2.4} aria-hidden="true" />
      En direct
    </span>
  )
}

/**
 * Bandeau d'état de la connexion, sous la barre de titre : hors ligne (paire « attention »),
 * envoi des écritures en attente, ou écritures refusées au retour du réseau (paire « erreur »).
 */
export function ConnectionBanner({ updatedAt }: { updatedAt?: number }) {
  const { online, outbox, rejected, dismissRejected } = useSync()
  return (
    <>
      {!online ? (
        <div role="status" className="flex items-start gap-2.5 bg-warn-tint px-5 py-2.5 text-warn">
          <WifiOff size={18} className="mt-0.5 flex-none" aria-hidden="true" />
          <p className="flex-1 text-[14.5px] font-semibold">
            {outbox.length > 0 ? `Hors ligne · ${modifications(outbox.length)} en attente` : 'Hors ligne · dernier état connu'}
            {updatedAt ? (
              <span className="block text-sm font-normal">Dernière synchro à {clock.format(updatedAt)}</span>
            ) : null}
          </p>
        </div>
      ) : outbox.length > 0 ? (
        <div role="status" className="flex items-center gap-2.5 bg-warn-tint px-5 py-2.5 text-warn">
          <RefreshCw size={18} className="flex-none" aria-hidden="true" />
          <p className="flex-1 text-[14.5px] font-semibold">Envoi de {modifications(outbox.length)}…</p>
        </div>
      ) : null}
      {rejected.length > 0 ? (
        <div role="alert" className="flex items-center gap-3 bg-bad-tint px-5 py-2.5 text-bad">
          <p className="flex-1 text-sm">
            {rejected.length > 1
              ? `${rejected.length} modifications faites hors ligne ont été refusées par le serveur.`
              : 'Une modification faite hors ligne a été refusée par le serveur.'}
          </p>
          <button type="button" onClick={dismissRejected} className="min-h-11 px-2 text-sm font-semibold">
            Fermer
          </button>
        </div>
      ) : null}
    </>
  )
}
