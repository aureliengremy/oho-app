import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeClient, seedRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'
import { describeActivity } from './ActivityFeed'

describe('describeActivity', () => {
  it('raconte un panier vidé avec l’élision', () => {
    expect(describeActivity({ action: 'cleared', entity_label: 'Épicerie' })).toBe('a vidé le panier d’Épicerie')
    expect(describeActivity({ action: 'cleared', entity_label: 'Costco' })).toBe('a vidé le panier de Costco')
    expect(describeActivity({ action: 'checked', entity_label: 'Lait' })).toBe('a coché Lait')
  })
})

describe('écran Activité', () => {
  it('filtre le journal par outil', async () => {
    const now = new Date().toISOString()
    const rows = {
      ...seedRows,
      tool_activation: [
        { household_id: 'hh-1', tool_key: 'shopping', enabled: true, sort_order: 1, deleted_at: null },
        { household_id: 'hh-1', tool_key: 'trips', enabled: true, sort_order: 2, deleted_at: null },
      ],
      activity_log: [
        { id: 'l1', household_id: 'hh-1', actor_id: 'user-b', tool_key: 'shopping', action: 'cleared', entity_label: 'Épicerie', created_at: now },
        { id: 'l2', household_id: 'hh-1', actor_id: 'user-a', tool_key: 'trips', action: 'created', entity_label: 'Lisbonne', created_at: now },
      ],
    }
    renderApp(fakeClient({ userId: 'user-a', rows }), '/activite')
    expect(await screen.findByText(/a ajouté Lisbonne/)).toBeInTheDocument()
    const filters = screen.getByRole('group', { name: 'Filtrer par outil' })
    expect(within(filters).getByRole('button', { name: 'Tout' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(filters).getByRole('button', { name: 'Courses' }))
    expect(await screen.findByText(/a vidé le panier d’Épicerie/)).toBeInTheDocument()
    expect(screen.queryByText(/Lisbonne/)).not.toBeInTheDocument()
  })
})
