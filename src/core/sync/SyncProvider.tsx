import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient, type Query } from '@tanstack/react-query'
import { tools } from '@/tools/registry'
import { useClient } from '../client'
import { useHousehold } from '../household/useHousehold'
import { useOnline } from './network'
import { createOutboxStore, flush, type OutboxOp, type OutboxStore } from './outbox'
import { CORE_TABLES, POLL_INTERVAL, SyncContext, type RealtimeState, type SyncValue } from './useSync'

const tablesOf = (query: Query): readonly string[] => (query.meta?.tables as string[] | undefined) ?? []

/**
 * Synchronisation de l'espace (lot 5) :
 * - un canal Realtime par espace ; un changement sur une table invalide les requêtes qui la lisent ;
 * - reprise au retour au premier plan et au retour du réseau (réabonnement + rechargement) ;
 * - file d'attente hors ligne persistée, rejouée dès que le réseau revient.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household } = useHousehold()
  const online = useOnline()
  const [realtime, setRealtime] = useState<RealtimeState>('connecting')
  const [rejected, setRejected] = useState<OutboxOp[]>([])
  const [generation, setGeneration] = useState(0)

  const store = useMemo<OutboxStore>(() => createOutboxStore(`oho.outbox.${household.id}`), [household.id])
  const outbox = useSyncExternalStore(store.subscribe, store.get, store.get)

  // Invalide, par petits paquets, les requêtes qui lisent les tables touchées. Une requête dont une
  // écriture est en vol est laissée de côté : la fin de l'écriture la rechargera.
  const touched = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const invalidate = useCallback(
    (tables: Iterable<string> | 'all') => {
      if (tables === 'all') {
        void queryClient.invalidateQueries({ predicate: (q) => tablesOf(q).length > 0 })
        return
      }
      for (const t of tables) touched.current.add(t)
      if (timer.current) return
      timer.current = setTimeout(() => {
        timer.current = null
        const batch = new Set(touched.current)
        touched.current.clear()
        void queryClient.invalidateQueries({
          predicate: (q) =>
            tablesOf(q).some((t) => batch.has(t)) && queryClient.isMutating({ mutationKey: q.queryKey }) === 0,
        })
      }, 150)
    },
    [queryClient],
  )
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  // Canal Realtime. `generation` le recrée après une coupure.
  useEffect(() => {
    const tables = [...CORE_TABLES, ...tools.flatMap((t) => t.tables)]
    let channel = client.channel(`oho:${household.id}:${generation}`)
    for (const table of tables) {
      const filter = table === 'household' ? `id=eq.${household.id}` : `household_id=eq.${household.id}`
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => invalidate([table]))
    }
    let wasDown = generation > 0
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setRealtime('live')
        // Ce qui a changé pendant la coupure n'est pas arrivé par le canal : on recharge.
        if (wasDown) invalidate('all')
        wasDown = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setRealtime('down')
        wasDown = true
      }
    })
    return () => {
      void client.removeChannel(channel)
    }
  }, [client, household.id, generation, invalidate])

  // Rejeu de la file : au montage, au retour du réseau et au retour au premier plan.
  const flushing = useRef(false)
  const replay = useCallback(async () => {
    if (flushing.current || !navigator.onLine || store.get().length === 0) return
    flushing.current = true
    try {
      const pending = store.get()
      const result = await flush(client, pending)
      const done = new Set([...result.sent, ...result.rejected.map((op) => op.id)])
      if (result.rejected.length > 0) setRejected((r) => [...r, ...result.rejected])
      if (done.size > 0) {
        const tables = new Set(pending.filter((op) => done.has(op.id)).map((op) => op.table))
        // On garde les écritures affichées jusqu'à ce que l'état du serveur les contienne.
        await queryClient.refetchQueries({ predicate: (q) => tablesOf(q).some((t) => tables.has(t)) })
        store.remove(done)
      }
    } finally {
      flushing.current = false
    }
  }, [client, queryClient, store])

  useEffect(() => {
    if (!online || outbox.length === 0) return
    void replay()
    // En ligne mais serveur injoignable : on retente régulièrement.
    const retry = setInterval(() => void replay(), POLL_INTERVAL)
    return () => clearInterval(retry)
  }, [online, replay, outbox.length])

  // Retour au premier plan ou du réseau : si le canal est tombé, on le recrée.
  const realtimeRef = useRef(realtime)
  useEffect(() => {
    realtimeRef.current = realtime
  }, [realtime])
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      void replay()
      if (realtimeRef.current === 'down') {
        setRealtime('connecting')
        setGeneration((g) => g + 1)
      }
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    return () => {
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
    }
  }, [replay])

  const value = useMemo<SyncValue>(
    () => ({
      online,
      realtime,
      outbox,
      queue: store.add,
      rejected,
      dismissRejected: () => setRejected([]),
    }),
    [online, realtime, outbox, store, rejected],
  )
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
