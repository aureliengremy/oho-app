import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, seedRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'
import type { AgendaEvent } from './model'

beforeEach(() => {
  localStorage.clear()
  // Lundi 26 octobre 2026, midi à Toronto.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T16:00:00Z'))
})
afterEach(() => vi.useRealTimers())

const rows = {
  ...seedRows,
  tool_activation: [
    { household_id: 'hh-1', tool_key: 'shopping', enabled: true, sort_order: 1, deleted_at: null },
    { household_id: 'hh-1', tool_key: 'agenda', enabled: true, sort_order: 2, deleted_at: null },
    { household_id: 'hh-1', tool_key: 'watchlist', enabled: true, sort_order: 3, deleted_at: null },
    { household_id: 'hh-1', tool_key: 'expenses', enabled: true, sort_order: 4, deleted_at: null },
    { household_id: 'hh-1', tool_key: 'trips', enabled: true, sort_order: 5, deleted_at: null },
  ],
}

const events: AgendaEvent[] = [
  { id: 'souper', title: 'Souper chez Paul', allDay: false, start: '2026-10-27T22:30:00Z', end: '2026-10-28T00:00:00Z', location: '123 rue Saint-Denis, Montréal', description: 'Apporter le vin' },
  { id: 'halloween', title: 'Halloween', allDay: true, start: '2026-10-31', end: '2026-11-01', location: null, description: null },
  { id: 'dentiste', title: 'Dentiste', allDay: false, start: '2026-11-12T14:00:00Z', end: '2026-11-12T15:00:00Z', location: null, description: null },
]

const withAgenda = () => {
  const client = fakeClient({ userId: 'user-a', rows })
  client.functions.handlers.agenda = async () => ({ events, zone: 'America/Toronto', fetched_at: '2026-10-26T15:58:00Z' })
  return client
}

describe('agenda', () => {
  it('prend la place de Voyages dans la barre du bas', async () => {
    renderApp(withAgenda(), '/')
    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Accueil', 'Courses', 'Agenda', 'À regarder', 'Dépenses'])
    // Voyages reste dans la grille de l'accueil.
    expect(screen.getByRole('link', { name: 'Voyages' })).toHaveAttribute('href', '/voyages')
  })

  it('montre « Cette semaine » sur l’accueil', async () => {
    renderApp(withAgenda(), '/')
    const card = await screen.findByRole('region', { name: 'Cette semaine' })
    // Les outils restent en tête de l'accueil, la carte vient après.
    const tools = document.getElementById('outils')
    expect(tools?.compareDocumentPosition(card)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(card).getByText('Demain')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /18 h 30.*Souper chez Paul/ })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /Journée.*Halloween/ })).toBeInTheDocument()
    expect(within(card).queryByText('Dentiste')).not.toBeInTheDocument()
  })

  it('liste les jours à venir et ouvre la fiche d’un événement', async () => {
    const client = withAgenda()
    renderApp(client, '/agenda')
    await screen.findByRole('heading', { level: 1, name: 'Agenda' })
    const tomorrow = await screen.findByRole('region', { name: 'Demain' })
    await userEvent.click(within(tomorrow).getByRole('button', { name: /Souper chez Paul/ }))
    const sheet = screen.getByRole('dialog', { name: 'Souper chez Paul' })
    expect(sheet).toHaveTextContent('mardi 27 octobre · 18 h 30 – 20 h 00')
    expect(within(sheet).getByRole('link', { name: /Saint-Denis/ })).toHaveAttribute('href', expect.stringContaining('google.com/maps'))
    expect(client.functions.invoke).toHaveBeenCalledWith('agenda', { body: { from: '2026-10-26', to: '2026-12-25', fresh: false } })
  })

  it('affiche le mois, les jours chargés et les événements du jour choisi', async () => {
    const client = withAgenda()
    renderApp(client, '/agenda')
    await userEvent.click(await screen.findByRole('radio', { name: 'Mois' }))
    expect(await screen.findByRole('heading', { name: 'Octobre 2026' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /samedi 31 octobre, 1 événement/ }))
    expect(within(screen.getByRole('region', { name: 'Samedi 31 octobre' })).getByText('Halloween')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mois suivant' }))
    expect(await screen.findByRole('heading', { name: 'Novembre 2026' })).toBeInTheDocument()
    await waitFor(() => expect(client.functions.invoke).toHaveBeenLastCalledWith('agenda', { body: { from: '2026-10-26', to: '2026-12-07', fresh: false } }))
  })

  it('force une relecture du flux avec le bouton Actualiser', async () => {
    const client = withAgenda()
    renderApp(client, '/agenda')
    await screen.findByRole('region', { name: 'Demain' })
    await userEvent.click(screen.getByRole('button', { name: 'Actualiser l’agenda' }))
    await waitFor(() => expect(client.functions.invoke).toHaveBeenLastCalledWith('agenda', { body: expect.objectContaining({ fresh: true }) }))
  })

  it('explique quand l’agenda n’est pas encore relié', async () => {
    renderApp(fakeClient({ userId: 'user-a', rows }), '/agenda')
    expect(await screen.findByText(/pas encore relié/)).toBeInTheDocument()
  })

  it('dit quand Google refuse l’adresse (adresse publique d’un agenda privé)', async () => {
    const client = fakeClient({ userId: 'user-a', rows })
    client.functions.invoke.mockImplementation(async () => ({
      data: null,
      error: { message: 'échec', context: { status: 502, json: async () => ({ error: 'agenda_refuse' }) } },
    }))
    renderApp(client, '/agenda')
    expect(await screen.findByText(/adresse secrète au format iCal/)).toBeInTheDocument()
  })
})
