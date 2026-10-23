/**
 * Heures dans un fuseau donné, sans bibliothèque : une réservation garde l'heure locale du lieu
 * (« départ 21 h 35 à Montréal ») quel que soit le fuseau du téléphone qui l'affiche.
 * Les saisies se font au format des champs `datetime-local` (AAAA-MM-JJTHH:mm).
 */

function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(values.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** Écart du fuseau avec UTC à cet instant, en minutes (Montréal en été : -240). */
function offsetMinutes(date: Date, timeZone: string): number {
  const p = parts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000)
}

/** « 2026-11-06T21:35 » à Toronto → instant ISO UTC. Null si la saisie est vide ou invalide. */
export function zonedToIso(local: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!match) return null
  const [, y, mo, d, h, mi] = match.map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  // Deux passes : l'écart peut changer entre l'heure devinée et l'heure réelle (changement d'heure).
  let instant = guess - offsetMinutes(new Date(guess), timeZone) * 60_000
  instant = guess - offsetMinutes(new Date(instant), timeZone) * 60_000
  return new Date(instant).toISOString()
}

/** Instant ISO → valeur de champ `datetime-local` dans le fuseau donné. */
export function isoToZoned(iso: string, timeZone: string): string {
  const p = parts(new Date(iso), timeZone)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`
}

/** « jeu. 6 nov. · 21 h 35 » dans le fuseau du lieu. */
export function formatZoned(iso: string, timeZone: string): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  const time = new Intl.DateTimeFormat('fr-CA', { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(date)
  return `${day} · ${time}`.replace(/\s+/g, ' ')
}

/** Ville lisible d'un fuseau : « America/Toronto » → « Toronto ». */
export function zoneCity(timeZone: string): string {
  return (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ')
}

/** Les fuseaux connus du navigateur, ou une courte liste de secours. */
export function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['America/Toronto', 'America/Vancouver', 'Europe/Paris', 'Europe/Lisbon', 'Europe/London', 'Asia/Tokyo', 'UTC']
  }
}

/** Nom français du fuseau : « heure de l’Est », « heure d’Europe de l’Ouest » ; la ville à défaut. */
export function zoneName(timeZone: string): string {
  try {
    const name = new Intl.DateTimeFormat('fr-CA', { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value
    if (name && !/^(UTC|GMT)/.test(name)) return name.charAt(0).toLowerCase() + name.slice(1)
  } catch {
    // Fuseau inconnu du navigateur : la ville suffit.
  }
  return `heure de ${zoneCity(timeZone)}`
}
