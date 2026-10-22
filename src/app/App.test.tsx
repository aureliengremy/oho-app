import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it("affiche la marque et l'état du socle", () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('OhO')
    expect(screen.getByRole('list', { name: 'État du socle' })).toBeInTheDocument()
    expect(screen.getByText('Outils enregistrés')).toBeInTheDocument()
  })
})
