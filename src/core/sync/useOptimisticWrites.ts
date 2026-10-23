import { useCallback, useState } from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useHousehold } from '../household/useHousehold'
import { isNetworkError } from './network'
import type { OutboxOp } from './outbox'
import { useSync } from './useSync'

const OFFLINE = 'Hors ligne : cette action attendra le réseau. Réessaie une fois connecté.'

export type Write<T> = (
  change: (data: T) => T,
  run: () => Promise<unknown>,
  failure: string,
  offline?: OutboxOp[],
) => void

/**
 * Écritures optimistes sur une requête : `change` s'applique tout de suite au cache, `run` part
 * vers Supabase, et le cache est rechargé quand plus rien n'est en vol. En cas d'échec, l'état
 * d'avant revient et `error` porte le message. Avec `offline`, une écriture rejouable attend le
 * réseau dans la file (outbox, lot 5) au lieu d'échouer.
 */
export function useOptimisticWrites<T>(key: QueryKey) {
  const queryClient = useQueryClient()
  const { household } = useHousehold()
  const { queue } = useSync()
  const [error, setError] = useState<string | null>(null)

  const { mutate } = useMutation({
    mutationKey: key,
    // Hors ligne, on ne met pas l'écriture en pause : elle part dans la file (outbox) ou échoue.
    networkMode: 'always',
    mutationFn: async ({ run, offline }: { run: () => Promise<unknown>; change: (data: T) => T; failure: string; offline?: OutboxOp[] }) => {
      if (offline && !navigator.onLine) return offline.forEach(queue)
      if (!navigator.onLine) throw new Error('offline')
      try {
        await run()
      } catch (cause) {
        // Le réseau a lâché en route : l'écriture rejouable attend, l'état affiché ne bouge pas.
        if (offline && isNetworkError(cause)) return offline.forEach(queue)
        throw cause
      }
    },
    onMutate: async ({ change }) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient.getQueryData<T>(key)
      if (previous) queryClient.setQueryData<T>(key, change(previous))
      return { previous }
    },
    onError: (_error, { failure }, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      setError(navigator.onLine ? failure : OFFLINE)
    },
    onSettled: () => {
      // Recharger seulement quand la dernière écriture est revenue, sinon on écraserait
      // l'état optimiste des écritures encore en vol.
      if (queryClient.isMutating({ mutationKey: key }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: key })
        void queryClient.invalidateQueries({ queryKey: ['activity', household.id] })
      }
    },
  })

  const write = useCallback<Write<T>>((change, run, failure, offline) => mutate({ change, run, failure, offline }), [mutate])
  const dismissError = useCallback(() => setError(null), [])
  return { write, error, dismissError }
}
