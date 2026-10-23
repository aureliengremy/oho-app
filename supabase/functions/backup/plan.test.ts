import { describe, expect, it } from 'vitest'
import { backupPath, toPrune } from './plan'

describe('la sauvegarde hebdomadaire', () => {
  it('range par espace et par date', () => {
    expect(backupPath('hh-1', new Date('2026-10-25T04:00:00Z'))).toBe('hh-1/2026-10-25.json')
  })

  it('garde les huit plus récentes et ignore les autres fichiers', () => {
    const names = Array.from({ length: 10 }, (_, i) => `2026-0${Math.floor(i / 3) + 1}-1${i % 3}.json`)
    expect(toPrune([...names, 'notes.txt'])).toEqual(['2026-01-11.json', '2026-01-10.json'])
    expect(toPrune(names.slice(0, 3))).toEqual([])
  })
})
