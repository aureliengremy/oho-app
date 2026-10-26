import type { OhoClient } from '@/core/client'
import type { AgendaData } from './model'

export const agendaKey = (householdId: string, from: string, to: string) => ['agenda', householdId, from, to] as const

/** Erreur lisible d'un appel à la fonction serveur « agenda ». */
export class AgendaError extends Error {
  readonly code: 'non_configure' | 'indisponible'
  constructor(code: 'non_configure' | 'indisponible') {
    super(
      code === 'non_configure'
        ? 'L’agenda Google n’est pas encore relié : il manque son adresse secrète iCal côté serveur.'
        : 'L’agenda Google ne répond pas. Vérifie la connexion puis réessaie.',
    )
    this.code = code
  }
}

/** Événements de [from, to[ (jours AAAA-MM-JJ dans le fuseau de l'espace). `fresh` contourne le cache du serveur. */
export async function fetchAgenda(client: OhoClient, from: string, to: string, fresh = false): Promise<AgendaData> {
  const { data, error } = await client.functions.invoke<AgendaData>('agenda', { body: { from, to, fresh } })
  if (error || !data) {
    const status = (error as { context?: { status?: number } } | null)?.context?.status
    throw new AgendaError(status === 503 ? 'non_configure' : 'indisponible')
  }
  return data
}
