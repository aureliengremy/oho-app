import { vi } from 'vitest'
import type { OhoClient } from '@/core/client'

type Rows = Record<string, unknown[]>

/**
 * Faux client Supabase pour les tests d'écran : une session (ou aucune) et des lignes par table.
 * Le constructeur de requêtes accepte les chaînages usuels et renvoie les lignes de la table.
 */
export function fakeClient({ userId = null as string | null, rows = {} as Rows } = {}) {
  let listener: ((event: string, session: unknown) => void) | null = null
  const session = (id: string | null) => (id ? { user: { id }, access_token: 't' } : null)
  let current = session(userId)

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
    const data = rows[table] ?? []
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'is', 'order', 'limit']) builder[method] = () => builder
    builder.maybeSingle = async () => ({ data: data[0] ?? null, error: null })
    builder.single = async () => ({ data: data[0] ?? null, error: null })
    builder.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null })
    return builder
  })

  return { auth, from } as unknown as OhoClient & { auth: typeof auth; from: typeof from }
}

export const seedRows = {
  membership: [
    {
      household_id: 'hh-1',
      role: 'owner',
      joined_at: '2026-10-01T00:00:00Z',
      profile: { id: 'user-a', display_name: 'Aurélien', initials: 'AL', avatar_color: null, locale: 'fr', created_at: '', updated_at: '' },
    },
    {
      household_id: 'hh-1',
      role: 'owner',
      joined_at: '2026-10-02T00:00:00Z',
      profile: { id: 'user-b', display_name: 'Auriane', initials: 'AN', avatar_color: null, locale: 'fr', created_at: '', updated_at: '' },
    },
  ],
  household: [{ id: 'hh-1', name: 'Aurélien & Auriane', timezone: 'America/Toronto' }],
  tool_activation: [
    { tool_key: 'shopping', enabled: true, sort_order: 1 },
    { tool_key: 'trips', enabled: false, sort_order: 2 },
  ],
  activity_log: [
    {
      id: 'log-1',
      household_id: 'hh-1',
      actor_id: 'user-b',
      action: 'checked',
      entity_label: 'Lait 2 %',
      created_at: new Date().toISOString(),
    },
  ],
}
