import { createContext, useContext } from 'react'
import type { TablesUpdate } from '@/core/db/database.types'
import type { QuickEntry } from '@/core/checklist/parse'
import type { CatalogEntry, Category, Item, ShoppingData, ShoppingList } from './model'

/** Ce que l'ajout rapide a fait : ajoutés, remis hors du panier, déjà présents. */
export interface AddResult {
  added: string[]
  restored: string[]
  skipped: string[]
}

export interface ShoppingValue {
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

export const ShoppingContext = createContext<ShoppingValue | null>(null)

export function useShopping(): ShoppingValue {
  const value = useContext(ShoppingContext)
  if (!value) throw new Error('useShopping doit être appelé sous <ShoppingProvider>')
  return value
}
