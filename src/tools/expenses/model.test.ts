import { describe, expect, it } from 'vitest'
import { balances, byDay, computeShares, dayLabel, defaultBook, situation, splitByWeights, splitEqual, suggestTransfers, type ExpensesData } from './model'

describe('le partage au centime', () => {
  it('10,00 en trois : 3,34 + 3,33 + 3,33 (plus fort reste)', () => {
    expect(splitEqual(1000, ['a', 'b', 'c']).map((s) => s.cents)).toEqual([334, 333, 333])
  })

  it('les parts pondérées totalisent toujours le montant', () => {
    const split = splitByWeights(1459, [{ key: 'al', weight: 2 }, { key: 'an', weight: 1 }])
    expect(split).toEqual([{ key: 'al', cents: 973 }, { key: 'an', cents: 486 }])
    expect(split.reduce((s, x) => s + x.cents, 0)).toBe(1459)
  })
})

const data: ExpensesData = {
  books: [],
  trips: [],
  expenses: [
    { id: 'e1', book_id: 'b', paid_by: 'an', book_amount_cents: 170240, spent_on: '2026-10-15', created_at: '1' },
    { id: 'e2', book_id: 'b', paid_by: 'al', book_amount_cents: 148600, spent_on: '2026-09-20', created_at: '2' },
    { id: 'e3', book_id: 'b', paid_by: 'an', book_amount_cents: 1459, spent_on: '2026-11-09', created_at: '3' },
  ] as ExpensesData['expenses'],
  shares: [
    { expense_id: 'e1', user_id: 'al', share_cents: 85120 },
    { expense_id: 'e1', user_id: 'an', share_cents: 85120 },
    { expense_id: 'e2', user_id: 'al', share_cents: 74300 },
    { expense_id: 'e2', user_id: 'an', share_cents: 74300 },
    { expense_id: 'e3', user_id: 'al', share_cents: 729 },
    { expense_id: 'e3', user_id: 'an', share_cents: 730 },
  ] as ExpensesData['shares'],
  settlements: [{ book_id: 'b', from_user: 'al', to_user: 'an', amount_cents: 5000 }] as ExpensesData['settlements'],
}

describe('les soldes', () => {
  it('payé − dû + remboursé − reçu, comme la vue expense_balance', () => {
    const b = balances(data, 'b', ['al', 'an'])
    expect(b.get('an')).toBe(11549 - 5000)
    expect(b.get('al')).toBe(-11549 + 5000)
  })

  it('suggère un seul virement à deux', () => {
    expect(suggestTransfers(balances(data, 'b', ['al', 'an']))).toEqual([{ from: 'al', to: 'an', cents: 6549 }])
    expect(suggestTransfers(new Map([['a', 0], ['b', 0]]))).toEqual([])
  })

  it('à trois, au plus deux virements', () => {
    expect(suggestTransfers(new Map([['a', 300], ['b', -100], ['c', -200]]))).toEqual([
      { from: 'c', to: 'a', cents: 200 },
      { from: 'b', to: 'a', cents: 100 },
    ])
  })
})

describe('le carnet par jour', () => {
  it('du plus récent au plus ancien, avec les dépenses d’avant le départ à part', () => {
    expect(byDay(data.expenses).map((d) => [d.day, d.total])).toEqual([
      ['2026-11-09', 1459],
      ['2026-10-15', 170240],
      ['2026-09-20', 148600],
    ])
    expect(dayLabel('2026-11-09', '2026-11-06')).toBe('Lun. 9 nov.')
    expect(dayLabel('2026-10-15', '2026-11-06')).toBe('Avant le départ')
    expect(byDay(data.expenses, '2026-11-06').map((d) => [dayLabel(d.day, '2026-11-06'), d.total])).toEqual([
      ['Lun. 9 nov.', 1459],
      ['Avant le départ', 318840],
    ])
  })
})

describe('la saisie', () => {
  it('les parts suivent le mode et totalisent le montant converti', () => {
    expect(computeShares('equal', 9600, ['al', 'an'], [])).toEqual([
      { user_id: 'al', share_cents: 4800, weight: null },
      { user_id: 'an', share_cents: 4800, weight: null },
    ])
    // 70 € / 30 € saisis, convertis en 15 200 ¢ : au prorata, exacts au centime.
    expect(computeShares('amounts', 15200, ['al', 'an'], [{ user_id: 'al', value: 7000 }, { user_id: 'an', value: 3000 }]).map((s) => s.share_cents)).toEqual([10640, 4560])
    expect(computeShares('weights', 1459, ['al', 'an'], [{ user_id: 'al', value: 2 }, { user_id: 'an', value: 0 }])).toEqual([{ user_id: 'al', share_cents: 1459, weight: 2 }])
  })

  it('le solde vu par chacun', () => {
    const b = balances(data, 'b', ['al', 'an'])
    expect(situation(b, 'al')).toEqual({ kind: 'owe', transfer: { from: 'al', to: 'an', cents: 6549 } })
    expect(situation(b, 'an').kind).toBe('owed')
    expect(situation(new Map([['al', 0], ['an', 0]]), 'al')).toEqual({ kind: 'even' })
  })

  it('ouvre le carnet du voyage en cours, sinon le premier', () => {
    const books = [{ id: 'quotidien', trip_id: null }, { id: 'lisbonne', trip_id: 't' }] as ExpensesData['books']
    const trips = [{ id: 't', title: 'Lisbonne', start_date: '2026-11-06', end_date: '2026-11-16', cover_emoji: null }]
    expect(defaultBook({ ...data, books, trips }, '2026-11-09')?.id).toBe('lisbonne')
    expect(defaultBook({ ...data, books, trips }, '2026-10-23')?.id).toBe('quotidien')
  })
})
