import { describe, expect, it } from 'vitest'
import { countdown, dDay, formatDateRange, formatLongRange, groupTrips, nextTrip, nights, progress, suggestedStatus, type Trip } from './model'

const trip = (id: string, patch: Partial<Trip>): Trip => ({
  id,
  household_id: 'hh-1',
  title: id,
  destination: null,
  start_date: null,
  end_date: null,
  status: 'idea',
  cover_emoji: null,
  notes: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  created_by: null,
  updated_by: null,
  deleted_at: null,
  ...patch,
})

const today = '2026-10-22'

describe('voyages', () => {
  it('groupe par moment : maintenant, à venir, un jour, souvenirs', () => {
    const trips = [
      trip('Kamouraska', { status: 'done', start_date: '2026-09-12', end_date: '2026-09-14' }),
      trip('Japon', { status: 'idea' }),
      trip('Ski', { status: 'planned', start_date: '2027-02-13', end_date: '2027-02-15' }),
      trip('Lisbonne', { status: 'planned', start_date: '2026-11-06', end_date: '2026-11-16' }),
      trip('Sutton', { status: 'ongoing', start_date: '2026-10-20', end_date: '2026-10-24' }),
      trip('Gaspésie', { status: 'idea', start_date: '2027-07-01' }),
    ]
    expect(groupTrips(trips, today).map((g) => [g.group, g.trips.map((t) => t.id)])).toEqual([
      ['now', ['Sutton']],
      ['upcoming', ['Lisbonne', 'Ski']],
      ['someday', ['Gaspésie', 'Japon']],
      ['memories', ['Kamouraska']],
    ])
    expect(nextTrip(trips, today)?.id).toBe('Sutton')
    expect(nextTrip(trips.filter((t) => t.id !== 'Sutton'), today)?.id).toBe('Lisbonne')
  })

  it('un voyage planifié dont les dates sont passées part dans les souvenirs', () => {
    const late = trip('Oublié', { status: 'planned', start_date: '2026-10-01', end_date: '2026-10-03' })
    expect(groupTrips([late], today)[0].group).toBe('memories')
    expect(suggestedStatus(late, today)).toBe('done')
  })

  it('suggère un statut d’après les dates, sans l’imposer', () => {
    expect(suggestedStatus(trip('a', { status: 'planned', start_date: '2026-10-20', end_date: '2026-10-24' }), today)).toBe('ongoing')
    expect(suggestedStatus(trip('b', { status: 'ongoing', start_date: '2026-10-20', end_date: '2026-10-24' }), today)).toBeNull()
    expect(suggestedStatus(trip('c', { status: 'idea', start_date: '2026-11-06' }), today)).toBeNull()
    expect(suggestedStatus(trip('d', { status: 'idea' }), today)).toBeNull()
  })

  it('écrit les dates et le compte à rebours', () => {
    const lisbonne = { start_date: '2026-11-06', end_date: '2026-11-16' }
    expect(formatDateRange('2026-11-06', '2026-11-16')).toBe('6 – 16 nov.')
    expect(formatDateRange('2026-10-30', '2026-11-02')).toBe('30 oct. – 2 nov.')
    expect(formatDateRange(null, null)).toBe('Sans dates')
    expect(formatLongRange('2026-11-06', '2026-11-16')).toBe('ven. 6 – lun. 16 novembre 2026')
    expect(nights(lisbonne)).toBe(10)
    expect(countdown(lisbonne, today)).toBe('dans 15 jours')
    expect(countdown(lisbonne, '2026-11-05')).toBe('demain')
    expect(countdown({ start_date: '2026-10-20', end_date: '2026-10-23' }, today)).toBe('jusqu’à demain')
    expect(countdown({ start_date: '2026-10-20', end_date: '2026-10-24' }, today)).toBe('jusqu’à samedi')
    expect(countdown(lisbonne, '2026-11-20')).toBeNull()
    expect(dDay(lisbonne, today)).toBe('J – 15')
  })

  it('compte l’avancement de la préparation', () => {
    expect(progress([{ checked: true }, { checked: false }, { checked: true }])).toEqual({ done: 2, total: 3, percent: 67 })
    expect(progress([])).toEqual({ done: 0, total: 0, percent: 0 })
  })
})
