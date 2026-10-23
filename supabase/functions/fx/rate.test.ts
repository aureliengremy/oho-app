import { describe, expect, it } from 'vitest'
import { rateUrl, readRate } from './rate'

describe('fonction fx', () => {
  it('lit le taux de la BCE', () => {
    expect(rateUrl('EUR', 'CAD')).toBe('https://api.frankfurter.app/latest?from=EUR&to=CAD')
    expect(readRate({ amount: 1, base: 'EUR', date: '2026-11-09', rates: { CAD: 1.52 } }, 'CAD')).toEqual({ rate: 1.52, date: '2026-11-09' })
  })

  it('refuse une réponse incomplète', () => {
    expect(readRate({ rates: {} }, 'CAD')).toBeNull()
    expect(readRate({ date: '2026-11-09', rates: { CAD: -1 } }, 'CAD')).toBeNull()
    expect(readRate(null, 'CAD')).toBeNull()
  })
})
