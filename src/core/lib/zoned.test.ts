import { describe, expect, it } from 'vitest'
import { formatZoned, isoToZoned, zonedToIso, zoneCity, zoneName } from './zoned'

describe('heures dans un fuseau', () => {
  it('convertit une heure locale de Toronto en UTC (heure normale)', () => {
    expect(zonedToIso('2026-11-06T21:35', 'America/Toronto')).toBe('2026-11-07T02:35:00.000Z')
  })

  it('tient compte de l’heure d’été', () => {
    expect(zonedToIso('2026-07-01T09:00', 'America/Toronto')).toBe('2026-07-01T13:00:00.000Z')
    expect(zonedToIso('2026-07-01T09:00', 'Europe/Lisbon')).toBe('2026-07-01T08:00:00.000Z')
  })

  it('fait l’aller-retour avec le champ datetime-local', () => {
    const iso = zonedToIso('2026-11-12T09:09', 'Europe/Lisbon')!
    expect(isoToZoned(iso, 'Europe/Lisbon')).toBe('2026-11-12T09:09')
    expect(isoToZoned(iso, 'America/Toronto')).toBe('2026-11-12T04:09')
  })

  it('refuse une saisie vide', () => {
    expect(zonedToIso('', 'UTC')).toBeNull()
  })

  it('affiche l’heure du lieu, pas celle du téléphone', () => {
    expect(formatZoned('2026-11-07T02:35:00Z', 'America/Toronto')).toMatch(/6\snov\..*21\sh\s35/u)
    expect(zoneCity('America/Port_of_Spain')).toBe('Port of Spain')
    expect(zoneName('America/Toronto')).toMatch(/^heure /)
  })
})
