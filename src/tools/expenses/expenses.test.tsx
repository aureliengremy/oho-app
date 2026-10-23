import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { expenseRows, fakeClient } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

beforeEach(() => localStorage.clear())

const open = async (path: string, heading: string, userId = 'user-a') => {
  const client = fakeClient({ userId, rows: expenseRows })
  const router = renderApp(client, path)
  await screen.findByRole('heading', { level: 1, name: heading })
  await waitFor(() => expect(screen.queryByText(/^CHARGEMENT/)).toBeNull())
  return { client, router }
}

const live = (client: ReturnType<typeof fakeClient>, table: string) => client.rows[table].filter((r) => r.deleted_at === null)
// fr-CA sépare les milliers et le symbole par des espaces insécables : on compare sans eux.
const flat = (text: string | null) => (text ?? '').replace(/[\s  ]+/g, ' ')

describe('le carnet', () => {
  it('ouvre le premier carnet : solde en une phrase, total et ta part, dépenses par jour', async () => {
    const { router } = await open('/depenses', 'Dépenses')
    await waitFor(() => expect(router.state.location.pathname).toBe('/depenses/book-lisbonne'))
    const balance = await screen.findByRole('link', { name: /Voir qui doit quoi/ })
    expect(flat(balance.getAttribute('aria-label'))).toBe('Tu dois 115,50 $ à Auriane. Voir qui doit quoi')
    expect(flat(balance.textContent)).toContain('Total 3 202,99 $ · ta part 1 601,50 $')
    expect(within(balance).getByText('À rembourser')).toBeInTheDocument()
    const before = screen.getByRole('region', { name: 'Avant le départ' })
    expect(within(before).getAllByRole('link')).toHaveLength(2)
    const pasteis = screen.getByRole('link', { name: /Pastéis de Belém/ })
    expect(flat(pasteis.getAttribute('aria-label'))).toBe('Pastéis de Belém, 9,60 € (14,59 $), payé par Auriane')
  })

  it('le carnet Quotidien tient compte du remboursement', async () => {
    await open('/depenses/book-quotidien', 'Dépenses')
    const balance = await screen.findByRole('link', { name: /Voir qui doit quoi/ })
    expect(flat(balance.getAttribute('aria-label'))).toBe('Auriane te doit 21,05 $. Voir qui doit quoi')
    expect(within(balance).getByText('À recevoir')).toBeInTheDocument()
  })

  it('crée un carnet depuis la pastille « + »', async () => {
    const { client, router } = await open('/depenses/book-lisbonne', 'Dépenses')
    await userEvent.click(await screen.findByRole('button', { name: 'Nouveau carnet' }))
    const sheet = screen.getByRole('dialog', { name: 'Nouveau carnet' })
    await userEvent.type(within(sheet).getByLabelText('Nom'), 'Chalet')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Créer le carnet' }))
    await waitFor(() => expect(live(client, 'expense_book').map((b) => b.name)).toContain('Chalet'))
    const id = live(client, 'expense_book').find((b) => b.name === 'Chalet')!.id
    await waitFor(() => expect(router.state.location.pathname).toBe(`/depenses/${id}`))
    expect(await screen.findByText('Aucune dépense pour l’instant')).toBeInTheDocument()
  })
})

describe('saisir une dépense', () => {
  it('en euros : le taux du jour est proposé, la dépense et ses parts partent d’un bloc', async () => {
    const { client } = await open('/depenses/book-lisbonne/depense/nouvelle', 'Nouvelle dépense')
    client.functions.handlers.fx = async (body) => {
      expect(body).toEqual({ from: 'EUR', to: 'CAD' })
      return { rate: 1.5, date: '2026-11-09' }
    }
    await userEvent.type(screen.getByLabelText('Montant'), '64')
    await userEvent.selectOptions(screen.getByLabelText('Devise'), 'EUR')
    expect(await screen.findByText(/taux du 9 nov\./)).toBeInTheDocument()
    expect(flat(screen.getByText(/≈/).textContent)).toContain('≈ 96,00 $')
    await userEvent.type(screen.getByLabelText('Quoi'), 'Dîner au Time Out')
    await userEvent.click(screen.getByRole('radio', { name: 'Auriane' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Restos' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByRole('link', { name: /Dîner au Time Out/ })
    expect(client.rpc).toHaveBeenCalledWith('save_expense', expect.anything())
    const saved = live(client, 'expense').find((e) => e.label === 'Dîner au Time Out')!
    expect(saved).toMatchObject({ amount_cents: 6400, currency: 'EUR', fx_rate: 1.5, book_amount_cents: 9600, paid_by: 'user-b', category: 'food', split_mode: 'equal' })
    expect(live(client, 'expense_share').filter((s) => s.expense_id === saved.id).map((s) => s.share_cents)).toEqual([4800, 4800])
  })

  it('sans taux du jour, le dit et laisse saisir le taux', async () => {
    const { client } = await open('/depenses/book-lisbonne/depense/nouvelle', 'Nouvelle dépense')
    await userEvent.type(screen.getByLabelText('Montant'), '12')
    await userEvent.selectOptions(screen.getByLabelText('Devise'), 'EUR')
    expect(await screen.findByText('Taux du jour indisponible : saisis-le.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Quoi'), 'Tram 28')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Taux : 1 EUR/), '1,52')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(live(client, 'expense').find((e) => e.label === 'Tram 28')?.book_amount_cents).toBe(1824))
  })

  it('« Montants » : il faut tout répartir avant d’enregistrer', async () => {
    const { client } = await open('/depenses/book-quotidien/depense/nouvelle', 'Nouvelle dépense')
    await userEvent.type(screen.getByLabelText('Montant'), '100')
    await userEvent.type(screen.getByLabelText('Quoi'), 'Pharmacie')
    await userEvent.click(screen.getByRole('radio', { name: 'Montants' }))
    await userEvent.type(screen.getByLabelText('Aurélien (CAD)'), '70')
    expect(flat(screen.getByRole('alert').textContent)).toBe('Reste à répartir : 30,00 $')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Auriane (CAD)'), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(live(client, 'expense').some((e) => e.label === 'Pharmacie')).toBe(true))
    const saved = live(client, 'expense').find((e) => e.label === 'Pharmacie')!
    expect(saved.split_mode).toBe('amounts')
    expect(live(client, 'expense_share').filter((s) => s.expense_id === saved.id).map((s) => [s.user_id, s.share_cents])).toEqual([
      ['user-a', 7000],
      ['user-b', 3000],
    ])
  })

  it('modifier garde le taux figé, remplace les parts, puis supprimer', async () => {
    const { client, router } = await open('/depenses/book-lisbonne/depense/exp-pasteis', 'Modifier la dépense')
    expect(screen.getByLabelText('Montant')).toHaveValue('9,60')
    expect(screen.getByLabelText(/Taux : 1 EUR/)).toHaveValue('1,52')
    await userEvent.click(screen.getByRole('radio', { name: 'Parts' }))
    await userEvent.type(screen.getByLabelText('Parts Aurélien'), '2')
    await userEvent.type(screen.getByLabelText('Parts Auriane'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/depenses/book-lisbonne'))
    await waitFor(() =>
      expect(live(client, 'expense_share').filter((s) => s.expense_id === 'exp-pasteis').map((s) => [s.user_id, s.share_cents, s.weight])).toEqual([
        ['user-a', 973, 2],
        ['user-b', 486, 1],
      ]),
    )
    expect(client.functions.invoke).not.toHaveBeenCalled()

    await userEvent.click(await screen.findByRole('link', { name: /Pastéis de Belém/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la dépense' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
    await waitFor(() => expect(client.rows.expense.find((e) => e.id === 'exp-pasteis')?.deleted_at).not.toBeNull())
  })

  it('un échec du serveur rend l’état d’avant et le dit', async () => {
    const { client } = await open('/depenses/book-quotidien/depense/nouvelle', 'Nouvelle dépense')
    client.failNext.add('save_expense')
    await userEvent.type(screen.getByLabelText('Montant'), '20')
    await userEvent.type(screen.getByLabelText('Quoi'), 'Boulangerie')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('« Boulangerie » n’a pas été enregistrée. Réessaie.')
    expect(screen.queryByRole('link', { name: /Boulangerie/ })).not.toBeInTheDocument()
  })
})

describe('qui doit quoi', () => {
  it('suggère le virement, le marque remboursé, et l’historique le garde', async () => {
    const { client } = await open('/depenses/book-lisbonne/soldes', 'Qui doit quoi')
    const balances = screen.getByRole('region', { name: 'Soldes' })
    expect(within(balances).getByText('Doit', { ignore: '[aria-hidden="true"] *' })).toBeInTheDocument()
    expect(within(balances).getByText('À recevoir', { ignore: '[aria-hidden="true"] *' })).toBeInTheDocument()
    const suggested = screen.getByRole('region', { name: 'Remboursement suggéré' })
    expect(flat(suggested.textContent)).toContain('115,50 $')
    await userEvent.click(within(suggested).getByRole('button', { name: 'Marquer comme remboursé' }))
    expect(await screen.findByText('Vous êtes quittes sur ce carnet.')).toBeInTheDocument()
    await waitFor(() =>
      expect(live(client, 'settlement').find((s) => s.book_id === 'book-lisbonne')).toMatchObject({ from_user: 'user-a', to_user: 'user-b', amount_cents: 11550 }),
    )
    expect(screen.getAllByText('Réglé')).toHaveLength(2)
  })

  it('les statistiques : total, par catégorie et qui a payé', async () => {
    await open('/depenses/book-lisbonne/stats', 'Statistiques')
    expect(flat(screen.getByText('Total').previousSibling?.textContent ?? screen.getByText('Total').parentElement!.textContent)).toContain('3 202,99 $')
    const bars = screen.getByRole('region', { name: 'Par catégorie, en CAD' })
    expect(within(bars).getAllByRole('listitem').map((li) => li.firstChild?.textContent)).toEqual(['Logement', 'Transport', 'Restos'])
    expect(flat(screen.getByRole('region', { name: 'Qui a payé, en CAD' }).textContent)).toContain('Auriane · 1 716,99 $')
  })
})

describe('avec Voyages', () => {
  it('un voyage sans carnet propose d’en ouvrir un, lié au voyage', async () => {
    const { client, router } = await open('/depenses/voyage/trip-japon', 'Japon au printemps')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un carnet pour ce voyage' }))
    await waitFor(() => expect(live(client, 'expense_book').find((b) => b.trip_id === 'trip-japon')?.name).toBe('Japon au printemps'))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/depenses\/(?!voyage)/))
  })

  it('« Créer la dépense » d’une réservation pré-remplit la saisie et la relie', async () => {
    const { client, router } = await open('/voyages/trip-lisbonne/reservations', 'Lisbonne & Porto')
    await userEvent.click(await screen.findByRole('link', { name: 'Créer la dépense de Vol YUL → LIS' }))
    expect(await screen.findByLabelText('Montant')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?reservation=booking-vol')
    expect(screen.getByLabelText('Montant')).toHaveValue('1486,00')
    expect(screen.getByLabelText('Quoi')).toHaveValue('Vol YUL → LIS')
    expect(screen.getByRole('radio', { name: 'Transport' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(live(client, 'expense').find((e) => e.booking_id === 'booking-vol')?.amount_cents).toBe(148600))
  })

  it('l’onglet Budget montre le dépensé du carnet lié', async () => {
    await open('/voyages/trip-lisbonne/budget', 'Lisbonne & Porto')
    const link = await screen.findByRole('link', { name: /Carnet lié/ })
    expect(flat(link.textContent)).toContain('3 202,99 $')
    expect(link).toHaveAttribute('href', '/depenses/voyage/trip-lisbonne')
  })
})
