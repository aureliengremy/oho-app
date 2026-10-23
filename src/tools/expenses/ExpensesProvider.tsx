import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { isoDay } from '@/core/lib/day'
import { convertCents } from '@/core/lib/money'
import { uuidv7 } from '@/core/lib/uuid'
import { useLiveQuery } from '@/core/sync/SyncProvider'
import { useOptimisticWrites } from '@/core/sync/useOptimisticWrites'
import { nextSortOrder, type Book, type ComputedShare, type Expense, type ExpensesData, type Settlement, type Share } from './model'
import { EXPENSE_TABLES, expensesKey, fetchExpenses, fetchRate, writes } from './queries'

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

interface ExpensesValue {
  data: ExpensesData | undefined
  updatedAt: number
  isPending: boolean
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

const ExpensesContext = createContext<ExpensesValue | null>(null)

const now = () => new Date().toISOString()

const stamps = (myId: string | null) => {
  const stamp = now()
  return { created_at: stamp, updated_at: stamp, created_by: myId, updated_by: myId, deleted_at: null }
}

/** Données et écritures de l'outil Dépenses, optimistes comme les autres outils. */
export function ExpensesProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household, me } = useHousehold()
  const myId = me?.profile.id ?? null
  const key = expensesKey(household.id)
  const query = useLiveQuery({ tables: EXPENSE_TABLES, queryKey: key, queryFn: () => fetchExpenses(client, household.id) })
  const { write, error, dismissError } = useOptimisticWrites<ExpensesData>(key)

  const value = useMemo<ExpensesValue>(() => {
    const current = () => queryClient.getQueryData<ExpensesData>(key)
    const replace = <R extends { id: string }>(list: R[], id: string, patch: Partial<R>) =>
      list.map((r) => (r.id === id ? { ...r, ...patch } : r))
    const without = <R extends { id: string }>(list: R[], id: string) => list.filter((r) => r.id !== id)

    return {
      data: query.data,
      updatedAt: query.dataUpdatedAt,
      isPending: query.isPending,
      isError: query.isError,
      refetch: () => void query.refetch(),
      error,
      dismissError,

      addBook(fields) {
        const book: Book = {
          id: uuidv7(),
          household_id: household.id,
          name: fields.name.trim(),
          currency: fields.currency,
          trip_id: fields.trip_id,
          sort_order: nextSortOrder(current()?.books ?? []),
          archived_at: null,
          ...stamps(myId),
        }
        const add = (d: ExpensesData) => (d.books.some((b) => b.id === book.id) ? d : { ...d, books: [...d.books, book] })
        // Tout de suite dans le cache : l'écran du carnet s'ouvre dans la foulée, avant que l'écriture ne démarre.
        queryClient.setQueryData<ExpensesData>(key, (d) => (d ? add(d) : d))
        write(
          add,
          () =>
            writes.insert(client, 'expense_book', {
              id: book.id,
              household_id: household.id,
              name: book.name,
              currency: book.currency,
              trip_id: book.trip_id,
              sort_order: book.sort_order,
            }),
          `Le carnet « ${book.name} » n’a pas été créé. Réessaie.`,
        )
        return book.id
      },

      updateBook(book, patch) {
        write(
          (d) => ({ ...d, books: replace(d.books, book.id, patch as Partial<Book>) }),
          () => writes.update(client, 'expense_book', book.id, patch),
          `Le carnet « ${book.name} » n’a pas été modifié. Réessaie.`,
        )
      },

      removeBook(book) {
        write(
          (d) => ({
            ...d,
            books: without(d.books, book.id),
            expenses: d.expenses.filter((e) => e.book_id !== book.id),
            settlements: d.settlements.filter((s) => s.book_id !== book.id),
          }),
          () => writes.update(client, 'expense_book', book.id, { deleted_at: now() }),
          `Le carnet « ${book.name} » n’a pas été supprimé. Réessaie.`,
        )
      },

      saveExpense(fields, shares, existing) {
        const id = existing?.id ?? uuidv7()
        const book = current()?.books.find((b) => b.id === fields.book_id)
        const fx = book && fields.currency === book.currency ? 1 : fields.fx_rate
        const expense: Expense = {
          ...(existing ?? { id, household_id: household.id, ...stamps(myId) }),
          ...fields,
          fx_rate: fx,
          book_amount_cents: convertCents(fields.amount_cents, fx),
          updated_at: now(),
          updated_by: myId,
        }
        const rows: Share[] = shares.map((s) => ({ id: uuidv7(), household_id: household.id, expense_id: id, ...s, ...stamps(myId) }))
        write(
          (d) => ({
            ...d,
            expenses: existing ? replace(d.expenses, id, expense) : [expense, ...d.expenses],
            shares: [...d.shares.filter((s) => s.expense_id !== id), ...rows],
          }),
          () =>
            writes.saveExpense(
              client,
              { ...fields, fx_rate: fx, id, household_id: household.id },
              shares.map((s) => ({ user_id: s.user_id, share_cents: s.share_cents, weight: s.weight })),
            ),
          `« ${fields.label} » n’a pas été enregistrée. Réessaie.`,
        )
        return id
      },

      removeExpense(expense) {
        write(
          (d) => ({ ...d, expenses: without(d.expenses, expense.id), shares: d.shares.filter((s) => s.expense_id !== expense.id) }),
          () => writes.update(client, 'expense', expense.id, { deleted_at: now() }),
          `« ${expense.label} » n’a pas été supprimée. Réessaie.`,
        )
      },

      settle(bookId, from, to, cents) {
        const settlement: Settlement = {
          id: uuidv7(),
          household_id: household.id,
          book_id: bookId,
          from_user: from,
          to_user: to,
          amount_cents: cents,
          settled_on: isoDay(),
          note: null,
          ...stamps(myId),
        }
        write(
          (d) => ({ ...d, settlements: [settlement, ...d.settlements] }),
          () =>
            writes.insert(client, 'settlement', {
              id: settlement.id,
              household_id: household.id,
              book_id: bookId,
              from_user: from,
              to_user: to,
              amount_cents: cents,
              settled_on: settlement.settled_on,
            }),
          'Le remboursement n’a pas été enregistré. Réessaie.',
        )
      },

      removeSettlement(settlement) {
        write(
          (d) => ({ ...d, settlements: without(d.settlements, settlement.id) }),
          () => writes.update(client, 'settlement', settlement.id, { deleted_at: now() }),
          'Le remboursement n’a pas été annulé. Réessaie.',
        )
      },

      rate: (from, to) => fetchRate(client, from, to),
    }
    // key est dérivée de household.id ; query change quand ses données changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queryClient, household.id, myId, query.data, query.dataUpdatedAt, query.isPending, query.isError, error, dismissError, write])

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>
}

export function useExpenses(): ExpensesValue {
  const value = useContext(ExpensesContext)
  if (!value) throw new Error('useExpenses doit être appelé sous <ExpensesProvider>')
  return value
}
