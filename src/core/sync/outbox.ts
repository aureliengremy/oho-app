import type { OhoClient } from '../client'
import { isNetworkError } from './network'

type Row = Record<string, unknown>

/**
 * Une écriture en attente de réseau (décision T10). Seules des écritures rejouables sans risque y
 * entrent : une insertion à identifiant client (rejouée, elle bute sur la clé et compte comme faite)
 * et une mise à jour de colonnes sur une ligne connue (rejouée, elle donne le même état).
 */
export type OutboxOp =
  | { id: string; kind: 'insert'; table: string; rowId: string; row: Row; queuedAt: string }
  | { id: string; kind: 'update'; table: string; rowId: string; patch: Row; queuedAt: string }

/**
 * Ajoute une écriture en fusionnant avec ce qui attend déjà pour la même ligne : cocher puis
 * décocher hors ligne ne laisse qu'une mise à jour, et modifier un article ajouté hors ligne
 * modifie directement son insertion.
 */
export function enqueue(queue: readonly OutboxOp[], op: OutboxOp): OutboxOp[] {
  const index = queue.findIndex((q) => q.table === op.table && q.rowId === op.rowId)
  if (index === -1) return [...queue, op]
  const existing = queue[index]
  // L'écriture fusionnée prend l'identifiant de la nouvelle : si l'ancienne est en cours d'envoi,
  // la retirer après coup ne retire pas la fusion, qui repartira au prochain envoi.
  const merged: OutboxOp =
    existing.kind === 'insert'
      ? { ...existing, id: op.id, row: { ...existing.row, ...(op.kind === 'insert' ? op.row : op.patch) } }
      : op.kind === 'insert'
        ? op
        : { ...existing, id: op.id, patch: { ...existing.patch, ...op.patch }, queuedAt: op.queuedAt }
  return queue.map((q, i) => (i === index ? merged : q))
}

/** Applique les écritures en attente d'une table à des lignes du serveur (état affiché hors ligne). */
export function overlay<T extends { id: string }>(rows: readonly T[], queue: readonly OutboxOp[], table: string): T[] {
  const ops = queue.filter((q) => q.table === table)
  if (ops.length === 0) return rows as T[]
  const byId = new Map(ops.map((q) => [q.rowId, q]))
  const result = rows.map((r) => {
    const op = byId.get(r.id)
    return op ? ({ ...r, ...(op.kind === 'insert' ? op.row : op.patch) } as T) : r
  })
  const known = new Set(rows.map((r) => r.id))
  for (const op of ops) if (op.kind === 'insert' && !known.has(op.rowId)) result.push(op.row as unknown as T)
  return result
}

export interface FlushResult {
  /** Écritures arrivées au serveur. */
  sent: string[]
  /** Écritures refusées par le serveur (droits, contrainte) : retirées, l'utilisateur est prévenu. */
  rejected: OutboxOp[]
  /** Vrai si le réseau a lâché en route : le reste attend le prochain essai. */
  interrupted: boolean
}

/** Rejoue la file dans l'ordre. S'arrête au premier échec réseau pour garder l'ordre des écritures. */
export async function flush(client: OhoClient, queue: readonly OutboxOp[]): Promise<FlushResult> {
  const result: FlushResult = { sent: [], rejected: [], interrupted: false }
  for (const op of queue) {
    // Le nom de table vient du code (jamais de l'utilisateur) ; le client typé ne le connaît pas.
    const table = client.from(op.table as 'checklist_item')
    let { error } =
      op.kind === 'insert' ? await table.insert(op.row as never) : await table.update(op.patch as never).eq('id', op.rowId)
    if (error && op.kind === 'insert' && error.code === '23505') {
      // Déjà insérée (envoi précédent coupé avant la réponse) : on pose les colonnes modifiables.
      const { id: _id, household_id: _household, created_at: _at, created_by: _by, ...columns } = op.row
      ;({ error } = await client.from(op.table as 'checklist_item').update(columns as never).eq('id', op.rowId))
    }
    if (!error) {
      result.sent.push(op.id)
    } else if (isNetworkError(error)) {
      result.interrupted = true
      break
    } else {
      result.rejected.push(op)
    }
  }
  return result
}

/** File persistée par espace dans localStorage, avec abonnement pour useSyncExternalStore. */
export function createOutboxStore(storageKey: string) {
  const listeners = new Set<() => void>()
  let queue: OutboxOp[] = read()

  function read(): OutboxOp[] {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as OutboxOp[]) : []
    } catch {
      return []
    }
  }

  function set(next: OutboxOp[]) {
    queue = next
    try {
      if (next.length === 0) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la file vit au moins en mémoire jusqu'à la fermeture.
    }
    for (const listener of listeners) listener()
  }

  return {
    get: () => queue,
    add: (op: OutboxOp) => set(enqueue(queue, op)),
    remove: (ids: ReadonlySet<string>) => set(queue.filter((q) => !ids.has(q.id))),
    clear: () => set([]),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type OutboxStore = ReturnType<typeof createOutboxStore>
