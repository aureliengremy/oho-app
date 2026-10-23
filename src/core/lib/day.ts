/** Jours civils au format AAAA-MM-JJ, partagés par Voyages et Dépenses. */

/** Date du jour au format AAAA-MM-JJ, dans le fuseau de l'appareil. */
export function isoDay(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DAY = 86_400_000
const toUtc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))

/** Jours entre deux dates AAAA-MM-JJ (positif si `to` est après `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY)
}
