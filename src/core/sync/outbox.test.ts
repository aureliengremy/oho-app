import { describe, expect, it, vi } from 'vitest'
import type { OhoClient } from '../client'
import { enqueue, flush, overlay, type OutboxOp } from './outbox'
import { pollInterval, POLL_INTERVAL } from './useSync'

const update = (id: string, rowId: string, patch: Record<string, unknown>): OutboxOp => ({
  id, kind: 'update', table: 'checklist_item', rowId, patch, queuedAt: '2026-10-23T10:00:00Z',
})
const insert = (id: string, rowId: string, row: Record<string, unknown>): OutboxOp => ({
  id, kind: 'insert', table: 'checklist_item', rowId, row: { id: rowId, ...row }, queuedAt: '2026-10-23T10:00:00Z',
})

describe('enqueue', () => {
  it('fusionne deux écritures sur la même ligne, la dernière gagne', () => {
    const q = enqueue(enqueue([], update('1', 'a', { checked: true })), update('2', 'a', { checked: false, note: 'x' }))
    expect(q).toHaveLength(1)
    expect(q[0]).toMatchObject({ id: '2', kind: 'update', patch: { checked: false, note: 'x' } })
  })

  it('modifie une insertion encore en attente au lieu d’ajouter une mise à jour', () => {
    const q = enqueue(enqueue([], insert('1', 'a', { label: 'Lait', checked: false })), update('2', 'a', { checked: true }))
    expect(q).toEqual([expect.objectContaining({ id: '2', kind: 'insert', row: { id: 'a', label: 'Lait', checked: true } })])
  })

  it('garde l’ordre entre lignes différentes', () => {
    const q = enqueue(enqueue([], update('1', 'a', {})), update('2', 'b', {}))
    expect(q.map((op) => op.rowId)).toEqual(['a', 'b'])
  })
})

describe('overlay', () => {
  it('applique les mises à jour et ajoute les insertions inconnues du serveur', () => {
    const rows = [{ id: 'a', checked: false }, { id: 'b', checked: false }]
    const q = [update('1', 'a', { checked: true }), insert('2', 'c', { checked: false }), update('3', 'x', { checked: true })]
    expect(overlay(rows, q, 'checklist_item')).toEqual([{ id: 'a', checked: true }, { id: 'b', checked: false }, { id: 'c', checked: false }])
    expect(overlay(rows, q, 'autre_table')).toBe(rows)
  })
})

/** Un client minimal dont chaque écriture renvoie la réponse suivante de la liste. */
function scriptedClient(responses: Array<{ error: unknown }>) {
  const calls: string[] = []
  const answer = () => Promise.resolve(responses.shift() ?? { error: null })
  const from = vi.fn((table: string) => ({
    insert: (row: unknown) => {
      calls.push(`insert ${table} ${JSON.stringify(row)}`)
      return answer()
    },
    update: (patch: unknown) => ({
      eq: (_c: string, id: string) => {
        calls.push(`update ${table} ${id} ${JSON.stringify(patch)}`)
        return answer()
      },
    }),
  }))
  return { client: { from } as unknown as OhoClient, calls }
}

describe('flush', () => {
  it('rejoue dans l’ordre et s’arrête à la première coupure réseau', async () => {
    const { client, calls } = scriptedClient([{ error: null }, { error: { message: 'TypeError: Failed to fetch', code: '' } }])
    const q = [update('1', 'a', { checked: true }), update('2', 'b', { checked: true }), update('3', 'c', { checked: true })]
    const result = await flush(client, q)
    expect(result).toEqual({ sent: ['1'], rejected: [], interrupted: true })
    expect(calls).toHaveLength(2)
  })

  it('retire une écriture refusée par le serveur et continue', async () => {
    const { client } = scriptedClient([{ error: { message: 'new row violates row-level security policy', code: '42501' } }])
    const q = [update('1', 'a', { checked: true }), update('2', 'b', { checked: true })]
    const result = await flush(client, q)
    expect(result.rejected.map((op) => op.id)).toEqual(['1'])
    expect(result.sent).toEqual(['2'])
  })

  it('compte une insertion déjà faite comme envoyée, en reposant ses colonnes', async () => {
    const { client, calls } = scriptedClient([{ error: { message: 'duplicate key', code: '23505' } }, { error: null }])
    const result = await flush(client, [insert('1', 'a', { household_id: 'hh', label: 'Lait', checked: true })])
    expect(result.sent).toEqual(['1'])
    expect(calls[1]).toBe('update checklist_item a {"label":"Lait","checked":true}')
  })
})

describe('pollInterval', () => {
  it('ne sonde que si le temps réel est tombé et que le réseau est là', () => {
    expect(pollInterval('live', true)).toBe(false)
    expect(pollInterval('down', true)).toBe(POLL_INTERVAL)
    expect(pollInterval('connecting', true)).toBe(POLL_INTERVAL)
    expect(pollInterval('down', false)).toBe(false)
  })
})
