import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useBackDismiss } from './useBackDismiss'

function Sheet() {
  const [open, setOpen] = useState(true)
  useBackDismiss(open, () => setOpen(false))
  return <p>{open ? 'ouverte' : 'fermée'}</p>
}

describe('useBackDismiss', () => {
  it('ferme la feuille au lieu de quitter l’écran quand on fait Retour', async () => {
    const before = window.history.length
    const { getByText } = render(<Sheet />)
    expect(window.history.length).toBe(before + 1)
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(getByText('fermée')).toBeInTheDocument()
  })
})
