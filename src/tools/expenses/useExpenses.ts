import { createContext, useContext } from 'react'
import type { Book, ComputedShare, Expense, ExpensesData, Settlement } from './model'

export interface BookFields {
  name: string
  currency: string
  trip_id: string | null
}

/** Ce que le formulaire envoie : la dépense (sans les colonnes calculées) et ses parts en devise du carnet. */
export type ExpenseFields = Pick<
  Expense,
  'book_id' | 'label' | 'paid_by' | 'amount_cents' | 'currency' | 'fx_rate' | 'spent_on' | 'category' | 'split_mode' | 'note' | 'booking_id'
>

export interface ExpensesValue {
  data: ExpensesData | undefined
  updatedAt: number
  isPending: boolean
  /** Les données ont été relues depuis l'ouverture (et pas seulement restaurées du cache de l'appareil). */
  settled: boolean
  isError: boolean
  refetch: () => void
  error: string | null
  dismissError: () => void
  addBook: (fields: BookFields) => string
  updateBook: (book: Book, patch: Partial<BookFields>) => void
  removeBook: (book: Book) => void
  /** Crée ou remplace une dépense et ses parts, d'un bloc (M19). Rend son identifiant. */
  saveExpense: (fields: ExpenseFields, shares: ComputedShare[], existing?: Expense) => string
  removeExpense: (expense: Expense) => void
  settle: (bookId: string, from: string, to: string, cents: number) => void
  removeSettlement: (settlement: Settlement) => void
  rate: (from: string, to: string) => Promise<{ rate: number; date: string } | null>
}

export const ExpensesContext = createContext<ExpensesValue | null>(null)

export function useExpenses(): ExpensesValue {
  const value = useContext(ExpensesContext)
  if (!value) throw new Error('useExpenses doit être appelé sous <ExpensesProvider>')
  return value
}
