import { describe, expect, it } from 'vitest'
import { watchRows } from '@/test/fakeClient'
import { draw, formatRuntime, sortItems, tonight, type WatchData } from './model'

const data = {
  items: watchRows.watch_item,
  ratings: watchRows.watch_rating,
  platforms: watchRows.watch_platform,
  media: watchRows.external_media,
} as unknown as WatchData

describe('à regarder', () => {
  it('« ce soir » garde ce qui tient dans la soirée, sur nos plateformes', () => {
    // Severance : Apple TV+ sans abonnement ; Le règne animal : 128 min ; The Bear : sans plateforme, gardé.
    expect(tonight(data, 120).map((i) => i.title)).toEqual(['Past Lives', 'The Bear'])
    expect(tonight(data, 150).map((i) => i.title)).toEqual(['Past Lives', 'Le règne animal', 'The Bear'])
  })

  it('le tirage évite de reproposer le même titre tant qu’il en reste', () => {
    const pool = data.items.slice(0, 2)
    expect(draw(pool, new Set(), () => 0)?.title).toBe('Past Lives')
    expect(draw(pool, new Set(['w-past']), () => 0)?.title).toBe('Severance')
    expect(draw(pool, new Set(['w-past', 'w-sev']), () => 0.99)?.title).toBe('Severance')
    expect(draw([], new Set())).toBeNull()
  })

  it('range les en cours d’abord, puis les plus récents', () => {
    expect(sortItems(data.items).map((i) => i.title)).toEqual(['Severance', 'The Bear', 'Le règne animal', 'Past Lives'])
  })

  it('écrit les durées', () => {
    expect(formatRuntime(106)).toBe('1 h 46')
    expect(formatRuntime(50)).toBe('50 min')
    expect(formatRuntime(120)).toBe('2 h')
    expect(formatRuntime(null)).toBeNull()
  })
})
