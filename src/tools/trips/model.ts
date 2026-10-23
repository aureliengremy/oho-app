import type { Enums, Tables } from '@/core/db/database.types'

export type Trip = Tables<'trip'>
export type TripStatus = Enums<'trip_status'>
export type TripIdea = Tables<'trip_activity'>
export type Booking = Tables<'booking'>
export type BookingKind = Enums<'booking_kind'>
export type BudgetLine = Tables<'trip_budget_line'>
export type BudgetCategory = Enums<'expense_category'>
export type Attachment = Tables<'attachment'>
export type PrepList = Tables<'checklist'>
export type PrepItem = Tables<'checklist_item'>

/** Tout ce que l'outil Voyages lit pour l'espace : quelques dizaines de lignes pour un couple. */
export interface TripsData {
  trips: Trip[]
  ideas: TripIdea[]
  bookings: Booking[]
  budget: BudgetLine[]
  attachments: Attachment[]
  prepLists: PrepList[]
  prepItems: PrepItem[]
}

export const statusLabel: Record<TripStatus, string> = {
  idea: 'Idée',
  planned: 'Planifié',
  ongoing: 'En cours',
  done: 'Terminé',
}

export const bookingKindLabel: Record<BookingKind, string> = {
  flight: 'Vol',
  train: 'Train',
  lodging: 'Logement',
  car: 'Voiture',
  activity: 'Activité',
  other: 'Autre',
}

// Postes de budget et montants : les mêmes que l'outil Dépenses (src/core/lib/money.ts).
export { categoryLabel as budgetCategoryLabel, formatMoney } from '@/core/lib/money'

import { daysBetween } from '@/core/lib/day'
export { daysBetween, isoDay } from '@/core/lib/day'

/** Le statut que les dates suggèrent (M10 : stocké, l'interface propose). Null si rien à proposer. */
export function suggestedStatus(trip: Pick<Trip, 'status' | 'start_date' | 'end_date'>, today: string): TripStatus | null {
  const { start_date: start, end_date: end, status } = trip
  if (!start) return null
  const last = end ?? start
  let suggested: TripStatus
  if (today > last) suggested = 'done'
  else if (today >= start) suggested = 'ongoing'
  else suggested = status === 'idea' ? 'idea' : 'planned'
  return suggested === status ? null : suggested
}

export type TripGroup = 'now' | 'upcoming' | 'someday' | 'memories'

export const groupLabel: Record<TripGroup, string> = {
  now: 'Maintenant',
  upcoming: 'À venir',
  someday: 'Un jour',
  memories: 'Souvenirs',
}

/** Le moment d'un voyage, d'après son statut et, à défaut, ses dates. */
export function tripGroup(trip: Trip, today: string): TripGroup {
  if (trip.status === 'done') return 'memories'
  const last = trip.end_date ?? trip.start_date
  if (last && today > last) return 'memories'
  if (trip.status === 'ongoing' || (trip.start_date && today >= trip.start_date)) return 'now'
  if (trip.status === 'idea' || !trip.start_date) return 'someday'
  return 'upcoming'
}

/** Les voyages groupés par moment ; à venir du plus proche au plus lointain, souvenirs du plus récent. */
export function groupTrips(trips: readonly Trip[], today: string): { group: TripGroup; trips: Trip[] }[] {
  const order: TripGroup[] = ['now', 'upcoming', 'someday', 'memories']
  const byStart = (a: Trip, b: Trip) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.title.localeCompare(b.title, 'fr')
  return order
    .map((group) => {
      const inGroup = trips.filter((t) => tripGroup(t, today) === group).sort(byStart)
      return { group, trips: group === 'memories' ? inGroup.reverse() : inGroup }
    })
    .filter((g) => g.trips.length > 0)
}

/** Le prochain voyage pour l'accueil : celui en cours, sinon le plus proche à venir. */
export function nextTrip(trips: readonly Trip[], today: string): Trip | null {
  const groups = groupTrips(trips, today)
  return groups.find((g) => g.group === 'now')?.trips[0] ?? groups.find((g) => g.group === 'upcoming')?.trips[0] ?? null
}

const dayMonth = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayOnly = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', timeZone: 'UTC' })
const longDay = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const longDayMonthYear = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', timeZone: 'UTC' })

const asDate = (day: string) => new Date(`${day}T00:00:00Z`)
// fr-CA écrit « 6 nov. » ; on garde le point des abréviations.
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim()

/** « 6 – 16 nov. », « 30 oct. – 2 nov. », « 6 nov. », « Sans dates ». */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Sans dates'
  if (!end || end === start) return tidy(dayMonth.format(asDate(start)))
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  const from = sameMonth ? dayOnly.format(asDate(start)) : dayMonth.format(asDate(start))
  return tidy(`${from} – ${dayMonth.format(asDate(end))}`)
}

/** « jeu. 6 – dim. 16 novembre 2026 » pour l'en-tête de la fiche. */
export function formatLongRange(start: string | null, end: string | null): string {
  if (!start) return 'Dates à choisir'
  if (!end || end === start) return tidy(longDayMonthYear.format(asDate(start)))
  if (start.slice(0, 7) === end.slice(0, 7)) return tidy(`${longDay.format(asDate(start))} – ${longDayMonthYear.format(asDate(end))}`)
  return tidy(`${longDayMonthYear.format(asDate(start))} – ${longDayMonthYear.format(asDate(end))}`)
}

/** Nuits entre l'arrivée et le départ. */
export function nights(trip: Pick<Trip, 'start_date' | 'end_date'>): number | null {
  if (!trip.start_date || !trip.end_date) return null
  return daysBetween(trip.start_date, trip.end_date)
}

export function nightsLabel(n: number | null): string | null {
  if (n === null || n <= 0) return null
  return n === 1 ? '1 nuit' : `${n} nuits`
}

/** « dans 15 jours », « demain », « jusqu’à vendredi », « hier »… selon où on en est. */
export function countdown(trip: Pick<Trip, 'start_date' | 'end_date'>, today: string): string | null {
  const { start_date: start, end_date: end } = trip
  if (!start) return null
  const until = daysBetween(today, start)
  if (until > 1) return `dans ${until} jours`
  if (until === 1) return 'demain'
  const last = end ?? start
  const left = daysBetween(today, last)
  if (until <= 0 && left >= 0) {
    if (left === 0) return 'dernier jour'
    if (left === 1) return 'jusqu’à demain'
    if (left < 7) return `jusqu’à ${weekday.format(asDate(last))}`
    return `encore ${left} jours`
  }
  return null
}

/** « J – 15 » pour les cartes de la liste. */
export function dDay(trip: Pick<Trip, 'start_date'>, today: string): string | null {
  if (!trip.start_date) return null
  const until = daysBetween(today, trip.start_date)
  return until > 0 ? `J – ${until}` : null
}

/** Avancement de la checklist de préparation : cochés, total, pourcentage arrondi. */
export function progress(items: readonly Pick<PrepItem, 'checked'>[]): { done: number; total: number; percent: number } {
  const total = items.length
  const done = items.filter((i) => i.checked).length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** Taille lisible : « 212 Ko », « 1,4 Mo ». */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} Mo`
}

export function nextSortOrder(rows: readonly { sort_order: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1
}
