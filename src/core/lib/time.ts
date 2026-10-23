const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto', style: 'short' })

/** « il y a 2 min », « hier »… pour le fil d'activité. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'à l’instant'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day')
  return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })
}

/** Bonjour le jour, Bonsoir à partir de 18 h et la nuit. */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours()
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour'
}
