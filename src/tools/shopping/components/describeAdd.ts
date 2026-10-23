import type { AddResult } from '../useShopping'

/** Phrase courte pour la zone d'annonce : ce que l'ajout a fait. */
export function describeAdd({ added, restored, skipped }: AddResult): string {
  const parts: string[] = []
  if (added.length === 1) parts.push(`${added[0]} ajouté`)
  else if (added.length > 1) parts.push(`${added.length} articles ajoutés`)
  if (restored.length > 0) parts.push(`${restored.join(', ')} ressorti${restored.length > 1 ? 's' : ''} du panier`)
  if (skipped.length > 0) parts.push(`${skipped.join(', ')} déjà dans la liste`)
  return parts.join(' · ')
}
