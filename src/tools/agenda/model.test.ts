import { describe, expect, it } from 'vitest'
import { dayLabel, eventDays, firstEvents, gridRange, groupByDay, monthGrid, monthLabel, shiftMonth, timeLabel, whenLabel, type AgendaEvent } from './model'

const zone = 'America/Toronto'
const timed = (id: string, start: string, end: string, title = id): AgendaEvent => ({ id, title, allDay: false, start, end, location: null, description: null })
const allDay = (id: string, start: string, end: string): AgendaEvent => ({ id, title: id, allDay: true, start, end, location: null, description: null })

describe('agenda : jours', () => {
  it('place un événement le soir à Toronto sur son jour local, pas sur le jour UTC', () => {
    expect(eventDays(timed('souper', '2026-10-28T23:30:00Z', '2026-10-29T01:00:00Z'), zone)).toEqual(['2026-10-28'])
  })

  it('étale une journée entière sur plusieurs jours, fin exclue', () => {
    expect(eventDays(allDay('vacances', '2026-10-30', '2026-11-02'), zone)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('ne déborde pas sur le lendemain quand l’événement finit à minuit', () => {
    expect(eventDays(timed('soirée', '2026-10-28T22:00:00Z', '2026-10-29T04:00:00Z'), zone)).toEqual(['2026-10-28'])
  })

  it('groupe par jour, journées entières d’abord', () => {
    const days = groupByDay(
      [timed('café', '2026-10-27T13:00:00Z', '2026-10-27T14:00:00Z'), allDay('anniv', '2026-10-27', '2026-10-28'), timed('loin', '2026-12-01T13:00:00Z', '2026-12-01T14:00:00Z')],
      zone,
      '2026-10-26',
      '2026-11-02',
    )
    expect(days.map((d) => [d.day, d.events.map((e) => e.id)])).toEqual([['2026-10-27', ['anniv', 'café']]])
  })

  it('écrit l’heure selon la place du jour dans l’événement', () => {
    const night = timed('nuit', '2026-10-28T02:00:00Z', '2026-10-29T15:00:00Z')
    expect(timeLabel(night, '2026-10-27', zone)).toBe('22 h 00')
    expect(timeLabel(night, '2026-10-28', zone)).toBe('Suite')
    expect(timeLabel(night, '2026-10-29', zone)).toBe('Jusqu’à 11 h 00')
    expect(timeLabel(allDay('a', '2026-10-27', '2026-10-28'), '2026-10-27', zone)).toBe('Journée')
    expect(whenLabel(timed('café', '2026-10-27T13:00:00Z', '2026-10-27T14:30:00Z'), zone)).toBe('mardi 27 octobre · 9 h 00 – 10 h 30')
  })

  it('garde les premiers événements pour l’accueil et compte le reste', () => {
    const e = (id: string) => allDay(id, '2026-10-27', '2026-10-28')
    const { shown, hidden } = firstEvents([{ day: 'a', events: [e('1'), e('2')] }, { day: 'b', events: [e('3'), e('4')] }, { day: 'c', events: [e('5')] }], 3)
    expect(shown.map((d) => [d.day, d.events.map((x) => x.id)])).toEqual([['a', ['1', '2']], ['b', ['3']]])
    expect(hidden).toBe(2)
  })

  it('nomme aujourd’hui et demain', () => {
    expect(dayLabel('2026-10-26', '2026-10-26')).toBe('Aujourd’hui')
    expect(dayLabel('2026-10-27', '2026-10-26')).toBe('Demain')
    expect(dayLabel('2026-10-30', '2026-10-26')).toBe('Vendredi 30 octobre')
  })
})

describe('agenda : mois', () => {
  it('couvre le mois en semaines du lundi au dimanche', () => {
    const weeks = monthGrid('2026-11')
    expect(weeks[0][0]).toBe('2026-10-26')
    expect(weeks.at(-1)?.[6]).toBe('2026-12-06')
    expect(weeks).toHaveLength(6)
    expect(gridRange('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-07' })
  })

  it('change de mois et l’écrit', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(monthLabel('2026-10')).toBe('Octobre 2026')
  })
})
