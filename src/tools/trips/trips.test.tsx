import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, tripRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

beforeEach(() => {
  localStorage.clear()
  // Seule l'horloge est figée (22 octobre 2026) : les minuteries restent réelles pour userEvent.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T12:00:00'))
})
afterEach(() => vi.useRealTimers())

const open = async (path: string, heading: string) => {
  const client = fakeClient({ userId: 'user-a', rows: tripRows })
  const router = renderApp(client, path)
  await screen.findByRole('heading', { level: 1, name: heading })
  return { client, router }
}

const live = (client: ReturnType<typeof fakeClient>, table: string) => client.rows[table].filter((r) => r.deleted_at === null)

describe('la liste des voyages', () => {
  it('groupe par moment, écrit le statut et le compte à rebours', async () => {
    await open('/voyages', 'Voyages')
    const groups = (await screen.findAllByRole('region')).map((s) => s.getAttribute('aria-label'))
    expect(groups).toEqual(['Maintenant', 'À venir', 'Un jour', 'Souvenirs'])
    const upcoming = screen.getByRole('region', { name: 'À venir' })
    expect(within(upcoming).getByRole('link', { name: /Lisbonne & Porto/ })).toHaveTextContent(/6 – 16 nov\..*10 nuits.*Planifié.*J – 15/)
    expect(within(screen.getByRole('region', { name: 'Maintenant' })).getByText('jusqu’à samedi')).toBeInTheDocument()
  })

  it('filtre par statut', async () => {
    await open('/voyages', 'Voyages')
    await userEvent.click(await screen.findByRole('link', { name: /Idée\s*1/ }))
    expect(await screen.findByRole('link', { name: /Japon au printemps/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Lisbonne/ })).not.toBeInTheDocument()
  })

  it('crée un voyage avec des dates : il est planifié et s’ouvre', async () => {
    const { client } = await open('/voyages', 'Voyages')
    await userEvent.click(await screen.findByRole('button', { name: 'Voyage' }))
    const sheet = screen.getByRole('dialog', { name: 'Nouveau voyage' })
    await userEvent.type(within(sheet).getByLabelText('Titre'), 'Ski au Massif')
    await userEvent.type(within(sheet).getByLabelText('Départ'), '2027-02-13')
    await userEvent.type(within(sheet).getByLabelText('Retour'), '2027-02-15')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Créer le voyage' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ski au Massif' })).toBeInTheDocument()
    await waitFor(() => expect(live(client, 'trip').find((t) => t.title === 'Ski au Massif')).toMatchObject({ status: 'planned', start_date: '2027-02-13', household_id: 'hh-1' }))
  })

  it('refuse un retour avant le départ', async () => {
    await open('/voyages', 'Voyages')
    await userEvent.click(await screen.findByRole('button', { name: 'Voyage' }))
    const sheet = screen.getByRole('dialog', { name: 'Nouveau voyage' })
    await userEvent.type(within(sheet).getByLabelText('Titre'), 'À l’envers')
    await userEvent.type(within(sheet).getByLabelText('Départ'), '2027-02-13')
    await userEvent.type(within(sheet).getByLabelText('Retour'), '2027-02-10')
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Le retour doit suivre le départ.')
    expect(within(sheet).getByRole('button', { name: 'Créer le voyage' })).toBeDisabled()
  })
})

describe('la fiche voyage', () => {
  it('ouvre sur les idées et en ajoute une', async () => {
    const { client } = await open('/voyages/trip-lisbonne', 'Lisbonne & Porto')
    expect(screen.getByText(/ven\. 6 – lun\. 16 novembre 2026 · 10 nuits · Portugal/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Idées' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('checkbox', { name: 'Pastéis de Belém' })).not.toBeChecked()
    await userEvent.type(screen.getByRole('textbox', { name: 'Nouvelle idée' }), 'Tram 28{Enter}')
    expect(screen.getByRole('checkbox', { name: 'Tram 28' })).toBeInTheDocument()
    await waitFor(() => expect(live(client, 'trip_activity').find((r) => r.title === 'Tram 28')).toMatchObject({ trip_id: 'trip-lisbonne', sort_order: 3 }))

    await userEvent.click(screen.getByRole('checkbox', { name: 'Pastéis de Belém' }))
    await waitFor(() => expect(live(client, 'trip_activity').find((r) => r.id === 'idea-belem')?.done).toBe(true))
  })

  it('checklist de préparation : avancement, ajout groupé, cocher', async () => {
    const { client } = await open('/voyages/trip-lisbonne/checklist', 'Lisbonne & Porto')
    expect(screen.getByText('Prêt à 50 %')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Ajouter à la checklist' }), 'Assurance voyage, 2 imperméables{Enter}')
    expect(screen.getByText('Prêt à 25 %')).toBeInTheDocument()
    await waitFor(() =>
      expect(live(client, 'checklist_item').filter((r) => r.checklist_id === 'prep-lisbonne').map((r) => [r.label, r.quantity])).toEqual([
        ['Passeports valides', null],
        ['Adaptateur prise européenne', '2'],
        ['Assurance voyage', null],
        ['Imperméables', '2'],
      ]),
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'Assurance voyage' }))
    expect(screen.getByText('Prêt à 50 %')).toBeInTheDocument()
  })

  it('un voyage sans checklist propose d’en créer une, une seule', async () => {
    const { client } = await open('/voyages/trip-japon/checklist', 'Japon au printemps')
    await userEvent.click(screen.getByRole('button', { name: 'Créer la checklist' }))
    expect(await screen.findByRole('textbox', { name: 'Ajouter à la checklist' })).toBeInTheDocument()
    await waitFor(() => expect(live(client, 'checklist').filter((l) => l.trip_id === 'trip-japon')).toHaveLength(1))
    expect(live(client, 'checklist').find((l) => l.trip_id === 'trip-japon')).toMatchObject({ kind: 'trip_prep' })
  })

  it('réservations : heure du lieu, référence, pièce jointe signée 60 s', async () => {
    const { client } = await open('/voyages/trip-lisbonne/reservations', 'Lisbonne & Porto')
    const card = screen.getByRole('heading', { level: 3, name: 'Vol YUL → LIS' }).closest('li')!
    expect(card).toHaveTextContent(/ven\.\s6\snov\..*21\sh\s35/u)
    expect(within(card).getByText('QX7P2M')).toBeInTheDocument()
    expect(card).toHaveTextContent(/1\s486,00\s\$/u)

    const tab = { location: { href: '' }, close: vi.fn() }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    await userEvent.click(within(card).getByRole('button', { name: /^cartes-embarquement\.pdf/ }))
    await waitFor(() => expect(tab.location.href).toBe('https://storage.test/attachments/hh-1/booking/booking-vol/att-1?expires=60'))
    openSpy.mockRestore()

    const file = new File(['%PDF'], 'confirmation-alfama.pdf', { type: 'application/pdf' })
    const input = card.querySelector('input[type=file]') as HTMLInputElement
    await userEvent.upload(input, file)
    expect(await within(card).findByRole('button', { name: /^confirmation-alfama\.pdf/ })).toBeInTheDocument()
    const row = live(client, 'attachment').find((a) => a.file_name === 'confirmation-alfama.pdf')!
    expect(row.storage_path).toBe(`hh-1/booking/booking-vol/${row.id}`)
    expect(client.storage.files.has(row.storage_path as string)).toBe(true)
  })

  it('un envoi raté le dit et n’enregistre rien', async () => {
    const { client } = await open('/voyages/trip-lisbonne/reservations', 'Lisbonne & Porto')
    client.failNext.add('storage')
    const card = screen.getByRole('heading', { level: 3, name: 'Vol YUL → LIS' }).closest('li')!
    await userEvent.upload(card.querySelector('input[type=file]') as HTMLInputElement, new File(['x'], 'raté.pdf'))
    expect(await within(card).findByRole('alert')).toHaveTextContent('Le fichier n’a pas été envoyé.')
    expect(live(client, 'attachment')).toHaveLength(1)
  })

  it('ajoute une réservation saisie à l’heure de Lisbonne', async () => {
    const { client } = await open('/voyages/trip-lisbonne/reservations', 'Lisbonne & Porto')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une réservation' }))
    const sheet = screen.getByRole('dialog', { name: 'Nouvelle réservation' })
    await userEvent.selectOptions(within(sheet).getByLabelText('Type'), 'train')
    await userEvent.type(within(sheet).getByLabelText('Titre'), 'Train Lisbonne → Porto')
    await userEvent.type(within(sheet).getByLabelText('Début'), '2026-11-12T09:09')
    await userEvent.selectOptions(within(sheet).getByLabelText('Fuseau des heures'), 'Europe/Lisbon')
    await userEvent.type(within(sheet).getByLabelText('Montant'), '48,50')
    await userEvent.clear(within(sheet).getByLabelText('Devise'))
    await userEvent.type(within(sheet).getByLabelText('Devise'), 'eur')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ajouter la réservation' }))
    await waitFor(() =>
      expect(live(client, 'booking').find((b) => b.title === 'Train Lisbonne → Porto')).toMatchObject({
        kind: 'train',
        starts_at: '2026-11-12T09:09:00.000Z',
        tz: 'Europe/Lisbon',
        amount: 48.5,
        currency: 'EUR',
      }),
    )
  })

  it('budget : ajoute un poste et fait le total', async () => {
    const { client } = await open('/voyages/trip-lisbonne/budget', 'Lisbonne & Porto')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un poste' }))
    const sheet = screen.getByRole('dialog', { name: 'Nouveau poste' })
    await userEvent.selectOptions(within(sheet).getByLabelText('Poste'), 'lodging')
    await userEvent.type(within(sheet).getByLabelText('Montant prévu'), '1700')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('button', { name: 'Modifier Logement' })).toHaveTextContent(/1\s700,00\s\$/u)
    await waitFor(() => expect(live(client, 'trip_budget_line')).toMatchObject([{ category: 'lodging', planned_amount: 1700, currency: 'CAD' }]))
  })

  it('suggère « En cours » quand les dates sont commencées', async () => {
    const rows = structuredClone(tripRows)
    rows.trip[0].status = 'planned'
    const client = fakeClient({ userId: 'user-a', rows })
    renderApp(client, '/voyages/trip-sutton')
    await screen.findByRole('heading', { level: 1, name: /Chalet à Sutton/ })
    await userEvent.click(screen.getByRole('button', { name: 'Oui' }))
    await waitFor(() => expect(client.rows.trip[0].status).toBe('ongoing'))
  })

  it('supprimer demande confirmation puis revient à la liste', async () => {
    const { client } = await open('/voyages/trip-japon', 'Japon au printemps')
    await userEvent.click(screen.getByRole('button', { name: 'Modifier le voyage' }))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le voyage' }))
    await userEvent.click(screen.getByRole('button', { name: /Supprimer « Japon au printemps »/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Voyages' })).toBeInTheDocument()
    await waitFor(() => expect(client.rows.trip.find((t) => t.id === 'trip-japon')?.deleted_at).not.toBeNull())
  })
})

describe('l’accueil et les réglages', () => {
  it('l’accueil montre le voyage en cours et sa préparation', async () => {
    const rows = structuredClone(tripRows)
    rows.trip = rows.trip.filter((t) => t.id !== 'trip-sutton')
    const client = fakeClient({ userId: 'user-a', rows })
    renderApp(client, '/')
    const card = await screen.findByRole('region', { name: 'Prochain voyage' })
    expect(within(card).getByRole('link')).toHaveTextContent(/Lisbonne & Porto.*dans 15 jours.*1 \/ 2/)
  })

  it('masquer un outil le retire de l’accueil', async () => {
    const client = fakeClient({ userId: 'user-a', rows: tripRows })
    renderApp(client, '/reglages')
    const toggle = await screen.findByRole('switch', { name: /Voyages/ })
    expect(toggle).toBeChecked()
    await userEvent.click(toggle)
    await waitFor(() => expect(screen.getByRole('switch', { name: /Voyages/ })).not.toBeChecked())
    expect(client.rows.tool_activation.find((a) => a.tool_key === 'trips')?.enabled).toBe(false)
    await userEvent.click(screen.getByRole('switch', { name: /Dépenses/ }))
    await waitFor(() => expect(client.rows.tool_activation.find((a) => a.tool_key === 'expenses')).toMatchObject({ enabled: true, sort_order: 4 }))
  })
})
