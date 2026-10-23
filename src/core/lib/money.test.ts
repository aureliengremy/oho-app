import { describe, expect, it } from 'vitest'
import { centsToInput, convertCents, formatCents, parseCents } from './money'

describe('argent', () => {
  it('lit un montant saisi à la française', () => {
    expect(parseCents('64')).toBe(6400)
    expect(parseCents('64,5')).toBe(6450)
    expect(parseCents('1 486,00')).toBe(148600)
    expect(parseCents('9.60')).toBe(960)
    expect(parseCents('-3')).toBeNull()
    expect(parseCents('1,234')).toBeNull()
    expect(parseCents('')).toBeNull()
    expect(centsToInput(6400)).toBe('64,00')
  })

  it('convertit au centime près, comme la base', () => {
    expect(convertCents(112000, 1.52)).toBe(170240)
    expect(convertCents(960, 1.52)).toBe(1459)
    // 1000 × 1,505 vaut 1504,999… en flottant, mais 1505 exactement en numeric.
    expect(convertCents(1000, 1.505)).toBe(1505)
    expect(convertCents(1, '0.5')).toBe(1)
  })

  it('écrit les montants en $ CA et en euros', () => {
    expect(formatCents(148600, 'CAD')).toMatch(/^1\s486,00\s\$$/u)
    expect(formatCents(6400, 'EUR')).toMatch(/^64,00\s€$/u)
  })
})
