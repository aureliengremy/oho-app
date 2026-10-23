import type { OhoClient } from '@/core/client'
import type { TablesInsert, TablesUpdate } from '@/core/db/database.types'
import type { CatalogEntry, ShoppingData } from './model'

export const shoppingKey = (householdId: string) => ['shopping', householdId] as const
export const catalogKey = (householdId: string) => ['shopping', householdId, 'catalog'] as const

/** Listes de courses, leurs items vivants et les rayons de l'espace, en trois requêtes. */
export async function fetchShopping(client: OhoClient, householdId: string): Promise<ShoppingData> {
  const [lists, categories] = await Promise.all([
    client
      .from('checklist')
      .select('*')
      .eq('household_id', householdId)
      .eq('kind', 'shopping')
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    client
      .from('shopping_category')
      .select('*')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
  ])
  if (lists.error) throw lists.error
  if (categories.error) throw categories.error

  const listIds = (lists.data ?? []).map((l) => l.id)
  let items: ShoppingData['items'] = []
  if (listIds.length > 0) {
    const result = await client
      .from('checklist_item')
      .select('*')
      .eq('household_id', householdId)
      .in('checklist_id', listIds)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
    if (result.error) throw result.error
    items = result.data ?? []
  }
  return { lists: lists.data ?? [], items, categories: categories.data ?? [] }
}

/** Le catalogue appris de l'espace (auto-complétion, achats fréquents). */
export async function fetchCatalog(client: OhoClient, householdId: string): Promise<CatalogEntry[]> {
  const { data, error } = await client
    .from('catalog_item')
    .select('*')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('usage_count', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function check<T extends { error: unknown }>(request: PromiseLike<T>): Promise<T> {
  const result = await request
  if (result.error) throw result.error
  return result
}

export const writes = {
  insertItems: (client: OhoClient, rows: TablesInsert<'checklist_item'>[]) =>
    check(client.from('checklist_item').insert(rows)),
  updateItems: (client: OhoClient, ids: string[], patch: TablesUpdate<'checklist_item'>) =>
    check(client.from('checklist_item').update(patch).in('id', ids)),
  updateCatalog: (client: OhoClient, id: string, patch: TablesUpdate<'catalog_item'>) =>
    check(client.from('catalog_item').update(patch).eq('id', id)),
  clearChecked: (client: OhoClient, listId: string) => check(client.rpc('clear_checked', { p_checklist_id: listId })),
  insertList: (client: OhoClient, row: TablesInsert<'checklist'>) => check(client.from('checklist').insert(row)),
  updateList: (client: OhoClient, id: string, patch: TablesUpdate<'checklist'>) =>
    check(client.from('checklist').update(patch).eq('id', id)),
  insertCategory: (client: OhoClient, row: TablesInsert<'shopping_category'>) =>
    check(client.from('shopping_category').insert(row)),
  updateCategory: (client: OhoClient, id: string, patch: TablesUpdate<'shopping_category'>) =>
    check(client.from('shopping_category').update(patch).eq('id', id)),
}
