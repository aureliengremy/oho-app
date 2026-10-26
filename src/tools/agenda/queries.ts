import type { OhoClient } from '@/core/client'
import type { AgendaData } from './model'

export const agendaKey = (householdId: string, from: string, to: string) => ['agenda', householdId, from, to] as const

type AgendaErrorCode = 'non_configure' | 'refuse' | 'indisponible'

const messages: Record<AgendaErrorCode, string> = {
  non_configure: 'L’agenda Google n’est pas encore relié : il manque son adresse secrète iCal côté serveur.',
  refuse: 'Google refuse l’adresse de l’agenda. Il faut l’« adresse secrète au format iCal » (et non l’adresse publique), ou la nouvelle si elle a été réinitialisée.',
  indisponible: 'L’agenda Google ne répond pas. Vérifie la connexion puis réessaie.',
}

/** Erreur lisible d'un appel à la fonction serveur « agenda ». */
export class AgendaError extends Error {
  readonly code: AgendaErrorCode
  constructor(code: AgendaErrorCode) {
    super(messages[code])
    this.code = code
  }
}

/** Événements de [from, to[ (jours AAAA-MM-JJ dans le fuseau de l'espace). `fresh` contourne le cache du serveur. */
export async function fetchAgenda(client: OhoClient, from: string, to: string, fresh = false): Promise<AgendaData> {
  const { data, error } = await client.functions.invoke<AgendaData>('agenda', { body: { from, to, fresh } })
  if (error || !data) {
    const context = (error as { context?: { status?: number; json?: () => Promise<{ error?: string }> } } | null)?.context
    const body = await context?.json?.().catch(() => null)
    if (body?.error === 'agenda_refuse') throw new AgendaError('refuse')
    throw new AgendaError(context?.status === 503 ? 'non_configure' : 'indisponible')
  }
  return data
}
