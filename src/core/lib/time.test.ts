import { describe, expect, it } from 'vitest'
import { greeting, relativeTime } from './time'

describe('relativeTime', () => {
  const now = new Date('2026-10-23T20:00:00')
  it('reste court pour le fil d’activité', () => {
    expect(relativeTime('2026-10-23T19:59:40', now)).toBe('à l’instant')
    expect(relativeTime('2026-10-23T19:58:00', now)).toMatch(/il\sy\sa\s2\smin/u)
    expect(relativeTime('2026-10-22T19:00:00', now)).toBe('hier')
  })
})

describe('greeting', () => {
  it('dit bonsoir à partir de 18 h', () => {
    expect(greeting(new Date('2026-10-23T09:00:00'))).toBe('Bonjour')
    expect(greeting(new Date('2026-10-23T18:30:00'))).toBe('Bonsoir')
  })
})
