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
  /** Coupe le réseau pendant la prochaine écriture sur cette table (la requête n'arrive jamais). */
  const dropNext = new Set<string>()

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
    let op: { kind: 'select' } | { kind: 'insert'; rows: Row[] } | { kind: 'update'; patch: Row } | { kind: 'delete' } = { kind: 'select' }
    let sort: { column: string; ascending: boolean } | null = null
    let max: number | null = null
    let one: 'single' | 'maybe' | null = null

    const run = () => {
      const tableRows = (db[table] ??= [])
      if (op.kind !== 'select' && dropNext.delete(table)) {
        return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } }
      }
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
      if (op.kind === 'delete') {
        db[table] = tableRows.filter((r) => !matched.includes(r))
        return { data: structuredClone(matched), error: null }
      }
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
      delete: () => {
        op = { kind: 'delete' }
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

  // Realtime : les écrans s'abonnent, le test émet un changement sur une table avec `emit`.
  type Handler = { table: string; callback: (payload: unknown) => void }
  const channels = new Set<{ handlers: Handler[]; status?: (s: string) => void }>()
  const channel = vi.fn(() => {
    const state: { handlers: Handler[]; status?: (s: string) => void } = { handlers: [] }
    channels.add(state)
    const ch = {
      on: (_type: string, filter: { table: string }, callback: (payload: unknown) => void) => {
        state.handlers.push({ table: filter.table, callback })
        return ch
      },
      subscribe: (status?: (s: string) => void) => {
        state.status = status
        queueMicrotask(() => status?.(realtime.status))
        return ch
      },
      state,
    }
    return ch
  })
  const removeChannel = vi.fn(async (ch: { state: typeof channels extends Set<infer S> ? S : never }) => {
    channels.delete(ch.state)
    return 'ok'
  })
  const realtime = {
    status: 'SUBSCRIBED',
    /** Simule un changement venu de l'autre téléphone sur une table. */
    emit(table: string) {
      for (const c of channels) for (const h of c.handlers) if (h.table === table) h.callback({ table })
    },
    /** Change l'état des canaux ouverts (et des prochains). */
    setStatus(status: string) {
      realtime.status = status
      for (const c of channels) c.status?.(status)
    },
    get open() {
      return channels.size
    },
  }

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (failNext.delete(name)) return { data: null, error: { message: `échec simulé sur ${name}` } }
    if (name === 'clear_checked') {
      const cleared = (db.checklist_item ?? []).filter(
        (r) => r.checklist_id === args.p_checklist_id && r.checked && r.deleted_at === null,
      )
      for (const r of cleared) r.deleted_at = new Date().toISOString()
      return { data: cleared.length, error: null }
    }
    if (name === 'register_push') {
      const list = (db.push_subscription ??= [])
      const existing = list.find((r) => r.endpoint === args.p_endpoint)
      const row = { user_id: current?.user.id, endpoint: args.p_endpoint, p256dh: args.p_p256dh, auth: args.p_auth, user_agent: args.p_user_agent ?? null }
      if (existing) Object.assign(existing, row)
      else list.push({ id: `push-${list.length + 1}`, last_seen_at: null, failure_count: 0, created_at: new Date().toISOString(), ...row })
      return { data: existing?.id ?? list[list.length - 1].id, error: null }
    }
    if (name === 'save_expense') {
      // Comme la RPC : taux forcé à 1 en devise du carnet, montant converti, parts remplacées d'un bloc.
      const e = args.p_expense as Row
      const shares = args.p_shares as Row[]
      const book = (db.expense_book ?? []).find((b) => b.id === e.book_id)
      const fx = book?.currency === e.currency ? 1 : Number(e.fx_rate ?? 1)
      const row = { ...e, fx_rate: fx, book_amount_cents: Math.round(Number(e.amount_cents) * fx) }
      const sum = shares.reduce((t, x) => t + Number(x.share_cents), 0)
      if (sum !== row.book_amount_cents) return { data: null, error: { message: 'les parts ne totalisent pas la dépense', code: '23514' } }
      const stamp = new Date().toISOString()
      const expenses = (db.expense ??= [])
      const existing = expenses.find((r) => r.id === e.id)
      if (existing) Object.assign(existing, row, { updated_at: stamp })
      else expenses.push({ created_at: stamp, updated_at: stamp, created_by: current?.user.id ?? null, deleted_at: null, ...row })
      const list = (db.expense_share ??= [])
      for (const old of list) if (old.expense_id === e.id && old.deleted_at === null) old.deleted_at = stamp
      shares.forEach((x, i) =>
        list.push({ id: `${String(e.id)}-part-${list.length + i}`, household_id: e.household_id, expense_id: e.id, created_at: stamp, updated_at: stamp, deleted_at: null, ...x }),
      )
      return { data: e.id, error: null }
    }
    return { data: null, error: { message: `rpc inconnue : ${name}` } }
  })

  // Storage : les fichiers envoyés sont gardés par chemin ; `failNext.add('storage')` fait échouer l'envoi.
  const files = new Map<string, { bucket: string; size: number; type: string }>()
  const storage = {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn(async (path: string, file: File, options?: { contentType?: string }) => {
        if (failNext.delete('storage')) return { data: null, error: { message: 'échec simulé du storage' } }
        files.set(path, { bucket, size: file.size, type: options?.contentType ?? file.type })
        return { data: { path }, error: null }
      }),
      remove: vi.fn(async (paths: string[]) => {
        for (const p of paths) files.delete(p)
        return { data: [], error: null }
      }),
      createSignedUrl: vi.fn(async (path: string, expiresIn: number) => ({
        data: { signedUrl: `https://storage.test/${bucket}/${path}?expires=${expiresIn}` },
        error: null,
      })),
    })),
    files,
  }

  // Edge Functions : `functions.handlers.tmdb = async (body) => ...` simule la fonction serveur ;
  // sans gestionnaire, l'appel répond 503 (fonction non configurée).
  const functions = {
    handlers: {} as Record<string, (body: Record<string, unknown>) => Promise<unknown>>,
    invoke: vi.fn(async (name: string, options: { body: Record<string, unknown> }) => {
      const handler = functions.handlers[name]
      if (!handler) return { data: null, error: { message: 'non configurée', context: { status: 503 } } }
      try {
        return { data: await handler(options.body), error: null }
      } catch {
        return { data: null, error: { message: 'échec', context: { status: 502 } } }
      }
    }),
  }

  return { auth, from, rpc, channel, removeChannel, realtime, storage, functions, rows: db, failNext, dropNext } as unknown as OhoClient & {
    auth: typeof auth
    from: typeof from
    rpc: typeof rpc
    channel: typeof channel
    realtime: typeof realtime
    storage: typeof storage
    functions: typeof functions
    rows: Rows
    failNext: Set<string>
    dropNext: Set<string>
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

const stamped = (row: Row): Row => ({ ...base, created_by: 'user-a', updated_by: null, ...row })

/** Seed de l'espace + Voyages : un voyage en cours, Lisbonne à venir, une idée sans dates, un souvenir. */
export const tripRows = {
  ...seedRows,
  tool_activation: seedRows.tool_activation.map((a) => ({ ...a, enabled: true })),
  trip: [
    stamped({ id: 'trip-sutton', title: 'Chalet à Sutton', destination: 'Cantons-de-l’Est', start_date: '2026-10-20', end_date: '2026-10-24', status: 'ongoing', cover_emoji: '🌲', notes: null }),
    stamped({ id: 'trip-lisbonne', title: 'Lisbonne & Porto', destination: 'Portugal', start_date: '2026-11-06', end_date: '2026-11-16', status: 'planned', cover_emoji: '🇵🇹', notes: null }),
    stamped({ id: 'trip-japon', title: 'Japon au printemps', destination: null, start_date: null, end_date: null, status: 'idea', cover_emoji: '🗾', notes: null }),
    stamped({ id: 'trip-kamouraska', title: 'Kamouraska', destination: null, start_date: '2026-09-12', end_date: '2026-09-14', status: 'done', cover_emoji: '🍂', notes: null }),
  ],
  trip_activity: [
    stamped({ id: 'idea-belem', trip_id: 'trip-lisbonne', title: 'Pastéis de Belém', url: null, note: 'aller tôt', done: false, planned_date: null, sort_order: 1, created_by: 'user-b' }),
    stamped({ id: 'idea-sintra', trip_id: 'trip-lisbonne', title: 'Journée à Sintra', url: 'https://www.parquesdesintra.pt', note: null, done: false, planned_date: null, sort_order: 2 }),
  ],
  booking: [
    stamped({
      id: 'booking-vol',
      trip_id: 'trip-lisbonne',
      kind: 'flight',
      title: 'Vol YUL → LIS',
      starts_at: '2026-11-07T02:35:00Z',
      ends_at: null,
      tz: 'America/Toronto',
      reference: 'QX7P2M',
      url: null,
      note: null,
      amount: 1486,
      currency: 'CAD',
    }),
  ],
  trip_budget_line: [],
  attachment: [
    stamped({
      id: 'att-1',
      entity_type: 'booking',
      entity_id: 'booking-vol',
      storage_path: 'hh-1/booking/booking-vol/att-1',
      file_name: 'cartes-embarquement.pdf',
      mime_type: 'application/pdf',
      size_bytes: 217_000,
    }),
  ],
  checklist: [stamped({ id: 'prep-lisbonne', kind: 'trip_prep', name: 'Préparation', is_default: false, sort_order: 1, trip_id: 'trip-lisbonne' })],
  checklist_item: [
    item('p-passeports', 'Passeports valides', 1, { checklist_id: 'prep-lisbonne', checked: true, checked_by: 'user-a' }),
    item('p-adaptateur', 'Adaptateur prise européenne', 2, { checklist_id: 'prep-lisbonne', quantity: '2' }),
  ],
}

/** Seed de l'espace + À regarder : quatre plateformes, deux fiches TMDB en cache, quatre titres et deux notes. */
export const watchRows = {
  ...seedRows,
  tool_activation: [
    ...seedRows.tool_activation,
    { household_id: 'hh-1', tool_key: 'watchlist', enabled: true, sort_order: 3, settings: {}, deleted_at: null },
  ],
  watch_platform: [
    stamped({ id: 'pf-netflix', name: 'Netflix', is_subscribed: true, tmdb_provider_id: 8, sort_order: 1 }),
    stamped({ id: 'pf-crave', name: 'Crave', is_subscribed: true, tmdb_provider_id: 230, sort_order: 2 }),
    stamped({ id: 'pf-prime', name: 'Prime Video', is_subscribed: true, tmdb_provider_id: 119, sort_order: 3 }),
    stamped({ id: 'pf-apple', name: 'Apple TV+', is_subscribed: false, tmdb_provider_id: 350, sort_order: 4 }),
  ],
  external_media: [
    { id: 'm-past', source: 'tmdb', media_type: 'movie', external_id: '666277', title: 'Past Lives', original_title: 'Past Lives', year: 2023, overview: 'Nora et Hae Sung se retrouvent.', poster_path: '/past.jpg', runtime_min: 106, number_of_seasons: null, genres: ['Drame'], providers: null, fetched_at: '2026-10-20T00:00:00Z', created_at: '', updated_at: '' },
    { id: 'm-sev', source: 'tmdb', media_type: 'tv', external_id: '95396', title: 'Severance', original_title: 'Severance', year: 2022, overview: 'Mark dirige une équipe de bureau.', poster_path: null, runtime_min: 50, number_of_seasons: 2, genres: ['Drame'], providers: null, fetched_at: '2026-10-20T00:00:00Z', created_at: '', updated_at: '' },
  ],
  watch_item: [
    stamped({ id: 'w-past', title: 'Past Lives', kind: 'movie', status: 'to_watch', platform_id: 'pf-prime', media_id: 'm-past', season_current: null, episode_current: null, runtime_min: null, suggested_by: 'user-b', comment: null, watched_at: null, created_at: '2026-10-01T00:00:00Z', created_by: 'user-b' }),
    stamped({ id: 'w-sev', title: 'Severance', kind: 'series', status: 'watching', platform_id: 'pf-apple', media_id: 'm-sev', season_current: 2, episode_current: 6, runtime_min: null, suggested_by: 'user-a', comment: null, watched_at: null, created_at: '2026-10-02T00:00:00Z' }),
    stamped({ id: 'w-regne', title: 'Le règne animal', kind: 'movie', status: 'to_watch', platform_id: 'pf-crave', media_id: null, season_current: null, episode_current: null, runtime_min: 128, suggested_by: 'user-a', comment: null, watched_at: null, created_at: '2026-10-03T00:00:00Z' }),
    stamped({ id: 'w-bear', title: 'The Bear', kind: 'series', status: 'to_watch', platform_id: null, media_id: null, season_current: null, episode_current: null, runtime_min: 30, suggested_by: 'user-a', comment: null, watched_at: null, created_at: '2026-10-04T00:00:00Z' }),
  ],
  watch_rating: [
    stamped({ id: 'r-a', watch_item_id: 'w-sev', user_id: 'user-a', rating: 5, comment: null }),
    stamped({ id: 'r-b', watch_item_id: 'w-sev', user_id: 'user-b', rating: 4, comment: 'Lent au début, puis impossible d’arrêter.', created_by: 'user-b' }),
  ],
}

const share = (id: string, expense_id: string, user_id: string, share_cents: number) => stamped({ id, expense_id, user_id, share_cents, weight: null })
const expense = (row: Row): Row => stamped({ fx_rate: 1, split_mode: 'equal', note: null, booking_id: null, ...row })

/** Seed de l'espace + Voyages + Dépenses : le carnet de Lisbonne (deux devises) et le carnet Quotidien. */
export const expenseRows = {
  ...tripRows,
  tool_activation: [
    ...tripRows.tool_activation,
    { household_id: 'hh-1', tool_key: 'expenses', enabled: true, sort_order: 4, settings: {}, deleted_at: null },
  ],
  expense_book: [
    stamped({ id: 'book-lisbonne', name: 'Lisbonne & Porto', currency: 'CAD', trip_id: 'trip-lisbonne', sort_order: 1, archived_at: null }),
    stamped({ id: 'book-quotidien', name: 'Quotidien', currency: 'CAD', trip_id: null, sort_order: 2, archived_at: null }),
  ],
  expense: [
    expense({ id: 'exp-appart', book_id: 'book-lisbonne', label: 'Appartement Alfama', paid_by: 'user-b', amount_cents: 112000, currency: 'EUR', fx_rate: 1.52, book_amount_cents: 170240, spent_on: '2026-10-15', category: 'lodging', created_by: 'user-b' }),
    expense({ id: 'exp-vols', book_id: 'book-lisbonne', label: 'Vols YUL ⇄ LIS', paid_by: 'user-a', amount_cents: 148600, currency: 'CAD', book_amount_cents: 148600, spent_on: '2026-10-12', category: 'transport' }),
    expense({ id: 'exp-pasteis', book_id: 'book-lisbonne', label: 'Pastéis de Belém', paid_by: 'user-b', amount_cents: 960, currency: 'EUR', fx_rate: 1.52, book_amount_cents: 1459, spent_on: '2026-11-09', category: 'food', created_by: 'user-b' }),
    expense({ id: 'exp-iga', book_id: 'book-quotidien', label: 'Épicerie IGA', paid_by: 'user-b', amount_cents: 8740, currency: 'CAD', book_amount_cents: 8740, spent_on: '2026-10-20', category: 'shopping', created_by: 'user-b' }),
  ],
  expense_share: [
    share('s-1', 'exp-appart', 'user-a', 85120),
    share('s-2', 'exp-appart', 'user-b', 85120),
    share('s-3', 'exp-vols', 'user-a', 74300),
    share('s-4', 'exp-vols', 'user-b', 74300),
    share('s-5', 'exp-pasteis', 'user-a', 730),
    share('s-6', 'exp-pasteis', 'user-b', 729),
    share('s-7', 'exp-iga', 'user-a', 4370),
    share('s-8', 'exp-iga', 'user-b', 4370),
  ],
  settlement: [stamped({ id: 'set-1', book_id: 'book-quotidien', from_user: 'user-a', to_user: 'user-b', amount_cents: 6475, settled_on: '2026-10-01', note: null })],
  // La vue n'existe pas dans le faux client : ses lignes sont posées telles que la base les rendrait.
  trip_budget_view: [
    { household_id: 'hh-1', trip_id: 'trip-lisbonne', book_id: 'book-lisbonne', currency: 'CAD', category: 'lodging', spent_cents: 170240 },
    { household_id: 'hh-1', trip_id: 'trip-lisbonne', book_id: 'book-lisbonne', currency: 'CAD', category: 'transport', spent_cents: 148600 },
    { household_id: 'hh-1', trip_id: 'trip-lisbonne', book_id: 'book-lisbonne', currency: 'CAD', category: 'food', spent_cents: 1459 },
  ],
}
