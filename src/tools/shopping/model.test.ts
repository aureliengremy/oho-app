import { describe, expect, it } from 'vitest'
import { cartItems, frequent, movedSortOrder, pickList, remainingByList, sectionsFor, suggest } from './model'
import type { CatalogEntry, Category, Item, ShoppingList } from './model'

const cat = (id: string, sort_order: number) => ({ id, name: id, sort_order }) as Category
const item = (id: string, patch: Partial<Item> = {}) =>
  ({ id, label: id, checklist_id: 'l1', category_id: null, checked: false, checked_at: null, sort_order: 1, ...patch }) as Item
const entry = (label: string, usage_count: number, patch: Partial<CatalogEntry> = {}) =>
  ({ id: label, label, label_key: label.toLowerCase(), usage_count, hidden_at: null, last_used_at: null, ...patch }) as CatalogEntry

describe('sectionsFor', () => {
  it('suit l’ordre des rayons et met les sans-rayon à la fin', () => {
    const sections = sectionsFor(
      [item('pain', { category_id: 'boulangerie' }), item('vis'), item('pommes', { category_id: 'fruits', sort_order: 2 }), item('kiwis', { category_id: 'fruits', sort_order: 1 })],
      [cat('boulangerie', 2), cat('fruits', 1), cat('surgelés', 3)],
    )
    expect(sections.map((s) => s.category?.id ?? null)).toEqual(['fruits', 'boulangerie', null])
    expect(sections[0].items.map((i) => i.id)).toEqual(['kiwis', 'pommes'])
  })

  it('range dans « Sans rayon » un item dont le rayon a disparu', () => {
    expect(sectionsFor([item('x', { category_id: 'supprimé' })], [])[0].category).toBeNull()
  })
})

describe('panier et compteurs', () => {
  it('met le dernier coché en premier', () => {
    const items = [
      item('a', { checked: true, checked_at: '2026-10-23T10:00:00Z' }),
      item('b'),
      item('c', { checked: true, checked_at: '2026-10-23T11:00:00Z' }),
    ]
    expect(cartItems(items).map((i) => i.id)).toEqual(['c', 'a'])
    expect(remainingByList([...items, item('d', { checklist_id: 'l2' })])).toEqual(new Map([['l1', 1], ['l2', 1]]))
  })

  it('ouvre la liste demandée, sinon celle par défaut', () => {
    const lists = [{ id: 'a', is_default: false }, { id: 'b', is_default: true }] as ShoppingList[]
    expect(pickList(lists, 'a')?.id).toBe('a')
    expect(pickList(lists, 'inconnue')?.id).toBe('b')
    expect(pickList([], null)).toBeUndefined()
  })
})

describe('movedSortOrder', () => {
  const rows = [{ sort_order: 1 }, { sort_order: 2 }, { sort_order: 3 }]
  it('place entre les nouveaux voisins', () => {
    expect(movedSortOrder(rows, 2, -1)).toBe(1.5)
    expect(movedSortOrder(rows, 0, 1)).toBe(2.5)
  })
  it('passe en tête ou en queue', () => {
    expect(movedSortOrder(rows, 1, -1)).toBe(0)
    expect(movedSortOrder(rows, 1, 1)).toBe(4)
  })
  it('refuse de sortir de la liste', () => {
    expect(movedSortOrder(rows, 0, -1)).toBeNull()
    expect(movedSortOrder(rows, 2, 1)).toBeNull()
  })
})

describe('catalogue', () => {
  const catalog = [entry('Fraises', 18), entry('Fromage cheddar', 11), entry('Framboises', 6), entry('Confiture de fraises', 30), entry('Frites', 2, { hidden_at: 'x' })]
  it('propose d’abord ce qui commence par la saisie, par fréquence', () => {
    expect(suggest(catalog, 'Fr', new Set()).map((c) => c.label)).toEqual(['Fraises', 'Fromage cheddar', 'Framboises', 'Confiture de fraises'])
  })
  it('écarte ce qui est déjà à acheter et ce qui est masqué', () => {
    expect(suggest(catalog, 'fra', new Set(['fraises'])).map((c) => c.label)).toEqual(['Framboises', 'Confiture de fraises'])
    expect(suggest(catalog, '  ', new Set())).toEqual([])
  })
  it('donne les achats fréquents pour l’état vide', () => {
    expect(frequent(catalog, new Set(['confiture de fraises']), 2).map((c) => c.label)).toEqual(['Fraises', 'Fromage cheddar'])
  })
})
