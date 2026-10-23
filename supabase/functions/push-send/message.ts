// Mise en forme des notifications regroupées (lot 10). Pur, testé par Vitest.

export interface Digest {
  digest_id: string
  tool_key: string
  item_count: number
  actor_names: string[]
  labels: string[]
  entity_types: string[]
}

export interface PushMessage {
  title: string
  body: string
  /** Écran ouvert au toucher. */
  url: string
  /** Une notification par outil : la suivante remplace la précédente au lieu de s'empiler. */
  tag: string
}

const tools: Record<string, { label: string; path: string; one: string; many: string }> = {
  shopping: { label: 'Courses', path: '/courses', one: 'un article', many: 'articles' },
  trips: { label: 'Voyages', path: '/voyages', one: 'un élément', many: 'éléments' },
  watchlist: { label: 'À regarder', path: '/a-regarder', one: 'un titre', many: 'titres' },
  expenses: { label: 'Dépenses', path: '/depenses', one: 'une dépense', many: 'dépenses' },
}

/** « Auriane », « Auriane et Aurélien », « Quelqu’un ». */
function who(names: string[]): string {
  if (names.length === 0) return 'Quelqu’un'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}

/** Les libellés, guillemets français, « … » s'il y en a plus. */
function list(labels: string[], count: number): string {
  const quoted = labels.map((l) => `« ${l} »`)
  const text = quoted.length <= 1 ? (quoted[0] ?? '') : `${quoted.slice(0, -1).join(', ')} et ${quoted[quoted.length - 1]}`
  return count > labels.length ? `${quoted.join(', ')}…` : text
}

/**
 * « Auriane a ajouté « Lait » aux Courses. »
 * « Auriane a ajouté 3 articles aux Courses : « Lait », « Pain » et « Avocats ». »
 */
export function formatDigest(d: Digest): PushMessage {
  const tool = tools[d.tool_key] ?? { label: 'OhO', path: '/', one: 'un élément', many: 'éléments' }
  const actor = who(d.actor_names)
  const added = d.actor_names.length > 1 ? 'ont ajouté' : 'a ajouté'
  const where = tool.label === 'OhO' ? '' : ` · ${tool.label}`
  let body: string
  if (d.item_count <= 1) body = d.labels[0] ? `${actor} ${added} « ${d.labels[0]} ».` : `${actor} ${added} ${tool.one}.`
  else body = `${actor} ${added} ${d.item_count} ${tool.many}${d.labels.length > 0 ? ` : ${list(d.labels, d.item_count)}` : ''}`
  if (!body.endsWith('.') && !body.endsWith('…')) body += '.'
  return { title: `OhO${where}`, body, url: tool.path, tag: `oho-${d.tool_key}` }
}

/** Ce que l'on fait d'un appareil selon la réponse du service push. */
export function outcome(status: number): 'ok' | 'gone' | 'failed' {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 404 || status === 410) return 'gone'
  return 'failed'
}
