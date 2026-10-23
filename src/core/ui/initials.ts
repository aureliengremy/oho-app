/**
 * Initiales affichées dans un avatar : celles du profil (AL pour Aurélien, AN pour Auriane,
 * dont les prénoms commencent tous deux par A), sinon les deux premières lettres du prénom.
 */
export function initials(name: string, chosen?: string | null): string {
  if (chosen?.trim()) return chosen.trim().toUpperCase()
  const letters = name.normalize('NFC').replace(/[^\p{L}]/gu, '')
  if (letters.length === 0) return '?'
  return letters.slice(0, 2).toUpperCase()
}
