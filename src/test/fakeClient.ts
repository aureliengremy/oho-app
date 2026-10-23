import { vi } from 'vitest'
import type { OhoClient } from '@/core/client'

type Row = Record<string, unknown>
type Rows = Record<string, Row[]>
type Filter = (row: Row) => boolean

/**
 * Faux client Supabase pour les tests d'écran : une session (ou aucune) et une petite base en
 * mémoire. Le constructeur de requêtes comprend les chaînages usuels (eq, is, in, order, limit,
 * single), insert et update, ce qui permet de vérifier ce que l'écran a écrit avec `client.rows`.
 * Les projections de `select` sont ignorées : les lignes du jeu de test portent déjà leurs jointures.
 */
export function fakeClient({ userId = null as string | null, rows = {} as Rows } = {}) {
  let listener: ((event: string, session: unknown) => void) | null = null
  const session = (id: string | null) => (id ? { user: { id }, access_token: 't' } : null)
  let current = session(userId)
  const db: Rows = structuredClone(rows)
  /** Fait échouer la prochaine écriture sur cette table (test du retour arrière). */
  const failNext = new Set<string>()

  const auth = {
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: string, s: unknown) => void) => {
      listener = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signInWithPassword: vi.fn(async ({ password }: { email: string; password: string }) => {
      if (password !== 'bon-mot-de-passe') return { data: {}, error: { message: 'Invalid login credentials' } }
      current = session('user-a')
      listener?.('SIGNED_IN', current)
      return { data: {}, error: null }
    }),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => {
      current = null
      listener?.('SIGNED_OUT', null)
      return { error: null }
    }),
  }

  const from = vi.fn((table: string) => {
    const filters: Filter[] = []
    let op: { kind: 'select' } | { kind: 'insert'; rows: Row[] } | { kind: 'update'; patch: Row } = { kind: 'select' }
    let sort: { column: string; ascending: boolean } | null = null
    let max: number | null = null
    let one: 'single' | 'maybe' | null = null

    const run = () => {
      const tableRows = (db[table] ??= [])
      if (op.kind !== 'select' && failNext.delete(table)) {
        return { data: null, error: { message: `échec simulé sur ${table}`, code: 'XX000' } }
      }
      if (op.kind === 'insert') {
        const stamp = new Date().toISOString()
        const inserted = op.rows.map((r) => ({
          created_at: stamp,
          updated_at: stamp,
          created_by: current?.user.id ?? null,
          deleted_at: null,
          ...r,
        }))
        tableRows.push(...inserted)
        return { data: structuredClone(inserted), error: null }
      }
      const matched = tableRows.filter((r) => filters.every((f) => f(r)))
      if (op.kind === 'update') {
        for (const r of matched) Object.assign(r, op.patch, { updated_at: new Date().toISOString() })
        return { data: structuredClone(matched), error: null }
      }
      // Des copies, comme le vrai client : l'écran ne doit jamais tenir les lignes de la base.
      let data = structuredClone(matched)
      if (sort) {
        const { column, ascending } = sort
        data.sort((a, b) => {
          const x = a[column] as number | string
          const y = b[column] as number | string
          return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1)
        })
      }
      if (max !== null) data = data.slice(0, max)
      if (one) return { data: data[0] ?? null, error: null }
      return { data, error: null }
    }

    const builder = {
      select: () => builder,
      insert: (value: Row | Row[]) => {
        op = { kind: 'insert', rows: Array.isArray(value) ? value : [value] }
        return builder
      },
      update: (patch: Row) => {
        op = { kind: 'update', patch }
        return builder
      },
      eq: (column: string, value: unknown) => {
        filters.push((r) => r[column] === value)
        return builder
      },
      is: (column: string, value: unknown) => {
        filters.push((r) => (r[column] ?? null) === value)
        return builder
      },
      in: (column: string, values: unknown[]) => {
        filters.push((r) => values.includes(r[column]))
        return builder
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        sort = { column, ascending: options?.ascending ?? true }
        return builder
      },
      limit: (n: number) => {
        max = n
        return builder
      },
      single: () => {
        one = 'single'
        return Promise.resolve(run())
      },
      maybeSingle: () => {
        one = 'maybe'
        return Promise.resolve(run())
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    }
    return builder
  })

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (failNext.delete(name)) return { data: null, error: { message: `échec simulé sur ${name}` } }
    if (name === 'clear_checked') {
      const cleared = (db.checklist_item ?? []).filter(
        (r) => r.checklist_id === args.p_checklist_id && r.checked && r.deleted_at === null,
      )
      for (const r of cleared) r.deleted_at = new Date().toISOString()
      return { data: cleared.length, error: null }
    }
    return { data: null, error: { message: `rpc inconnue : ${name}` } }
  })

  return { auth, from, rpc, rows: db, failNext } as unknown as OhoClient & {
    auth: typeof auth
    from: typeof from
    rpc: typeof rpc
    rows: Rows
    failNext: Set<string>
  }
}

const profileA = { id: 'user-a', display_name: 'Aurélien', initials: 'AL', avatar_color: null, locale: 'fr', created_at: '', updated_at: '' }
const profileB = { id: 'user-b', display_name: 'Auriane', initials: 'AN', avatar_color: null, locale: 'fr', created_at: '', updated_at: '' }

export const seedRows = {
  membership: [
    { household_id: 'hh-1', user_id: 'user-a', role: 'owner', joined_at: '2026-10-01T00:00:00Z', deleted_at: null, profile: profileA },
    { household_id: 'hh-1', user_id: 'user-b', role: 'owner', joined_at: '2026-10-02T00:00:00Z', deleted_at: null, profile: profileB },
  ],
  household: [{ id: 'hh-1', name: 'Aurélien & Auriane', timezone: 'America/Toronto' }],
  tool_activation: [
    { household_id: 'hh-1', tool_key: 'shopping', enabled: true, sort_order: 1, deleted_at: null },
    { household_id: 'hh-1', tool_key: 'trips', enabled: false, sort_order: 2, deleted_at: null },
  ],
  activity_log: [
    {
      id: 'log-1',
      household_id: 'hh-1',
      actor_id: 'user-b',
      tool_key: 'shopping',
      action: 'checked',
      entity_label: 'Lait 2 %',
      created_at: new Date().toISOString(),
    },
  ],
}

const base = { household_id: 'hh-1', deleted_at: null, archived_at: null, created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z' }
const item = (id: string, label: string, sort_order: number, patch: Row = {}) => ({
  ...base,
  id,
  checklist_id: 'list-epicerie',
  label,
  quantity: null,
  note: null,
  category_id: null,
  catalog_item_id: null,
  checked: false,
  checked_by: null,
  checked_at: null,
  sort_order,
  created_by: 'user-a',
  updated_by: null,
  ...patch,
})

/** Seed de l'espace + Courses : deux listes, trois rayons, quelques articles et le catalogue. */
export const shoppingRows = {
  ...seedRows,
  checklist: [
    { ...base, id: 'list-epicerie', kind: 'shopping', name: 'Épicerie', is_default: true, sort_order: 1, created_by: 'user-a', updated_by: null },
    { ...base, id: 'list-pharmacie', kind: 'shopping', name: 'Pharmacie', is_default: false, sort_order: 2, created_by: 'user-b', updated_by: null },
    { ...base, id: 'list-valise', kind: 'trip_prep', name: 'Valise', is_default: false, sort_order: 3, created_by: 'user-b', updated_by: null },
  ],
  shopping_category: [
    { ...base, id: 'cat-fruits', name: 'Fruits et légumes', emoji: null, sort_order: 1, created_by: 'user-a', updated_by: null },
    { ...base, id: 'cat-laitiers', name: 'Produits laitiers', emoji: null, sort_order: 2, created_by: 'user-a', updated_by: null },
    { ...base, id: 'cat-boulangerie', name: 'Boulangerie', emoji: null, sort_order: 3, created_by: 'user-a', updated_by: null },
  ],
  checklist_item: [
    item('i-avocats', 'Avocats', 1, { category_id: 'cat-fruits', quantity: '3', note: 'bien mûrs', created_by: 'user-b' }),
    item('i-lait', 'Lait', 2, { category_id: 'cat-laitiers', catalog_item_id: 'c-lait' }),
    item('i-pain', 'Pain au levain', 3, { category_id: 'cat-boulangerie' }),
    item('i-piles', 'Piles AA', 4),
    item('i-cafe', 'Café', 5, { checked: true, checked_by: 'user-b', checked_at: '2026-10-23T10:00:00Z' }),
    item('i-creme', 'Crème solaire', 1, { checklist_id: 'list-pharmacie' }),
  ],
  catalog_item: [
    { ...base, id: 'c-fraises', label: 'Fraises', label_key: 'fraises', default_category_id: 'cat-fruits', usage_count: 18, last_used_at: null, hidden_at: null, created_by: 'user-a', updated_by: null },
    { ...base, id: 'c-fromage', label: 'Fromage cheddar', label_key: 'fromage cheddar', default_category_id: 'cat-laitiers', usage_count: 11, last_used_at: null, hidden_at: null, created_by: 'user-a', updated_by: null },
    { ...base, id: 'c-lait', label: 'Lait', label_key: 'lait', default_category_id: 'cat-laitiers', usage_count: 9, last_used_at: null, hidden_at: null, created_by: 'user-a', updated_by: null },
  ],
}
