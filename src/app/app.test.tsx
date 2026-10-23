import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeClient, seedRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('parcours de connexion', () => {
  it('renvoie vers la connexion sans session', async () => {
    const router = renderApp(fakeClient(), '/')
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/connexion')
  })

  it('affiche une erreur lisible si le mot de passe est faux', async () => {
    renderApp(fakeClient({ rows: seedRows }), '/connexion')
    await userEvent.type(await screen.findByLabelText('Courriel'), 'aurelien@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Courriel ou mot de passe incorrect.')
  })

  it('ouvre l’accueil après connexion', async () => {
    const router = renderApp(fakeClient({ rows: seedRows }), '/connexion')
    await userEvent.type(await screen.findByLabelText('Courriel'), 'aurelien@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'bon-mot-de-passe')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Aurélien/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('reprend la session existante sans redemander la connexion', async () => {
    renderApp(fakeClient({ userId: 'user-a', rows: seedRows }), '/')
    expect(await screen.findByRole('heading', { level: 1, name: /Aurélien/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument()
  })

  it('envoie un lien magique sans créer de compte', async () => {
    const client = fakeClient()
    renderApp(client, '/connexion')
    await userEvent.type(await screen.findByLabelText('Courriel'), 'auriane@example.com')
    await userEvent.click(screen.getByRole('button', { name: /Recevoir un lien/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Lien envoyé à auriane@example.com')
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'auriane@example.com', options: expect.objectContaining({ shouldCreateUser: false }) }),
    )
  })
})

describe('accueil', () => {
  it('montre les outils activés, la barre d’onglets et l’activité', async () => {
    renderApp(fakeClient({ userId: 'user-a', rows: seedRows }), '/')
    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' })
    expect(within(nav).getByRole('link', { name: /Accueil/ })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Courses/ })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: /Voyages/ })).not.toBeInTheDocument()
    expect(await screen.findByText(/a coché Lait 2 %/)).toBeInTheDocument()
    expect(screen.getAllByText('AN').length).toBeGreaterThan(0)
  })

  it('ouvre l’écran d’un outil activé depuis sa tuile', async () => {
    renderApp(fakeClient({ userId: 'user-a', rows: seedRows }), '/')
    await screen.findByRole('heading', { level: 1, name: /Aurélien/ })
    const tiles = screen.getAllByRole('link', { name: 'Courses' })
    await userEvent.click(tiles[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument()
  })
})

describe('réglages', () => {
  it('change le thème et déconnecte', async () => {
    const client = fakeClient({ userId: 'user-a', rows: seedRows })
    const router = renderApp(client, '/reglages')
    await userEvent.click(await screen.findByRole('radio', { name: 'Sombre' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await userEvent.click(screen.getByRole('radio', { name: 'Système' }))
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    await userEvent.click(screen.getByRole('button', { name: /Se déconnecter/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
  })
})
