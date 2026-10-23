import { describe, expect, it } from 'vitest'
import { currentFragment, dropFragment, formatQuantity, parseQuickAdd } from './parse'

describe('parseQuickAdd', () => {
  it('sépare sur la virgule et met une majuscule', () => {
    expect(parseQuickAdd('lait, œufs,pain')).toEqual([
      { label: 'Lait', quantity: null },
      { label: 'Œufs', quantity: null },
      { label: 'Pain', quantity: null },
    ])
  })

  it('lit une quantité devant ou derrière', () => {
    expect(parseQuickAdd('3 avocats; bananes x6; citrons ×2')).toEqual([
      { label: 'Avocats', quantity: '3' },
      { label: 'Bananes', quantity: '6' },
      { label: 'Citrons', quantity: '2' },
    ])
  })

  it('garde les unités et les pourcentages dans le libellé', () => {
    expect(parseQuickAdd('2 L de lait, Lait 2 %, 500 g beurre').map((e) => e.label)).toEqual([
      '2 L de lait',
      'Lait 2 %',
      '500 g beurre',
    ])
  })

  it('ignore les vides et les doublons', () => {
    expect(parseQuickAdd(' , lait,, Lait ,  ')).toEqual([{ label: 'Lait', quantity: null }])
  })
})

describe('saisie en cours', () => {
  it('isole le dernier morceau et sait le retirer', () => {
    expect(currentFragment('œufs, fr')).toBe('fr')
    expect(dropFragment('œufs, fr')).toBe('œufs, ')
    expect(dropFragment('fr')).toBe('')
  })
})

describe('formatQuantity', () => {
  it('préfixe les nombres seuls', () => {
    expect(formatQuantity('3')).toBe('×3')
    expect(formatQuantity('2 L')).toBe('2 L')
    expect(formatQuantity('  ')).toBeNull()
  })
})
