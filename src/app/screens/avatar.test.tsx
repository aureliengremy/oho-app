import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeClient, seedRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

beforeEach(() => localStorage.clear())

describe('avatar personnalisé', () => {
  it('choisit un animal, l’affiche partout, puis revient aux initiales', async () => {
    const client = fakeClient({ userId: 'user-a', rows: seedRows })
    renderApp(client, '/reglages')
    const grid = await screen.findByRole('radiogroup', { name: 'Mon avatar' })
    expect(within(grid).getByRole('radio', { name: 'Initiales' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(within(grid).getByRole('radio', { name: 'Loutre' }))
    expect(await within(grid).findByRole('radio', { name: 'Loutre', checked: true })).toBeInTheDocument()
    expect(client.rows.profile.find((p) => p.id === 'user-a')?.avatar_emoji).toBe('🦦')
    expect(client.rows.profile.find((p) => p.id === 'user-b')?.avatar_emoji).toBeNull()
    // La liste des membres affiche l'emoji avec le prénom en nom accessible.
    const members = screen.getByText('Aurélien', { selector: 'span.flex-1' }).closest('li')!
    expect(within(members).getByRole('img', { name: 'Aurélien' })).toHaveTextContent('🦦')

    await userEvent.click(within(grid).getByRole('radio', { name: 'Initiales' }))
    expect(await within(grid).findByRole('radio', { name: 'Initiales', checked: true })).toBeInTheDocument()
    expect(client.rows.profile.find((p) => p.id === 'user-a')?.avatar_emoji).toBeNull()
    expect(within(members).getByText('AL')).toBeInTheDocument()
  })

  it('signale un échec sans changer l’avatar', async () => {
    const client = fakeClient({ userId: 'user-a', rows: seedRows })
    renderApp(client, '/reglages')
    const grid = await screen.findByRole('radiogroup', { name: 'Mon avatar' })
    client.failNext.add('profile')
    await userEvent.click(within(grid).getByRole('radio', { name: 'Renard' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('L’avatar n’a pas changé')
    expect(within(grid).getByRole('radio', { name: 'Initiales' })).toHaveAttribute('aria-checked', 'true')
  })
})
