import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import type { TablesInsert, TablesUpdate } from '@/core/db/database.types'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { uuidv7 } from '@/core/lib/uuid'
import { isNetworkError } from '@/core/sync/network'
import { overlay, type OutboxOp } from '@/core/sync/outbox'
import { useLiveQuery, useSync } from '@/core/sync/SyncProvider'
import { nextSortOrder, movedSortOrder, type CatalogEntry, type Category, type Item, type ShoppingData, type ShoppingList } from './model'
import { labelKey, type QuickEntry } from './parse'
import { catalogKey, fetchCatalog, fetchShopping, shoppingKey, writes } from './queries'

/** Ce que l'ajout rapide a fait : ajoutés, remis hors du panier, déjà présents. */
export interface AddResult {
  added: string[]
  restored: string[]
  skipped: string[]
}

interface ShoppingValue {
  /** État du serveur, plus les écritures encore en file d'attente hors ligne. */
  data: ShoppingData | undefined
  /** Heure du dernier état reçu du serveur (ms), pour « dernier état connu ». */
  updatedAt: number
  /** Articles dont une écriture attend le réseau (« En attente »). */
  pending: ReadonlySet<string>
  catalog: CatalogEntry[]
  isPending: boolean
  isError: boolean
  refetch: () => void
  error: string | null
  dismissError: () => void
  addEntries: (listId: string, entries: QuickEntry[]) => AddResult
  toggle: (item: Item) => void
  updateItem: (item: Item, patch: Pick<TablesUpdate<'checklist_item'>, 'label' | 'quantity' | 'note' | 'category_id'>) => void
  removeItem: (item: Item) => void
  clearChecked: (listId: string) => void
  createList: (name: string) => string
  renameList: (list: ShoppingList, name: string) => void
  removeList: (list: ShoppingList) => void
  createCategory: (name: string) => void
  renameCategory: (category: Category, name: string) => void
  removeCategory: (category: Category) => void
  moveCategory: (category: Category, direction: -1 | 1) => void
}

const ShoppingContext = createContext<ShoppingValue | null>(null)

type Change = (data: ShoppingData) => ShoppingData

const now = () => new Date().toISOString()

const ITEMS = 'checklist_item'

/** Les articles vus par l'écran : ceux du serveur, avec les écritures en attente, sans les supprimés. */
function withOutbox(data: ShoppingData, outbox: readonly OutboxOp[]): ShoppingData {
  if (!outbox.some((op) => op.table === ITEMS)) return data
  return { ...data, items: overlay(data.items, outbox, ITEMS).filter((i) => !i.deleted_at) }
}

const OFFLINE = 'Hors ligne : cette action attendra le réseau. Réessaie une fois connecté.'

/**
 * Données et écritures de l'outil Courses. Chaque écriture s'applique tout de suite au cache
 * (optimiste), part vers Supabase, et le cache est rechargé quand plus rien n'est en vol.
 * En cas d'échec, l'état d'avant revient et un message s'affiche.
 */
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household, me } = useHousehold()
  const myId = me?.profile.id ?? null
  const key = shoppingKey(household.id)
  const [error, setError] = useState<string | null>(null)
  const { outbox, queue } = useSync()

  const query = useLiveQuery({
    tables: ['checklist', 'checklist_item', 'shopping_category'],
    queryKey: key,
    queryFn: () => fetchShopping(client, household.id),
  })
  const catalogQuery = useLiveQuery({
    tables: ['catalog_item'],
    queryKey: catalogKey(household.id),
    queryFn: () => fetchCatalog(client, household.id),
  })

  const mutation = useMutation({
    mutationKey: key,
    // Hors ligne, on ne met pas l'écriture en pause : elle part dans la file (outbox) ou échoue.
    networkMode: 'always',
    mutationFn: async ({ run, offline }: { run: () => Promise<unknown>; change: Change; failure: string; offline?: OutboxOp[] }) => {
      if (offline && !navigator.onLine) return offline.forEach(queue)
      if (!navigator.onLine) throw new Error('offline')
      try {
        await run()
      } catch (cause) {
        // Le réseau a lâché en route : l'écriture rejouable attend, l'état affiché ne bouge pas.
        if (offline && isNetworkError(cause)) return offline.forEach(queue)
        throw cause
      }
    },
    onMutate: async ({ change }) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient.getQueryData<ShoppingData>(key)
      if (previous) queryClient.setQueryData<ShoppingData>(key, change(previous))
      return { previous }
    },
    onError: (_error, { failure }, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      setError(navigator.onLine ? failure : OFFLINE)
    },
    onSettled: () => {
      // Recharger seulement quand la dernière écriture est revenue, sinon on écraserait
      // l'état optimiste des écritures encore en vol.
      if (queryClient.isMutating({ mutationKey: key }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: key })
        void queryClient.invalidateQueries({ queryKey: ['activity', household.id] })
      }
    },
  })
  const { mutate } = mutation

  /**
   * Une écriture : `change` pour l'écran tout de suite, `run` pour le serveur, `failure` si elle
   * échoue. Avec `offline`, elle peut attendre le réseau dans la file au lieu d'échouer.
   */
  const write = useCallback(
    (change: Change, run: () => Promise<unknown>, failure: string, offline?: OutboxOp[]) =>
      mutate({ change, run, failure, offline }),
    [mutate],
  )
  const data = useMemo(() => (query.data ? withOutbox(query.data, outbox) : undefined), [query.data, outbox])
  const pending = useMemo(
    () => new Set(outbox.filter((op) => op.table === ITEMS).map((op) => op.rowId)),
    [outbox],
  )

  const value = useMemo<ShoppingValue>(() => {
    const current = () =>
      withOutbox(queryClient.getQueryData<ShoppingData>(key) ?? { lists: [], items: [], categories: [] }, outbox)
    const op = (rowId: string, patch: Record<string, unknown>): OutboxOp => ({
      id: uuidv7(),
      kind: 'update',
      table: ITEMS,
      rowId,
      patch,
      queuedAt: now(),
    })
    const catalog = catalogQuery.data ?? []
    const mapItems = (data: ShoppingData, ids: ReadonlySet<string>, patch: Partial<Item>): ShoppingData => ({
      ...data,
      items: data.items.map((i) => (ids.has(i.id) ? { ...i, ...patch } : i)),
    })
    const checkedPatch = (checked: boolean): Partial<Item> => ({
      checked,
      checked_by: checked ? myId : null,
      checked_at: checked ? now() : null,
    })

    return {
      data,
      updatedAt: query.dataUpdatedAt,
      pending,
      catalog,
      isPending: query.isPending,
      isError: query.isError,
      refetch: () => void query.refetch(),
      error,
      dismissError: () => setError(null),

      addEntries(listId, entries) {
        const data = current()
        const inList = data.items.filter((i) => i.checklist_id === listId)
        const byKey = new Map(inList.map((i) => [labelKey(i.label), i]))
        const fromCatalog = new Map(catalog.map((c) => [c.label_key, c]))
        const result: AddResult = { added: [], restored: [], skipped: [] }
        const restore: Item[] = []
        const rows: Item[] = []
        let order = nextSortOrder(inList)
        for (const entry of entries) {
          const k = labelKey(entry.label)
          const existing = byKey.get(k)
          if (existing && !existing.checked) {
            result.skipped.push(existing.label)
          } else if (existing) {
            restore.push(existing)
            result.restored.push(existing.label)
          } else {
            const known = fromCatalog.get(k)
            const label = known?.label ?? entry.label
            const stamp = now()
            rows.push({
              id: uuidv7(),
              household_id: household.id,
              checklist_id: listId,
              label,
              quantity: entry.quantity,
              note: null,
              category_id: known?.default_category_id ?? null,
              catalog_item_id: known?.id ?? null,
              checked: false,
              checked_by: null,
              checked_at: null,
              sort_order: order++,
              created_at: stamp,
              updated_at: stamp,
              created_by: myId,
              updated_by: myId,
              deleted_at: null,
            })
            result.added.push(label)
          }
        }
        if (rows.length === 0 && restore.length === 0) return result

        const restoreIds = new Set(restore.map((i) => i.id))
        const inserts: TablesInsert<'checklist_item'>[] = rows.map((r) => ({
          id: r.id,
          household_id: r.household_id,
          checklist_id: r.checklist_id,
          label: r.label,
          quantity: r.quantity,
          category_id: r.category_id,
          sort_order: r.sort_order,
        }))
        const uncheck = { checked: false, checked_by: null, checked_at: null }
        write(
          (d) => {
            const restored = mapItems(d, restoreIds, checkedPatch(false))
            return { ...restored, items: [...restored.items, ...rows] }
          },
          async () => {
            if (rows.length > 0) {
              await writes.insertItems(client, inserts)
              void queryClient.invalidateQueries({ queryKey: catalogKey(household.id) })
            }
            if (restore.length > 0) await writes.updateItems(client, [...restoreIds], { checked: false })
          },
          rows.length + restore.length > 1 ? 'Les articles n’ont pas été ajoutés. Réessaie.' : 'L’article n’a pas été ajouté. Réessaie.',
          [
            ...inserts.map<OutboxOp>((row) => ({
              id: uuidv7(),
              kind: 'insert',
              table: ITEMS,
              rowId: row.id!,
              row: { ...row, note: null, checked: false },
              queuedAt: now(),
            })),
            ...restore.map((i) => op(i.id, uncheck)),
          ],
        )
        return result
      },

      toggle(item) {
        const checked = !item.checked
        const patch = checkedPatch(checked)
        write(
          (d) => mapItems(d, new Set([item.id]), patch),
          () => writes.updateItems(client, [item.id], { checked }),
          `« ${item.label} » n’a pas été ${checked ? 'coché' : 'décoché'}. Réessaie.`,
          // En file, on garde qui et quand pour l'affichage ; le serveur les repose de toute façon.
          [op(item.id, patch)],
        )
      },

      updateItem(item, patch) {
        write(
          (d) => mapItems(d, new Set([item.id]), patch),
          async () => {
            await writes.updateItems(client, [item.id], patch)
            // Le rayon choisi devient celui que le catalogue proposera la prochaine fois.
            if (patch.category_id !== undefined && patch.category_id !== item.category_id && item.catalog_item_id) {
              await writes.updateCatalog(client, item.catalog_item_id, { default_category_id: patch.category_id })
              void queryClient.invalidateQueries({ queryKey: catalogKey(household.id) })
            }
          },
          'La modification n’a pas été enregistrée. Réessaie.',
          [op(item.id, patch)],
        )
      },

      removeItem(item) {
        const deleted_at = now()
        write(
          (d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }),
          () => writes.updateItems(client, [item.id], { deleted_at }),
          `« ${item.label} » n’a pas été supprimé. Réessaie.`,
          [op(item.id, { deleted_at })],
        )
      },

      clearChecked(listId) {
        write(
          (d) => ({ ...d, items: d.items.filter((i) => !(i.checklist_id === listId && i.checked)) }),
          () => writes.clearChecked(client, listId),
          'Le panier n’a pas été vidé. Réessaie.',
        )
      },

      createList(name) {
        const data = current()
        const stamp = now()
        const list: ShoppingList = {
          id: uuidv7(),
          household_id: household.id,
          kind: 'shopping',
          name,
          is_default: data.lists.length === 0,
          sort_order: nextSortOrder(data.lists),
          archived_at: null,
          created_at: stamp,
          updated_at: stamp,
          created_by: myId,
          updated_by: myId,
          deleted_at: null,
        }
        write(
          (d) => ({ ...d, lists: [...d.lists, list] }),
          () =>
            writes.insertList(client, {
              id: list.id,
              household_id: list.household_id,
              kind: 'shopping',
              name: list.name,
              is_default: list.is_default,
              sort_order: list.sort_order,
            }),
          'La liste n’a pas été créée. Réessaie.',
        )
        return list.id
      },

      renameList(list, name) {
        write(
          (d) => ({ ...d, lists: d.lists.map((l) => (l.id === list.id ? { ...l, name } : l)) }),
          () => writes.updateList(client, list.id, { name }),
          'La liste n’a pas été renommée. Réessaie.',
        )
      },

      removeList(list) {
        write(
          (d) => ({ ...d, lists: d.lists.filter((l) => l.id !== list.id), items: d.items.filter((i) => i.checklist_id !== list.id) }),
          () => writes.updateList(client, list.id, { deleted_at: now() }),
          'La liste n’a pas été supprimée. Réessaie.',
        )
      },

      createCategory(name) {
        const data = current()
        const stamp = now()
        const category: Category = {
          id: uuidv7(),
          household_id: household.id,
          name,
          emoji: null,
          sort_order: nextSortOrder(data.categories),
          archived_at: null,
          created_at: stamp,
          updated_at: stamp,
          created_by: myId,
          updated_by: myId,
          deleted_at: null,
        }
        write(
          (d) => ({ ...d, categories: [...d.categories, category] }),
          () =>
            writes.insertCategory(client, {
              id: category.id,
              household_id: category.household_id,
              name,
              sort_order: category.sort_order,
            }),
          'Le rayon n’a pas été créé. Ce nom existe peut-être déjà.',
        )
      },

      renameCategory(category, name) {
        write(
          (d) => ({ ...d, categories: d.categories.map((c) => (c.id === category.id ? { ...c, name } : c)) }),
          () => writes.updateCategory(client, category.id, { name }),
          'Le rayon n’a pas été renommé. Ce nom existe peut-être déjà.',
        )
      },

      removeCategory(category) {
        write(
          (d) => ({ ...d, categories: d.categories.filter((c) => c.id !== category.id) }),
          () => writes.updateCategory(client, category.id, { deleted_at: now() }),
          'Le rayon n’a pas été supprimé. Réessaie.',
        )
      },

      moveCategory(category, direction) {
        const sorted = [...current().categories].sort((a, b) => a.sort_order - b.sort_order)
        const sort_order = movedSortOrder(sorted, sorted.findIndex((c) => c.id === category.id), direction)
        if (sort_order === null) return
        write(
          (d) => ({ ...d, categories: d.categories.map((c) => (c.id === category.id ? { ...c, sort_order } : c)) }),
          () => writes.updateCategory(client, category.id, { sort_order }),
          'L’ordre des rayons n’a pas été enregistré. Réessaie.',
        )
      },
    }
    // key est dérivée de household.id ; query et catalogQuery changent quand leurs données changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queryClient, household.id, myId, data, pending, outbox, query.dataUpdatedAt, query.isPending, query.isError, catalogQuery.data, error, write])

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>
}

export function useShopping(): ShoppingValue {
  const value = useContext(ShoppingContext)
  if (!value) throw new Error('useShopping doit être appelé sous <ShoppingProvider>')
  return value
}
