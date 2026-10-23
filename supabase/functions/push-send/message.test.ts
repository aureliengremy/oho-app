import { describe, expect, it } from 'vitest'
import { formatDigest, outcome } from './message'

const digest = { digest_id: 'd', tool_key: 'shopping', item_count: 1, actor_names: ['Auriane'], labels: ['Lait'], entity_types: ['checklist_item'] }

describe('le message regroupé', () => {
  it('un ajout : le libellé', () => {
    expect(formatDigest(digest)).toEqual({ title: 'OhO · Courses', body: 'Auriane a ajouté « Lait ».', url: '/courses', tag: 'oho-shopping' })
  })

  it('plusieurs ajouts : le nombre puis les libellés', () => {
    expect(formatDigest({ ...digest, item_count: 3, labels: ['Lait', 'Pain', 'Avocats'] }).body).toBe(
      'Auriane a ajouté 3 articles : « Lait », « Pain » et « Avocats ».',
    )
    expect(formatDigest({ ...digest, item_count: 7, labels: ['A', 'B', 'C', 'D', 'E'] }).body).toBe(
      'Auriane a ajouté 7 articles : « A », « B », « C », « D », « E »…',
    )
  })

  it('deux auteurs, un autre outil, un outil inconnu', () => {
    const m = formatDigest({ ...digest, tool_key: 'watchlist', item_count: 2, actor_names: ['Auriane', 'Aurélien'], labels: [] })
    expect(m).toMatchObject({ title: 'OhO · À regarder', body: 'Auriane et Aurélien ont ajouté 2 titres.', url: '/a-regarder' })
    expect(formatDigest({ ...digest, tool_key: 'recettes', labels: [] })).toMatchObject({ title: 'OhO', body: 'Auriane a ajouté un élément.', url: '/' })
  })

  it('404 et 410 retirent l’appareil, le reste compte un échec', () => {
    expect([201, 404, 410, 429, 500].map(outcome)).toEqual(['ok', 'gone', 'gone', 'failed', 'failed'])
  })
})
