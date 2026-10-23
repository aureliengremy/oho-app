import { createContext, useContext } from 'react'
import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query'
import type { OutboxOp } from './outbox'

/** État du canal temps réel : abonné, en cours de (re)connexion, ou tombé (repli en polling). */
export type RealtimeState = 'connecting' | 'live' | 'down'

/** Tables du socle suivies en temps réel ; chaque outil ajoute les siennes dans le registre. */
export const CORE_TABLES = ['household', 'membership', 'tool_activation', 'activity_log'] as const

/** Intervalle du repli en polling quand le temps réel ne répond pas (décision T9). */
export const POLL_INTERVAL = 30_000

/** Pas de polling quand le temps réel tient, ni hors ligne (rien ne passerait). */
export function pollInterval(realtime: RealtimeState, online: boolean): number | false {
  return realtime !== 'live' && online ? POLL_INTERVAL : false
}

export interface SyncValue {
  online: boolean
  realtime: RealtimeState
  outbox: readonly OutboxOp[]
  /** Met une écriture en file d'attente ; elle partira au retour du réseau. */
  queue: (op: OutboxOp) => void
  /** Écritures refusées par le serveur au rejeu, à montrer une fois. */
  rejected: readonly OutboxOp[]
  dismissRejected: () => void
}

export const SyncContext = createContext<SyncValue | null>(null)

const offlineDefault: SyncValue = {
  online: true,
  realtime: 'down',
  outbox: [],
  queue: () => {
    throw new Error('queue appelée hors de <SyncProvider>')
  },
  rejected: [],
  dismissRejected: () => {},
}

/** État de la synchronisation. Hors de <SyncProvider> : en ligne, sans temps réel, sans file. */
export function useSync(): SyncValue {
  return useContext(SyncContext) ?? offlineDefault
}

/**
 * useQuery qui reste à jour tout seul : rechargé quand une des `tables` change (Realtime), au retour
 * au premier plan et au retour du réseau, et toutes les 30 s quand le temps réel ne répond pas.
 * Relue aussi à chaque ouverture d'un écran qui l'utilise.
 * C'est le hook que chaque outil utilise pour ses lectures.
 */
export function useLiveQuery<TData, TKey extends QueryKey>(
  options: UseQueryOptions<TData, Error, TData, TKey> & { tables: readonly string[] },
) {
  const { realtime, online } = useSync()
  const { tables, ...query } = options
  return useQuery({
    ...query,
    meta: { ...query.meta, tables },
    refetchInterval: pollInterval(realtime, online),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Toujours relire à l'ouverture : le cache de l'appareil peut être restauré d'avant une écriture
    // (voir `isSettled`). Les données du cache s'affichent pendant ce temps.
    refetchOnMount: 'always',
  })
}

/**
 * Vrai quand la requête a été relue depuis l'ouverture de l'écran, ou ne peut pas l'être (hors
 * ligne, erreur). Avant cela, les données viennent peut-être du cache de l'appareil : un voyage
 * créé depuis, ou ouvert par un lien, y manque encore. Un écran ne conclut « introuvable » qu'après.
 */
export function isSettled(query: { isFetchedAfterMount: boolean; fetchStatus: string; isError: boolean }) {
  return query.isFetchedAfterMount || query.fetchStatus === 'paused' || query.isError
}
