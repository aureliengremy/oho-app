/**
 * Agenda Google commun, en lecture seule (lot 15). Les événements viennent de la fonction serveur
 * « agenda » ; ici, seulement des calculs de jours dans le fuseau de l'espace.
 */

/** Un événement. Journée entière : dates AAAA-MM-JJ, fin exclue. Sinon : instants ISO UTC. */
export interface AgendaEvent {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string
  location: string | null
  description: string | null
}

export interface AgendaData {
  events: AgendaEvent[]
  zone: string
  fetched_at: string
}

/** Rechargement pendant qu'un écran de l'agenda est ouvert. */
export const AGENDA_REFRESH = 120_000

/** Jours lus par la liste (et la carte d'accueil, qui partage la même lecture). */
export const LIST_DAYS = 60

const DAY_MS = 86_400_000
const toUtc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function addDays(day: string, n: number): string {
  return fromUtc(toUtc(day) + n * DAY_MS)
}

/** Jour civil d'un instant dans un fuseau. */
export function dayOf(instant: string | Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    typeof instant === 'string' ? new Date(instant) : instant,
  )
}

/** Date du jour dans le fuseau de l'espace (et non celui du téléphone). */
export function todayIn(zone: string): string {
  return dayOf(new Date(), zone)
}

/** Les premiers événements de chaque jour, `max` au total, et le nombre de ceux qui restent. */
export function firstEvents<T extends { events: AgendaEvent[] }>(days: readonly T[], max: number) {
  const shown: T[] = []
  let total = 0
  for (const day of days) {
    const room = max - shown.reduce((n, d) => n + d.events.length, 0)
    if (room > 0) shown.push({ ...day, events: day.events.slice(0, room) })
    total += day.events.length
  }
  return { shown, hidden: total - shown.reduce((n, d) => n + d.events.length, 0) }
}

/** Jours touchés par un événement (un événement qui finit à minuit ne déborde pas). */
export function eventDays(event: AgendaEvent, zone: string): string[] {
  const first = event.allDay ? event.start : dayOf(event.start, zone)
  const last = event.allDay
    ? addDays(event.end > event.start ? event.end : addDays(event.start, 1), -1)
    : dayOf(new Date(Math.max(Date.parse(event.start), Date.parse(event.end) - 1)), zone)
  const days: string[] = []
  for (let day = first; day <= last && days.length < 62; day = addDays(day, 1)) days.push(day)
  return days
}

/** Les jours de [from, to[ qui ont des événements, chacun trié : journées entières d'abord, puis par heure. */
export function groupByDay(events: readonly AgendaEvent[], zone: string, from: string, to: string) {
  const byDay = new Map<string, AgendaEvent[]>()
  for (const event of events) {
    for (const day of eventDays(event, zone)) {
      if (day < from || day >= to) continue
      byDay.set(day, [...(byDay.get(day) ?? []), event])
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      events: list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'fr')),
    }))
}

const clock = (instant: string, zone: string) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: zone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(instant))
    .replace(/\s+/g, ' ')

/** « 18 h 30 », « Journée », « Jusqu’à 11 h » ou « Suite » selon la place du jour dans l'événement. */
export function timeLabel(event: AgendaEvent, day: string, zone: string): string {
  if (event.allDay) return 'Journée'
  const startsToday = dayOf(event.start, zone) === day
  const days = eventDays(event, zone)
  const endsToday = days[days.length - 1] === day
  if (startsToday) return clock(event.start, zone)
  if (endsToday) return `Jusqu’à ${clock(event.end, zone)}`
  return 'Suite'
}

/** « 18 h 30 – 20 h », « Journée entière », ou les dates d'un événement sur plusieurs jours. */
export function whenLabel(event: AgendaEvent, zone: string): string {
  const days = eventDays(event, zone)
  const date = (day: string) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(toUtc(day)))
  if (event.allDay) return days.length > 1 ? `Du ${date(days[0])} au ${date(days[days.length - 1])}` : `${date(days[0])} · journée entière`
  if (days.length > 1) return `Du ${date(days[0])}, ${clock(event.start, zone)}, au ${date(days[days.length - 1])}, ${clock(event.end, zone)}`
  const range = event.end > event.start ? `${clock(event.start, zone)} – ${clock(event.end, zone)}` : clock(event.start, zone)
  return `${date(days[0])} · ${range}`
}

/** « Aujourd’hui », « Demain », sinon « jeudi 30 octobre ». */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Aujourd’hui'
  if (day === addDays(today, 1)) return 'Demain'
  const label = new Intl.DateTimeFormat('fr-CA', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(toUtc(day)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Mois au format AAAA-MM. */
export const monthOf = (day: string) => day.slice(0, 7)

export function shiftMonth(month: string, n: number): string {
  const date = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1))
  return date.toISOString().slice(0, 7)
}

/** « Octobre 2026 ». */
export function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat('fr-CA', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(toUtc(`${month}-01`)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Semaines complètes (lundi → dimanche) qui couvrent le mois. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`
  const offset = (new Date(toUtc(first)).getUTCDay() + 6) % 7
  let day = addDays(first, -offset)
  const weeks: string[][] = []
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)))
    day = addDays(day, 7)
  } while (monthOf(day) === month)
  return weeks
}

/** Période à lire pour afficher la grille d'un mois : [premier jour, lendemain du dernier[. */
export function gridRange(month: string): { from: string; to: string } {
  const weeks = monthGrid(month)
  return { from: weeks[0][0], to: addDays(weeks[weeks.length - 1][6], 1) }
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const
