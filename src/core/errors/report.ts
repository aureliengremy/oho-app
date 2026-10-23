import type { OhoClient } from '../client'

/**
 * Journal d'erreurs léger (lot 11, à la place de Sentry) : chaque erreur non rattrapée part
 * dans `client_error`, lisible par les membres sur « État du système ». Une même erreur n'est
 * envoyée qu'une fois par session, et pas plus de 20 erreurs par session.
 */

export const MAX_PER_SESSION = 20

export interface ErrorRow {
  household_id: string
  message: string
  stack: string | null
  path: string
  user_agent: string
  release: string
}

/** Message et pile lisibles depuis n'importe quoi de lancé. */
export function describeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`.slice(0, 1000), stack: error.stack?.slice(0, 4000) ?? null }
  const text = typeof error === 'string' ? error : (() => {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  })()
  return { message: (text || 'Erreur inconnue').slice(0, 1000), stack: null }
}

export function createReporter(client: OhoClient, householdId: string, limit = MAX_PER_SESSION) {
  const seen = new Set<string>()
  return async (error: unknown): Promise<boolean> => {
    const { message, stack } = describeError(error)
    if (seen.has(message) || seen.size >= limit) return false
    seen.add(message)
    const row: ErrorRow = {
      household_id: householdId,
      message,
      stack,
      // Le chemin seulement : pas de paramètres d'URL dans le journal.
      path: window.location.pathname.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 300),
      release: __APP_RELEASE__,
    }
    // Signaler une erreur ne doit jamais en provoquer une autre.
    try {
      const { error: failure } = await client.from('client_error').insert(row)
      return !failure
    } catch {
      return false
    }
  }
}

let current: ((error: unknown) => Promise<boolean>) | null = null

/** Le rapporteur de la session (posé par <ErrorReporter />), utilisable hors de React. */
export function setReporter(reporter: typeof current) {
  current = reporter
}

export function reportError(error: unknown): void {
  void current?.(error)
}
