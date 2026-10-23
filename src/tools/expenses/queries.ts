import type { OhoClient } from '@/core/client'
import type { Json, TablesInsert, TablesUpdate } from '@/core/db/database.types'
import type { Category } from '@/core/lib/money'
import type { ExpensesData } from './model'

export const expensesKey = (householdId: string) => ['expenses', householdId] as const

/** Tables lues par l'outil, pour le rechargement en temps réel (les voyages donnent le nom et les dates). */
export const EXPENSE_TABLES = ['expense_book', 'expense', 'expense_share', 'settlement', 'trip'] as const

async function rows<T>(request: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await request
  if (error) throw error
  return data ?? []
}

/** Carnets, dépenses vivantes et leurs parts, remboursements, et les voyages auxquels lier un carnet. */
export async function fetchExpenses(client: OhoClient, householdId: string): Promise<ExpensesData> {
  const [books, expenses, shares, settlements, trips] = await Promise.all([
    rows(client.from('expense_book').select('*').eq('household_id', householdId).is('deleted_at', null).order('sort_order', { ascending: true })),
    rows(client.from('expense').select('*').eq('household_id', householdId).is('deleted_at', null).order('spent_on', { ascending: false })),
    rows(client.from('expense_share').select('*').eq('household_id', householdId).is('deleted_at', null)),
    rows(client.from('settlement').select('*').eq('household_id', householdId).is('deleted_at', null).order('settled_on', { ascending: false })),
    rows(
      client
        .from('trip')
        .select('id, title, start_date, end_date, cover_emoji')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .order('start_date', { ascending: true }),
    ),
  ])
  const bookIds = new Set(books.map((b) => b.id))
  const live = expenses.filter((e) => bookIds.has(e.book_id))
  const expenseIds = new Set(live.map((e) => e.id))
  return {
    books,
    expenses: live,
    shares: shares.filter((s) => expenseIds.has(s.expense_id)),
    settlements: settlements.filter((s) => bookIds.has(s.book_id)),
    trips,
  }
}

/** Ce qu'une réservation (outil Voyages) apporte à une nouvelle dépense : lu en base, sans importer l'outil. */
export interface BookingPrefill {
  id: string
  trip_id: string
  title: string
  amount: number | null
  currency: string | null
  category: Category
}

const bookingCategory: Record<string, Category> = {
  flight: 'transport',
  train: 'transport',
  car: 'transport',
  lodging: 'lodging',
  activity: 'activity',
  other: 'other',
}

export async function fetchBooking(client: OhoClient, bookingId: string): Promise<BookingPrefill | null> {
  const { data, error } = await client
    .from('booking')
    .select('id, trip_id, title, amount, currency, kind')
    .eq('id', bookingId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, trip_id: data.trip_id, title: data.title, amount: data.amount, currency: data.currency, category: bookingCategory[data.kind] ?? 'other' }
}

/** Taux du jour proposé par la fonction serveur « fx » (M15). Null si elle ne répond pas : on saisit le taux. */
export async function fetchRate(client: OhoClient, from: string, to: string): Promise<{ rate: number; date: string } | null> {
  const { data, error } = await client.functions.invoke<{ rate: number; date: string }>('fx', { body: { from, to } })
  if (error || !data || !(data.rate > 0)) return null
  return data
}

async function check<T extends { error: unknown }>(request: PromiseLike<T>): Promise<T> {
  const result = await request
  if (result.error) throw result.error
  return result
}

type Writable = 'expense_book' | 'expense' | 'settlement'

export const writes = {
  insert: <T extends Writable>(client: OhoClient, table: T, row: TablesInsert<T>) => check(client.from(table).insert(row as never)),
  // Toutes ces tables ont une colonne id : on passe par 'expense' pour le typage du filtre.
  update: <T extends Writable>(client: OhoClient, table: T, id: string, patch: TablesUpdate<T>) =>
    check(client.from(table as 'expense').update(patch as never).eq('id', id)),
  /** Une dépense et ses parts, d'un bloc (M19). */
  saveExpense: (client: OhoClient, expense: Record<string, Json>, shares: Record<string, Json>[]) =>
    check(client.rpc('save_expense', { p_expense: expense, p_shares: shares })),
}
