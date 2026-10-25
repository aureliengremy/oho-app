import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeClient, seedRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

beforeEach(() => localStorage.clear())

describe('changement de mot de passe', () => {
  it('envoie depuis les réglages un lien qui mène à l’écran de saisie', async () => {
    const client = fakeClient({ userId: 'user-a', rows: seedRows })
    renderApp(client, '/reglages')
    const section = await screen.findByRole('region', { name: 'Mot de passe' })
    await userEvent.click(screen.getByRole('button', { name: /Recevoir le lien par courriel/ }))
    expect(section).toHaveTextContent('Lien envoyé à user-a@example.com')
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('user-a@example.com', {
      redirectTo: `${window.location.origin}/mot-de-passe`,
    })
    expect(screen.getByRole('button', { name: /Renvoyer le lien/ })).toBeInTheDocument()
  })

  it('ouvre l’écran de saisie à l’ouverture du lien, même arrivé sur l’accueil', async () => {
    const client = fakeClient({ rows: seedRows })
    const router = renderApp(client, '/connexion')
    await screen.findByRole('button', { name: 'Se connecter' })
    act(() => client.auth.openRecoveryLink('user-a'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Nouveau mot de passe' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/mot-de-passe')
  })

  it('refuse un mot de passe trop court ou mal confirmé, puis enregistre', async () => {
    const client = fakeClient({ userId: 'user-a', rows: seedRows })
    const router = renderApp(client, '/mot-de-passe')
    const field = await screen.findByLabelText('Nouveau mot de passe')
    const save = screen.getByRole('button', { name: 'Enregistrer le mot de passe' })

    await userEvent.type(field, 'court')
    await userEvent.click(save)
    expect(screen.getByRole('alert')).toHaveTextContent('au moins 10 caractères')

    await userEvent.type(field, '-mais-plus-long')
    await userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'autre-chose-encore')
    await userEvent.click(save)
    expect(screen.getByRole('alert')).toHaveTextContent('ne sont pas identiques')
    expect(client.auth.updateUser).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Confirmer le mot de passe'))
    await userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'court-mais-plus-long')
    await userEvent.click(save)
    expect(await screen.findByRole('status')).toHaveTextContent('Mot de passe changé')
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'court-mais-plus-long' })

    await userEvent.click(screen.getByRole('button', { name: 'Revenir à l’accueil' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('traduit le refus de Supabase quand le mot de passe ne change pas', async () => {
    renderApp(fakeClient({ userId: 'user-a', rows: seedRows }), '/mot-de-passe')
    await userEvent.type(await screen.findByLabelText('Nouveau mot de passe'), 'ancien-mot-de-passe')
    await userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'ancien-mot-de-passe')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('différent de l’ancien')
  })
})
