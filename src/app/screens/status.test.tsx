import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, tripRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

const open = async () => {
  const client = fakeClient({ userId: 'user-a', rows: { ...tripRows, client_error: [] } })
  const router = renderApp(client, '/etat')
  await screen.findByRole('heading', { level: 1, name: 'État du système' })
  return { client, router }
}

const file = (content: unknown) => new File([typeof content === 'string' ? content : JSON.stringify(content)], 'oho-export.json', { type: 'application/json' })

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:oho')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.restoreAllMocks())

describe('état du système', () => {
  it('montre réseau, serveur, temps réel, file d’attente et version', async () => {
    await open()
    const list = screen.getByRole('region', { name: 'État' })
    expect(await within(list).findByText('Joignable')).toBeInTheDocument()
    expect(within(list).getByText('En ligne')).toBeInTheDocument()
    expect(within(list).getByText('Aucune')).toBeInTheDocument()
    expect(within(list).getByText(__APP_RELEASE__)).toBeInTheDocument()
    expect(screen.getByText('Aucune erreur signalée depuis 30 jours.')).toBeInTheDocument()
  })

  it('exporte l’espace en un fichier JSON', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { client } = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Exporter l’espace' }))
    expect(await screen.findByText(/Export téléchargé/)).toBeInTheDocument()
    expect(client.rpc).toHaveBeenCalledWith('export_household', { p_household: 'hh-1' })
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toMatch(/^oho-export-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('export → suppression → restauration remet le voyage', async () => {
    const { client } = await open()
    const { data: dump } = await client.rpc('export_household', { p_household: 'hh-1' })
    client.rows.trip.find((t) => t.id === 'trip-lisbonne')!.deleted_at = '2026-10-23T00:00:00Z'

    await userEvent.upload(screen.getByLabelText('Fichier de sauvegarde'), file(dump))
    const confirm = await screen.findByRole('dialog', { name: 'Restaurer cette sauvegarde ?' })
    expect(within(confirm).getByText(/Restaurer la sauvegarde du 20 octobre 2026/)).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Restaurer' }))
    expect(await screen.findByText(/Restauré : \d+ lignes remises/)).toBeInTheDocument()
    expect(client.rows.trip.find((t) => t.id === 'trip-lisbonne')!.deleted_at).toBeNull()
  })

  it('refuse un fichier qui n’est pas un export de cet espace', async () => {
    const { client } = await open()
    await userEvent.upload(screen.getByLabelText('Fichier de sauvegarde'), file({ format: 'oho-export', version: 1, household_id: 'autre', tables: {} }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cet export vient d’un autre espace')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(client.rpc).not.toHaveBeenCalledWith('import_household', expect.anything())
  })

  it('liste les sauvegardes du dimanche', async () => {
    const client = fakeClient({ userId: 'user-a', rows: { ...tripRows, client_error: [] } })
    await client.storage.from('backups').upload('hh-1/2026-10-18.json', new File(['{}'], 'a.json'))
    await client.storage.from('backups').upload('hh-1/2026-10-11.json', new File(['{}'], 'b.json'))
    renderApp(client, '/etat')
    const list = await screen.findByRole('list', { name: 'Sauvegardes automatiques' })
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['dim. 18 octobreTélécharger', 'dim. 11 octobreTélécharger'])
  })
})

describe('journal d’erreurs', () => {
  it('une erreur non rattrapée part une seule fois au journal', async () => {
    const { client } = await open()
    const boom = new TypeError('x is undefined')
    fireEvent(window, new ErrorEvent('error', { error: boom, message: boom.message }))
    fireEvent(window, new ErrorEvent('error', { error: boom, message: boom.message }))
    await waitFor(() => expect(client.rows.client_error).toHaveLength(1))
    expect(client.rows.client_error[0]).toMatchObject({ household_id: 'hh-1', message: 'TypeError: x is undefined', release: __APP_RELEASE__ })
    // Le routeur de test est en mémoire : le chemin noté est celui de la fenêtre.
    expect(client.rows.client_error[0].path).toBe(window.location.pathname)
  })
})
