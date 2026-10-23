import { describe, expect, it } from 'vitest'
import { uuidv7 } from './uuid'

describe('uuidv7', () => {
  it('produit un UUID version 7, variante RFC', () => {
    const id = uuidv7()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('porte l’heure et se trie dans l’ordre de création', () => {
    const t = Date.UTC(2026, 9, 23, 20, 0, 0)
    const a = uuidv7(t)
    const b = uuidv7(t + 1)
    expect(parseInt(a.replace(/-/g, '').slice(0, 12), 16)).toBe(t)
    expect(a < b).toBe(true)
  })
})
