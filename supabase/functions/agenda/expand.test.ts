import { describe, expect, it } from 'vitest'
import { expandCalendar, wallToInstant } from './expand'

// Un flux comme celui de Google : fuseau annoncé, VTIMEZONE, récurrence avec exception et suppression.
const ics = (events: string) =>
  [
    'BEGIN:VCALENDAR',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'VERSION:2.0',
    'X-WR-CALNAME:Nous deux',
    'X-WR-TIMEZONE:America/Toronto',
    'BEGIN:VTIMEZONE',
    'TZID:America/Toronto',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    events.trim(),
    'END:VCALENDAR',
  ].join('\r\n')

const between = (from: string, to: string) => [new Date(from), new Date(to)] as const

describe('fonction agenda', () => {
  it('convertit une heure murale en instant, changement d’heure compris', () => {
    const t = (day: number, hour: number) => ({ year: 2026, month: 11, day, hour, minute: 0, second: 0 })
    expect(new Date(wallToInstant(t(1, 9), 'America/Toronto')).toISOString()).toBe('2026-11-01T14:00:00.000Z')
    expect(new Date(wallToInstant(t(30, 9), 'America/Toronto')).toISOString()).toBe('2026-11-30T14:00:00.000Z')
  })

  it('lit un événement simple, une journée entière et un événement en UTC', () => {
    const feed = ics(`
BEGIN:VEVENT
DTSTART;TZID=America/Toronto:20261028T183000
DTEND;TZID=America/Toronto:20261028T200000
UID:souper@google.com
SUMMARY:Souper chez Paul
LOCATION:123 rue Saint-Denis\\, Montréal
DESCRIPTION:Apporter le vin<br>et le dessert
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261031
DTEND;VALUE=DATE:20261101
UID:halloween@google.com
SUMMARY:Halloween
END:VEVENT
BEGIN:VEVENT
DTSTART:20261029T120000Z
DTEND:20261029T130000Z
UID:appel@google.com
SUMMARY:Appel
END:VEVENT
`)
    const events = expandCalendar(feed, ...between('2026-10-26T04:00:00Z', '2026-11-02T05:00:00Z'))
    expect(events).toEqual([
      {
        id: 'souper@google.com/2026-10-28T22:30:00.000Z',
        title: 'Souper chez Paul',
        allDay: false,
        start: '2026-10-28T22:30:00.000Z',
        end: '2026-10-29T00:00:00.000Z',
        location: '123 rue Saint-Denis, Montréal',
        description: 'Apporter le vin\net le dessert',
      },
      { id: 'appel@google.com/2026-10-29T12:00:00.000Z', title: 'Appel', allDay: false, start: '2026-10-29T12:00:00.000Z', end: '2026-10-29T13:00:00.000Z', location: null, description: null },
      { id: 'halloween@google.com/2026-10-31', title: 'Halloween', allDay: true, start: '2026-10-31', end: '2026-11-01', location: null, description: null },
    ])
  })

  it('déroule une récurrence, avec une occurrence déplacée et une supprimée, à travers le changement d’heure', () => {
    const feed = ics(`
BEGIN:VEVENT
DTSTART;TZID=America/Toronto:20261001T190000
DTEND;TZID=America/Toronto:20261001T200000
RRULE:FREQ=WEEKLY;BYDAY=TH
EXDATE;TZID=America/Toronto:20261022T190000
UID:yoga@google.com
SUMMARY:Yoga
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/Toronto:20261030T100000
DTEND;TZID=America/Toronto:20261030T110000
RECURRENCE-ID;TZID=America/Toronto:20261029T190000
UID:yoga@google.com
SUMMARY:Yoga (déplacé)
END:VEVENT
`)
    const events = expandCalendar(feed, ...between('2026-10-15T04:00:00Z', '2026-11-10T05:00:00Z'))
    expect(events.map((e) => [e.title, e.start])).toEqual([
      ['Yoga', '2026-10-15T23:00:00.000Z'],
      ['Yoga (déplacé)', '2026-10-30T14:00:00.000Z'],
      // Après le 1er novembre, 19 h à Toronto = minuit UTC.
      ['Yoga', '2026-11-06T00:00:00.000Z'],
    ])
  })

  it('ignore les événements annulés et ceux hors période', () => {
    const feed = ics(`
BEGIN:VEVENT
DTSTART;TZID=America/Toronto:20261028T090000
DTEND;TZID=America/Toronto:20261028T100000
UID:annule@google.com
STATUS:CANCELLED
SUMMARY:Annulé
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/Toronto:20261201T090000
DTEND;TZID=America/Toronto:20261201T100000
UID:loin@google.com
SUMMARY:Plus tard
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261020
DTEND;VALUE=DATE:20261030
UID:vacances@google.com
SUMMARY:Vacances
END:VEVENT
`)
    const events = expandCalendar(feed, ...between('2026-10-26T04:00:00Z', '2026-11-02T05:00:00Z'))
    expect(events.map((e) => e.title)).toEqual(['Vacances'])
  })

  it('arrête une récurrence quotidienne ancienne sans tout dérouler', () => {
    const feed = ics(`
BEGIN:VEVENT
DTSTART;TZID=America/Toronto:20200101T080000
DTEND;TZID=America/Toronto:20200101T081500
RRULE:FREQ=DAILY
UID:pilules@google.com
SUMMARY:Vitamines
END:VEVENT
`)
    const events = expandCalendar(feed, ...between('2026-10-26T04:00:00Z', '2026-10-28T04:00:00Z'))
    expect(events.map((e) => e.start)).toEqual(['2026-10-26T12:00:00.000Z', '2026-10-27T12:00:00.000Z'])
  })
})
