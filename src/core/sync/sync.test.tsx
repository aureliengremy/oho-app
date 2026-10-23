import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, shoppingRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

let online = true
beforeEach(() => {
  localStorage.clear()
  online = true
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  // L'état réseau de react-query est global : un test fini hors ligne ne doit pas déborder.
  onlineManager.setOnline(true)
})
afterEach(() => vi.restoreAllMocks())

function goOffline() {
  online = false
  act(() => void window.dispatchEvent(new Event('offline')))
}
function goOnline() {
  online = true
  act(() => void window.dispatchEvent(new Event('online')))
}

const open = async () => {
  const client = fakeClient({ userId: 'user-a', rows: shoppingRows })
  renderApp(client, '/courses')
  await screen.findByRole('heading', { level: 1, name: 'Épicerie' })
  return client
}
const row = (client: ReturnType<typeof fakeClient>, label: string) =>
  client.rows.checklist_item.find((r) => r.label === label && r.deleted_at === null)
const cartButton = () => screen.getByRole('button', { name: /Dans le panier/ })

describe('temps réel', () => {
  it('montre « En direct » et affiche ce que l’autre téléphone coche', async () => {
    const client = await open()
    expect(await screen.findByText('En direct')).toBeInTheDocument()
    expect(cartButton()).toHaveTextContent('1')

    // Auriane coche Lait sur son téléphone : la base change, le canal prévient.
    Object.assign(row(client, 'Lait')!, { checked: true, checked_by: 'user-b', checked_at: new Date().toISOString() })
    act(() => client.realtime.emit('checklist_item'))
    await waitFor(() => expect(cartButton()).toHaveTextContent('2'))
    expect(screen.queryByRole('checkbox', { name: 'Lait', checked: false })).not.toBeInTheDocument()
  })

  it('se réabonne au retour au premier plan quand le canal est tombé', async () => {
    const client = await open()
    await screen.findByText('En direct')
    act(() => client.realtime.setStatus('CHANNEL_ERROR'))
    await waitFor(() => expect(screen.queryByText('En direct')).not.toBeInTheDocument())

    // Pendant la coupure, Auriane ajoute un article : aucun événement n'arrive.
    client.rows.checklist_item.push({ ...row(client, 'Piles AA')!, id: 'i-oignons', label: 'Oignons', sort_order: 9 })
    const before = client.channel.mock.calls.length
    client.realtime.status = 'SUBSCRIBED'
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(client.channel.mock.calls.length).toBe(before + 1))
    expect(await screen.findByText('En direct')).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: 'Oignons' })).toBeInTheDocument()
  })
})

describe('hors ligne', () => {
  it('garde les cases cochées et les ajouts en attente, puis les rejoue au retour du réseau', async () => {
    const client = await open()
    goOffline()
    expect(await screen.findByText('Hors ligne · dernier état connu')).toBeInTheDocument()
    expect(screen.queryByText('En direct')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Avocats' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Ajouter des articles/ }), 'kiwis{Enter}')
    expect(await screen.findByText('Hors ligne · 2 modifications en attente')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Sans rayon' })).getByText('En attente')).toBeInTheDocument()
    expect(cartButton()).toHaveTextContent('2')
    expect(row(client, 'Avocats')?.checked).toBe(false)
    expect(row(client, 'Kiwis')).toBeUndefined()
    expect(JSON.parse(localStorage.getItem('oho.outbox.hh-1')!)).toHaveLength(2)

    goOnline()
    await waitFor(() => expect(row(client, 'Avocats')?.checked).toBe(true))
    expect(row(client, 'Kiwis')).toMatchObject({ checklist_id: 'list-epicerie', checked: false })
    await waitFor(() => expect(screen.queryByText(/en attente/i)).not.toBeInTheDocument())
    expect(localStorage.getItem('oho.outbox.hh-1')).toBeNull()
    expect(cartButton()).toHaveTextContent('2')
  })

  it('refuse proprement une action qui ne peut pas attendre (vider les cochés)', async () => {
    const client = await open()
    goOffline()
    await userEvent.click(screen.getByRole('button', { name: 'Vider les cochés' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Hors ligne : cette action attendra le réseau.')
    expect(cartButton()).toHaveTextContent('1')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('met en attente une case cochée dont la requête se perd en route', async () => {
    const client = await open()
    client.dropNext.add('checklist_item')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pain au levain' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(cartButton()).toHaveTextContent('2')
    // Le rejeu part tout de suite (en ligne) et passe cette fois.
    await waitFor(() => expect(row(client, 'Pain au levain')?.checked).toBe(true))
    await waitFor(() => expect(localStorage.getItem('oho.outbox.hh-1')).toBeNull())
  })

  it('rejoue au démarrage ce qui attendait depuis la dernière fermeture', async () => {
    localStorage.setItem(
      'oho.outbox.hh-1',
      JSON.stringify([
        { id: 'op-1', kind: 'update', table: 'checklist_item', rowId: 'i-piles', patch: { checked: true }, queuedAt: '2026-10-23T09:00:00Z' },
      ]),
    )
    const client = await open()
    await waitFor(() => expect(row(client, 'Piles AA')?.checked).toBe(true))
    await waitFor(() => expect(localStorage.getItem('oho.outbox.hh-1')).toBeNull())
  })
})

describe('déconnexion', () => {
  it('efface le cache et les files de l’appareil', async () => {
    localStorage.setItem('oho.cache', '{}')
    localStorage.setItem('oho.outbox.hh-1', '[]')
    const client = fakeClient({ userId: 'user-a', rows: shoppingRows })
    renderApp(client, '/reglages')
    await userEvent.click(await screen.findByRole('button', { name: /Se déconnecter/ }))
    await screen.findByRole('button', { name: 'Se connecter' })
    expect(localStorage.getItem('oho.cache')).toBeNull()
    expect(localStorage.getItem('oho.outbox.hh-1')).toBeNull()
  })
})
