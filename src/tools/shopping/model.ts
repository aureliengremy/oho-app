import type { Tables } from '@/core/db/database.types'
import { labelKey } from './parse'

export type ShoppingList = Tables<'checklist'>
export type Item = Tables<'checklist_item'>
export type Category = Tables<'shopping_category'>
export type CatalogEntry = Tables<'catalog_item'>

export interface ShoppingData {
  lists: ShoppingList[]
  items: Item[]
  categories: Category[]
}

/** Un rayon de la liste et ses items à acheter ; `category` vaut null pour « Sans rayon ». */
export interface Section {
  category: Category | null
  items: Item[]
}

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order

/** Les items à acheter groupés par rayon, dans l'ordre du magasin ; les sans-rayon à la fin. */
export function sectionsFor(items: readonly Item[], categories: readonly Category[]): Section[] {
  const known = new Map(categories.map((c) => [c.id, c]))
  const groups = new Map<string | null, Item[]>()
  for (const item of items) {
    const key = item.category_id && known.has(item.category_id) ? item.category_id : null
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  const sections: Section[] = [...categories]
    .sort(bySortOrder)
    .filter((c) => groups.has(c.id))
    .map((c) => ({ category: c, items: groups.get(c.id)!.sort(bySortOrder) }))
  const loose = groups.get(null)
  if (loose) sections.push({ category: null, items: loose.sort(bySortOrder) })
  return sections
}

/** Les cochés, le plus récent en premier : ce qui est « dans le panier ». */
export function cartItems(items: readonly Item[]): Item[] {
  return items
    .filter((i) => i.checked)
    .sort((a, b) => (b.checked_at ?? '').localeCompare(a.checked_at ?? ''))
}

/** Nombre d'items à acheter par liste, pour les pastilles. */
export function remainingByList(items: readonly Item[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) if (!item.checked) counts.set(item.checklist_id, (counts.get(item.checklist_id) ?? 0) + 1)
  return counts
}

/** La liste à ouvrir : celle demandée si elle existe, sinon la liste par défaut, sinon la première. */
export function pickList(lists: readonly ShoppingList[], wanted?: string | null): ShoppingList | undefined {
  return lists.find((l) => l.id === wanted) ?? lists.find((l) => l.is_default) ?? lists[0]
}

/** Un ordre placé après tous les autres. */
export function nextSortOrder(rows: readonly { sort_order: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1
}

/**
 * Nouvel ordre pour déplacer l'élément `index` d'un cran (`direction` = -1 vers le haut, 1 vers le bas) :
 * le milieu entre ses deux nouveaux voisins, sans renuméroter les autres lignes.
 */
export function movedSortOrder(sorted: readonly { sort_order: number }[], index: number, direction: -1 | 1): number | null {
  const target = index + direction
  if (target < 0 || target >= sorted.length) return null
  const neighbour = sorted[target].sort_order
  const beyond = sorted[target + direction]?.sort_order
  if (beyond === undefined) return neighbour + direction
  return (neighbour + beyond) / 2
}

/**
 * Suggestions du catalogue pour un morceau de saisie : ce qui commence par le texte d'abord,
 * puis ce qui le contient, chaque groupe par fréquence d'achat. Sans ce qui est déjà à acheter.
 */
export function suggest(
  catalog: readonly CatalogEntry[],
  fragment: string,
  exclude: ReadonlySet<string>,
  limit = 4,
): CatalogEntry[] {
  const q = labelKey(fragment)
  if (!q) return []
  const candidates = catalog.filter((c) => !c.hidden_at && !exclude.has(c.label_key) && c.label_key.includes(q))
  const rank = (c: CatalogEntry) => (c.label_key.startsWith(q) ? 0 : 1)
  return candidates
    .sort((a, b) => rank(a) - rank(b) || b.usage_count - a.usage_count || a.label.localeCompare(b.label, 'fr'))
    .slice(0, limit)
}

/** Les achats les plus fréquents qui ne sont pas déjà à acheter, pour l'état vide. */
export function frequent(catalog: readonly CatalogEntry[], exclude: ReadonlySet<string>, limit = 6): CatalogEntry[] {
  return catalog
    .filter((c) => !c.hidden_at && !exclude.has(c.label_key) && c.usage_count > 0)
    .sort((a, b) => b.usage_count - a.usage_count || (b.last_used_at ?? '').localeCompare(a.last_used_at ?? ''))
    .slice(0, limit)
}
