import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import { useHousehold } from '@/core/household/useHousehold'
import { useSync } from '@/core/sync/useSync'
import { AGENDA_REFRESH } from './model'
import { agendaKey, fetchAgenda } from './queries'

/**
 * Événements de [from, to[. Pas de temps réel côté Google : relus à l'ouverture, au retour au
 * premier plan ou du réseau, et toutes les 2 minutes tant qu'un écran les montre.
 * `refresh()` (bouton ou geste « tirer ») demande au serveur de relire le flux tout de suite.
 */
export function useAgenda(from: string, to: string) {
  const client = useClient()
  const { household } = useHousehold()
  const { online } = useSync()
  const fresh = useRef(false)
  const query = useQuery({
    queryKey: agendaKey(household.id, from, to),
    queryFn: () => {
      const force = fresh.current
      fresh.current = false
      return fetchAgenda(client, from, to, force)
    },
    refetchInterval: online ? AGENDA_REFRESH : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: 'always',
    retry: 1,
  })
  return {
    ...query,
    refresh: async () => {
      fresh.current = true
      await query.refetch()
    },
  }
}
