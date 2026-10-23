import { describe, expect, it } from 'vitest'
import { initials } from './initials'

describe('initials', () => {
  it('prend les initiales choisies dans le profil', () => {
    expect(initials('Aurélien', 'AL')).toBe('AL')
    expect(initials('Auriane', 'an')).toBe('AN')
  })

  it('prend sinon les deux premières lettres du prénom', () => {
    expect(initials('Élodie')).toBe('ÉL')
    expect(initials('  ')).toBe('?')
  })
})
