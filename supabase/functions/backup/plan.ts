// Sauvegarde hebdomadaire (lot 11, S16) : chemins et rotation. Pur, testé par Vitest.

/** Nombre de sauvegardes gardées par espace : deux mois de dimanches. */
export const KEEP = 8

/** {espace}/{AAAA-MM-JJ}.json, le premier segment sert à la policy du bucket. */
export function backupPath(householdId: string, date: Date): string {
  return `${householdId}/${date.toISOString().slice(0, 10)}.json`
}

/** Les fichiers à retirer : tout sauf les `keep` plus récents (les noms se trient comme les dates). */
export function toPrune(names: readonly string[], keep = KEEP): string[] {
  return names
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort()
    .reverse()
    .slice(keep)
}
