import { describe, expect, it } from 'vitest'
import { isStale, mapDetails, mapSearch, tmdbRequest } from './map'

describe('fonction tmdb', () => {
  it('ne garde que les films et séries de la recherche', () => {
    const results = mapSearch({
      results: [
        { media_type: 'movie', id: 915935, title: 'Anatomie d’une chute', release_date: '2023-08-23', poster_path: '/a.jpg', overview: 'Sandra…' },
        { media_type: 'tv', id: 1416, name: 'Grey’s Anatomy', first_air_date: '2005-03-27', poster_path: 'http://pirate/x.jpg' },
        { media_type: 'person', id: 1, name: 'Justine Triet' },
      ],
    })
    expect(results).toEqual([
      { media_type: 'movie', external_id: '915935', title: 'Anatomie d’une chute', year: 2023, poster_path: '/a.jpg', overview: 'Sandra…' },
      { media_type: 'tv', external_id: '1416', title: 'Grey’s Anatomy', year: 2005, poster_path: null, overview: null },
    ])
  })

  it('met en forme une série avec ses plateformes au Canada', () => {
    const row = mapDetails(
      'tv',
      {
        id: 95396,
        name: 'Severance',
        original_name: 'Severance',
        first_air_date: '2022-02-17',
        episode_run_time: [50],
        number_of_seasons: 2,
        genres: [{ id: 18, name: 'Drame' }],
        'watch/providers': { results: { CA: { flatrate: [{ provider_id: 350, provider_name: 'Apple TV+', logo_path: '/l.jpg' }] }, FR: {} } },
      },
      new Date('2026-10-23T00:00:00Z'),
    )
    expect(row).toMatchObject({
      media_type: 'tv',
      external_id: '95396',
      year: 2022,
      runtime_min: 50,
      number_of_seasons: 2,
      genres: ['Drame'],
      providers: [{ id: 350, name: 'Apple TV+', logo_path: '/l.jpg' }],
      fetched_at: '2026-10-23T00:00:00.000Z',
    })
  })

  it('rafraîchit le cache après 30 jours', () => {
    const now = new Date('2026-10-23T00:00:00Z')
    expect(isStale('2026-10-01T00:00:00Z', now)).toBe(false)
    expect(isStale('2026-09-01T00:00:00Z', now)).toBe(true)
  })

  it('accepte un jeton v4 ou une clé v3, en français du Canada', () => {
    const v4 = tmdbRequest('/search/multi', 'x'.repeat(200), { query: 'anatomie' })
    expect(v4.headers.authorization).toMatch(/^Bearer /)
    expect(v4.url).toContain('language=fr-CA')
    expect(v4.url).not.toContain('api_key')
    expect(tmdbRequest('/movie/1', 'abc123').url).toContain('api_key=abc123')
  })
})
