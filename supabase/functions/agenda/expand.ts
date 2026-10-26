// Lecture d'un flux iCal (adresse secrète d'un agenda Google) : événements d'une période,
// récurrences déroulées, exceptions appliquées, heures converties en instants UTC.
// Module pur, testé par Vitest ; `index.ts` s'occupe du réseau.
import ICAL from 'ical.js'

/** Un événement prêt à afficher. Journée entière : dates AAAA-MM-JJ, fin exclue. Sinon : instants ISO UTC. */
export interface AgendaEvent {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string
  location: string | null
  description: string | null
}

/** Au-delà, une récurrence ancienne (« tous les jours depuis 2015 ») est coupée. */
const MAX_OCCURRENCES = 20_000
const MAX_TEXT = 500

/** Une marge plus large que tout écart de fuseau (±14 h) : on compare des heures murales à des instants. */
const MARGIN_MS = 2 * 86_400_000

// Créer un Intl.DateTimeFormat coûte cher : un par fuseau suffit.
const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** Heure murale lue comme si elle était en UTC : assez pour comparer à une période avec MARGIN_MS. */
const wallMs = (t: ICAL.Time) => Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)

/** Écart d'un fuseau avec UTC à un instant, en minutes. */
function offsetMinutes(instant: number, timeZone: string): number {
  const values = formatter(timeZone).formatToParts(new Date(instant))
  const get = (type: string) => Number(values.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000)
}

/** Heure murale d'un fuseau → instant (ms). Deux passes pour les changements d'heure. */
export function wallToInstant(t: { year: number; month: number; day: number; hour: number; minute: number; second: number }, timeZone: string): number {
  const guess = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
  if (timeZone === 'UTC') return guess
  let instant = guess - offsetMinutes(guess, timeZone) * 60_000
  instant = guess - offsetMinutes(instant, timeZone) * 60_000
  return instant
}

function validZone(zone: string | null | undefined): zone is string {
  if (!zone) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const two = (n: number) => String(n).padStart(2, '0')
const dateOf = (t: ICAL.Time) => `${t.year}-${two(t.month)}-${two(t.day)}`

/** Fuseau d'une propriété DTSTART/DTEND : UTC si « Z », son TZID s'il est connu, sinon celui de l'agenda. */
function zoneOf(prop: ICAL.Property | null, fallback: string): string {
  if (!prop) return fallback
  const raw = String(prop.toICALString())
  if (/Z$/.test(raw.trim())) return 'UTC'
  const tzid = prop.getParameter('tzid')
  const name = Array.isArray(tzid) ? tzid[0] : tzid
  return validZone(name) ? name : fallback
}

/** Texte lisible : Google glisse parfois du HTML dans la description. */
function clean(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const plain = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
  return plain ? plain.slice(0, MAX_TEXT) : null
}

const cancelled = (component: ICAL.Component) => String(component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED'

/**
 * Événements qui touchent [from, to[ (instants), triés par début.
 * `fallbackZone` sert aux heures « flottantes » quand l'agenda n'annonce pas son fuseau.
 */
export function expandCalendar(ics: string, from: Date, to: Date, fallbackZone = 'UTC'): AgendaEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics))
  const declared = root.getFirstPropertyValue('x-wr-timezone')
  const calendarZone = validZone(typeof declared === 'string' ? declared : null) ? (declared as string) : fallbackZone
  const fromMs = from.getTime()
  const toMs = to.getTime()

  // Les exceptions (RECURRENCE-ID) s'accrochent à leur événement maître, même UID.
  const masters = new Map<string, ICAL.Component>()
  const exceptions = new Map<string, ICAL.Component[]>()
  // Chaque VEVENT est détaché du calendrier : sinon ical.js parcourt tout le fichier à chaque TZID
  // pour y chercher un VTIMEZONE (quadratique sur un agenda de plusieurs années). Les fuseaux sont
  // de toute façon convertis par Intl, d'après le TZID.
  for (const component of root.getAllSubcomponents('vevent').map((c) => new ICAL.Component(c.jCal))) {
    const uid = String(component.getFirstPropertyValue('uid') ?? '')
    if (component.hasProperty('recurrence-id')) exceptions.set(uid, [...(exceptions.get(uid) ?? []), component])
    else masters.set(uid || `sans-uid-${masters.size}`, component)
  }
  // Une exception sans maître (occurrence isolée partagée) s'affiche comme un événement simple.
  for (const [uid, list] of exceptions) if (!masters.has(uid)) list.forEach((c, i) => masters.set(`${uid}#${i}`, c))

  const out: AgendaEvent[] = []

  const push = (uid: string, item: ICAL.Component, start: ICAL.Time, end: ICAL.Time) => {
    // Tri grossier sans Intl : la plupart des événements d'un vieil agenda sont loin de la période.
    if (wallMs(start) >= toMs + MARGIN_MS || Math.max(wallMs(start), wallMs(end)) < fromMs - MARGIN_MS) return
    if (cancelled(item)) return
    const startZone = zoneOf(item.getFirstProperty('dtstart'), calendarZone)
    const endZone = item.hasProperty('dtend') ? zoneOf(item.getFirstProperty('dtend'), startZone) : startZone
    const summary = clean(item.getFirstPropertyValue('summary')) ?? 'Sans titre'
    const base = { title: summary, location: clean(item.getFirstPropertyValue('location')), description: clean(item.getFirstPropertyValue('description')) }

    if (start.isDate) {
      // Fin exclue ; un événement d'une journée sans DTEND dure un jour.
      const endDay = end.compare(start) > 0 ? end : start.clone()
      if (endDay.compare(start) === 0) endDay.day += 1
      const s = wallToInstant(start, calendarZone)
      const e = wallToInstant(endDay, calendarZone)
      if (e <= fromMs || s >= toMs) return
      out.push({ id: `${uid}/${dateOf(start)}`, allDay: true, start: dateOf(start), end: dateOf(endDay), ...base })
      return
    }

    const s = wallToInstant(start, startZone)
    const e = Math.max(s, wallToInstant(end, endZone))
    // Un événement sans durée (rappel à 9 h) compte s'il tombe dans la période.
    if (e < fromMs || s >= toMs || (e === fromMs && s !== e)) return
    out.push({ id: `${uid}/${new Date(s).toISOString()}`, allDay: false, start: new Date(s).toISOString(), end: new Date(e).toISOString(), ...base })
  }

  for (const [uid, component] of masters) {
    if (!component.hasProperty('dtstart')) continue
    const event = new ICAL.Event(component, { strictExceptions: false })
    for (const exception of exceptions.get(uid) ?? []) event.relateException(exception)

    if (!event.isRecurring()) {
      push(uid, component, event.startDate, event.endDate)
      continue
    }

    // L'itérateur avance en heure murale. On ne calcule le détail (exception, fuseau) que pour les
    // occurrences proches de la période : une récurrence quotidienne depuis 2015 reste rapide.
    const durationMs = Math.max(0, (event.duration?.toSeconds() ?? 0) * 1000)
    const low = fromMs - MARGIN_MS - durationMs
    const high = toMs + MARGIN_MS
    const iterator = event.iterator(skipAhead(component, event.startDate, low))
    for (let i = 0, next = iterator.next(); next && i < MAX_OCCURRENCES; i++, next = iterator.next()) {
      const wall = wallMs(next)
      if (wall >= high) break
      if (wall < low) continue
      const details = event.getOccurrenceDetails(next)
      push(uid, details.item.component, details.startDate, details.endDate)
    }
    // Une occurrence déplacée depuis une date hors de la période vers la période.
    for (const exception of exceptions.get(uid) ?? []) {
      const original = exception.getFirstPropertyValue('recurrence-id') as ICAL.Time | null
      if (original && wallMs(original) >= low && wallMs(original) < high) continue
      const moved = new ICAL.Event(exception)
      if (moved.startDate) push(uid, exception, moved.startDate, moved.endDate)
    }
  }

  return out.sort((a, b) => sortKey(a, calendarZone) - sortKey(b, calendarZone) || a.title.localeCompare(b.title, 'fr'))
}

/**
 * Point de départ de l'itération pour une récurrence quotidienne ou hebdomadaire sans COUNT : la date
 * de début avancée d'un nombre entier de périodes, juste avant la période lue. Le motif ne change
 * pas (même jour de semaine, même heure) et l'on évite de dérouler des années d'occurrences.
 */
function skipAhead(component: ICAL.Component, start: ICAL.Time, low: number): ICAL.Time | undefined {
  const rules = component.getAllProperties('rrule')
  if (rules.length !== 1) return undefined
  const rule = rules[0].getFirstValue() as ICAL.Recur
  if (rule.count) return undefined
  const step = rule.freq === 'DAILY' ? rule.interval : rule.freq === 'WEEKLY' ? 7 * rule.interval : 0
  if (!step) return undefined
  const periods = Math.floor((low - wallMs(start)) / 86_400_000 / step) - 1
  if (periods <= 0) return undefined
  const anchored = start.clone()
  anchored.adjust(periods * step, 0, 0, 0)
  return anchored
}

function sortKey(event: AgendaEvent, zone: string): number {
  if (!event.allDay) return Date.parse(event.start)
  const [y, m, d] = event.start.split('-').map(Number)
  return wallToInstant({ year: y, month: m, day: d, hour: 0, minute: 0, second: 0 }, zone)
}
