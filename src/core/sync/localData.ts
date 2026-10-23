/** Clé du cache des requêtes persisté pour la lecture hors ligne (décision T10). */
export const CACHE_KEY = 'oho.cache'

/** Efface ce que l'app garde sur l'appareil pour le compte : cache des lectures et files d'attente. */
export function clearLocalData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key === CACHE_KEY || key.startsWith('oho.outbox.')) localStorage.removeItem(key)
    }
  } catch {
    // Stockage indisponible : rien à effacer.
  }
}
