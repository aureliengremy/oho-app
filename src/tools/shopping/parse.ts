/** Une entrée de l'ajout rapide : « 3 avocats » donne { label: 'Avocats', quantity: '3' }. */
export interface QuickEntry {
  label: string
  quantity: string | null
}

/** Clé de comparaison, la même que `catalog_item.label_key` en base (lower + btrim, décision M7). */
export function labelKey(label: string): string {
  return label.trim().toLowerCase()
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1)
}

// « 3 avocats », « 12 œufs » : un nombre puis un mot d'au moins deux lettres.
// « 2 L de lait » ou « 500 g beurre » restent tels quels (unité d'une lettre).
const leadingCount = /^(\d{1,3})\s+(\p{L}{2,}.*)$/u
// « avocats x3 », « avocats ×3 »
const trailingCount = /^(.+?)\s*[x×]\s*(\d{1,3})$/u

function parseEntry(raw: string): QuickEntry | null {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const lead = leadingCount.exec(text)
  if (lead) return { label: capitalize(lead[2]), quantity: lead[1] }
  const trail = trailingCount.exec(text)
  if (trail) return { label: capitalize(trail[1]), quantity: trail[2] }
  return { label: capitalize(text), quantity: null }
}

/** Découpe la saisie rapide (« lait, œufs, pain ») : virgule, point-virgule ou retour à la ligne. */
export function parseQuickAdd(input: string): QuickEntry[] {
  const seen = new Set<string>()
  const entries: QuickEntry[] = []
  for (const part of input.split(/[,;\n]/)) {
    const entry = parseEntry(part)
    if (!entry || seen.has(labelKey(entry.label))) continue
    seen.add(labelKey(entry.label))
    entries.push(entry)
  }
  return entries
}

/** Le dernier morceau en cours de frappe, pour l'auto-complétion. */
export function currentFragment(input: string): string {
  const parts = input.split(/[,;\n]/)
  return parts[parts.length - 1].trim()
}

/** Remplace le morceau en cours par rien : ce qui reste après un ajout depuis une suggestion. */
export function dropFragment(input: string): string {
  const index = Math.max(input.lastIndexOf(','), input.lastIndexOf(';'), input.lastIndexOf('\n'))
  return index === -1 ? '' : input.slice(0, index + 1) + ' '
}

/** Affichage de la quantité : « ×3 » pour un nombre seul, le texte libre sinon (« 2 L »). */
export function formatQuantity(quantity: string | null | undefined): string | null {
  const q = quantity?.trim()
  if (!q) return null
  return /^\d+$/.test(q) ? `×${q}` : q
}
