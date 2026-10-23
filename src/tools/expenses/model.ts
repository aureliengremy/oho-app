import type { Enums, Tables } from '@/core/db/database.types'

export type Book = Tables<'expense_book'>
export type Expense = Tables<'expense'>
export type Share = Tables<'expense_share'>
export type Settlement = Tables<'settlement'>
export type SplitMode = Enums<'expense_split_mode'>
export type TripRef = Pick<Tables<'trip'>, 'id' | 'title' | 'start_date' | 'end_date' | 'cover_emoji'>

/** Ce que l'outil lit : carnets, dépenses vivantes et leurs parts, remboursements, voyages pour les lier. */
export interface ExpensesData {
  books: Book[]
  expenses: Expense[]
  shares: Share[]
  settlements: Settlement[]
  trips: TripRef[]
}

export const splitLabel: Record<SplitMode, string> = { equal: 'Égal', amounts: 'Montants', weights: 'Parts' }

/**
 * Répartit `total` centièmes selon des poids, par la méthode du plus fort reste (M16) :
 * chacun reçoit sa part arrondie vers le bas, puis les centièmes restants vont aux plus gros
 * restes (à égalité, dans l'ordre donné). La somme vaut toujours `total`.
 */
export function splitByWeights<K>(total: number, weights: readonly { key: K; weight: number }[]): { key: K; cents: number }[] {
  const sum = weights.reduce((s, w) => s + w.weight, 0)
  if (sum <= 0) return weights.map((w) => ({ key: w.key, cents: 0 }))
  const raw = weights.map((w, index) => {
    const exact = (total * w.weight) / sum
    return { key: w.key, index, cents: Math.floor(exact), rest: exact - Math.floor(exact) }
  })
  let left = total - raw.reduce((s, r) => s + r.cents, 0)
  for (const r of [...raw].sort((a, b) => b.rest - a.rest || a.index - b.index)) {
    if (left <= 0) break
    r.cents += 1
    left -= 1
  }
  return raw.map((r) => ({ key: r.key, cents: r.cents }))
}

export const splitEqual = <K>(total: number, keys: readonly K[]) => splitByWeights(total, keys.map((key) => ({ key, weight: 1 })))

/** Solde par membre d'un carnet : payé − dû + remboursé − reçu (positif = on lui doit), comme `expense_balance`. */
export function balances(data: ExpensesData, bookId: string, memberIds: readonly string[]): Map<string, number> {
  const result = new Map(memberIds.map((id) => [id, 0]))
  const add = (id: string, cents: number) => result.set(id, (result.get(id) ?? 0) + cents)
  const live = new Set<string>()
  for (const e of data.expenses) {
    if (e.book_id !== bookId) continue
    live.add(e.id)
    add(e.paid_by, e.book_amount_cents ?? 0)
  }
  for (const s of data.shares) if (live.has(s.expense_id)) add(s.user_id, -s.share_cents)
  for (const t of data.settlements) {
    if (t.book_id !== bookId) continue
    add(t.from_user, t.amount_cents)
    add(t.to_user, -t.amount_cents)
  }
  return result
}

export interface Transfer {
  from: string
  to: string
  cents: number
}

/** Qui rembourse qui : le plus gros débiteur paie le plus gros créancier, jusqu'à zéro (n − 1 virements au plus). */
export function suggestTransfers(balance: ReadonlyMap<string, number>): Transfer[] {
  const debtors = [...balance].filter(([, c]) => c < 0).map(([id, c]) => ({ id, cents: -c }))
  const creditors = [...balance].filter(([, c]) => c > 0).map(([id, c]) => ({ id, cents: c }))
  const transfers: Transfer[] = []
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.cents - a.cents)
    creditors.sort((a, b) => b.cents - a.cents)
    const d = debtors[0]
    const c = creditors[0]
    const cents = Math.min(d.cents, c.cents)
    transfers.push({ from: d.id, to: c.id, cents })
    d.cents -= cents
    c.cents -= cents
    if (d.cents === 0) debtors.shift()
    if (c.cents === 0) creditors.shift()
  }
  return transfers
}

/** Total d'un carnet, et la part d'une personne, en devise du carnet. */
export function totals(data: ExpensesData, bookId: string, userId: string | null): { total: number; mine: number; paid: Map<string, number> } {
  const expenses = data.expenses.filter((e) => e.book_id === bookId)
  const ids = new Set(expenses.map((e) => e.id))
  const paid = new Map<string, number>()
  for (const e of expenses) paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + (e.book_amount_cents ?? 0))
  return {
    total: expenses.reduce((s, e) => s + (e.book_amount_cents ?? 0), 0),
    mine: data.shares.filter((s) => ids.has(s.expense_id) && s.user_id === userId).reduce((s, x) => s + x.share_cents, 0),
    paid,
  }
}

/**
 * Les dépenses d'un carnet par jour, du plus récent au plus ancien, avec le total du jour.
 * Pour un carnet de voyage, tout ce qui précède le départ forme un seul groupe, en dernier.
 */
export function byDay(expenses: readonly Expense[], tripStart?: string | null): { day: string; total: number; expenses: Expense[] }[] {
  const groups = new Map<string, { day: string; expenses: Expense[] }>()
  for (const e of [...expenses].sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at))) {
    const key = tripStart && e.spent_on < tripStart ? 'avant' : e.spent_on
    const group = groups.get(key) ?? { day: e.spent_on, expenses: [] }
    group.expenses.push(e)
    groups.set(key, group)
  }
  return [...groups.values()].map((g) => ({ ...g, total: g.expenses.reduce((s, e) => s + (e.book_amount_cents ?? 0), 0) }))
}

const dayFormat = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** « Dim. 9 nov. » ; « Avant le départ » pour un carnet de voyage. */
export function dayLabel(day: string, tripStart?: string | null): string {
  if (tripStart && day < tripStart) return 'Avant le départ'
  const text = dayFormat.format(new Date(`${day}T00:00:00Z`)).replace(/\s+/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function nextSortOrder(rows: readonly { sort_order: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1
}

/** Une ligne de partage saisie : un montant (« Montants », en centièmes de la devise de la dépense) ou un poids (« Parts »). */
export interface ShareInput {
  user_id: string
  value: number
}

export interface ComputedShare {
  user_id: string
  share_cents: number
  weight: number | null
}

/**
 * Les parts d'une dépense, en devise du carnet, qui totalisent toujours `bookTotal` :
 * « Égal » entre tous les membres, « Montants » au prorata des montants saisis (exact si même
 * devise), « Parts » selon les poids. Une personne à zéro n'a pas de part.
 */
export function computeShares(mode: SplitMode, bookTotal: number, memberIds: readonly string[], inputs: readonly ShareInput[]): ComputedShare[] {
  if (mode === 'equal') return splitEqual(bookTotal, memberIds).map((s) => ({ user_id: s.key, share_cents: s.cents, weight: null }))
  const kept = inputs.filter((i) => i.value > 0)
  return splitByWeights(bookTotal, kept.map((i) => ({ key: i.user_id, weight: i.value }))).map((s) => ({
    user_id: s.key,
    share_cents: s.cents,
    weight: mode === 'weights' ? (kept.find((i) => i.user_id === s.key)?.value ?? null) : null,
  }))
}

/** Le carnet à ouvrir par défaut : celui du voyage en cours, sinon le premier. */
export function defaultBook(data: ExpensesData, today: string): Book | undefined {
  const ongoing = data.trips.find((t) => t.start_date && t.start_date <= today && today <= (t.end_date ?? t.start_date))
  return (ongoing && data.books.find((b) => b.trip_id === ongoing.id)) || data.books[0]
}

/** Dépensé par catégorie dans un carnet, du plus gros au plus petit. */
export function byCategory(expenses: readonly Expense[]): { category: Expense['category']; cents: number }[] {
  const sums = new Map<Expense['category'], number>()
  for (const e of expenses) sums.set(e.category, (sums.get(e.category) ?? 0) + (e.book_amount_cents ?? 0))
  return [...sums].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents)
}

export type Situation =
  | { kind: 'even' }
  | { kind: 'owe' | 'owed' | 'others'; transfer: Transfer }

/** Ce que le solde dit à la personne connectée : elle doit, on lui doit, d'autres se doivent, ou tout le monde est quitte. */
export function situation(balance: ReadonlyMap<string, number>, myId: string | null): Situation {
  const transfers = suggestTransfers(balance)
  const owe = transfers.find((t) => t.from === myId)
  if (owe) return { kind: 'owe', transfer: owe }
  const owed = transfers.find((t) => t.to === myId)
  if (owed) return { kind: 'owed', transfer: owed }
  return transfers.length > 0 ? { kind: 'others', transfer: transfers[0] } : { kind: 'even' }
}
