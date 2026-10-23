import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Vrai tant que le navigateur se dit en ligne (navigator.onLine et ses événements). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

/**
 * Une erreur de réseau (requête jamais arrivée) plutôt qu'un refus du serveur. supabase-js la rend
 * avec un code vide et un message « Failed to fetch » ; hors ligne, toute erreur compte comme réseau.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (error instanceof TypeError) return true
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof message === 'string' && /failed to fetch|network|load failed|fetch failed/i.test(message)) return true
  return code === '' && typeof message === 'string' && message.length > 0 && !/permission|violates|denied/i.test(message)
}
