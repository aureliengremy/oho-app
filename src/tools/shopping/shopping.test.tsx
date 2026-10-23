import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeClient, shoppingRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

beforeEach(() => localStorage.clear())

const open = async (path = '/courses', heading = 'Épicerie') => {
  const client = fakeClient({ userId: 'user-a', rows: shoppingRows })
  const router = renderApp(client, path)
  await screen.findByRole('heading', { level: 1, name: heading })
  return { client, router }
}

const item = (client: ReturnType<typeof fakeClient>, label: string) =>
  client.rows.checklist_item.find((r) => r.label === label && r.deleted_at === null)

const quickAdd = () => screen.getByRole('textbox', { name: /Ajouter des articles/ })

describe('la liste', () => {
  it('ouvre la liste par défaut, rangée par rayon, sans les listes de voyage', async () => {
    await open()
    const sections = screen.getAllByRole('region').map((s) => s.getAttribute('aria-label'))
    expect(sections).toEqual(['Fruits et légumes', 'Produits laitiers', 'Boulangerie', 'Sans rayon'])
    const fruits = screen.getByRole('region', { name: 'Fruits et légumes' })
    expect(within(fruits).getByRole('checkbox', { name: 'Avocats' })).not.toBeChecked()
    expect(within(fruits).getByText('×3')).toBeInTheDocument()
    expect(within(fruits).getByText('bien mûrs')).toBeInTheDocument()
    expect(within(fruits).getByText('AN')).toBeInTheDocument()

    const lists = screen.getByRole('navigation', { name: 'Listes de courses' })
    expect(within(lists).getByRole('link', { name: /Épicerie\s*4/ })).toHaveAttribute('aria-current', 'page')
    expect(within(lists).getByRole('link', { name: /Pharmacie\s*1/ })).toBeInTheDocument()
    expect(within(lists).queryByRole('link', { name: /Valise/ })).not.toBeInTheDocument()
  })

  it('passe d’une liste à l’autre et s’en souvient', async () => {
    await open()
    await userEvent.click(screen.getByRole('link', { name: /Pharmacie/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pharmacie' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Crème solaire' })).toBeInTheDocument()
    expect(localStorage.getItem('oho.courses.liste')).toBe('list-pharmacie')
  })
})

describe('cocher et le panier', () => {
  it('cocher envoie l’article dans le panier, puis vider les cochés le range', async () => {
    const { client } = await open()
    expect(screen.getByRole('button', { name: /Dans le panier/ })).toHaveTextContent('1')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Lait' }))
    expect(screen.queryByRole('region', { name: 'Produits laitiers' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dans le panier/ })).toHaveTextContent('2')
    await waitFor(() => expect(item(client, 'Lait')?.checked).toBe(true))

    await userEvent.click(screen.getByRole('button', { name: /Dans le panier/ }))
    const cart = screen.getByRole('list', { name: 'Dans le panier' })
    expect(within(cart).getByRole('checkbox', { name: 'Lait' })).toBeChecked()
    expect(within(cart).getByRole('checkbox', { name: 'Café' })).toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: 'Vider les cochés' }))
    expect(screen.queryByRole('button', { name: /Dans le panier/ })).not.toBeInTheDocument()
    expect(client.rpc).toHaveBeenCalledWith('clear_checked', { p_checklist_id: 'list-epicerie' })
    await waitFor(() => expect(item(client, 'Café')).toBeUndefined())
  })

  it('décocher depuis le panier remet l’article dans son rayon', async () => {
    const { client } = await open()
    await userEvent.click(screen.getByRole('button', { name: /Dans le panier/ }))
    await userEvent.click(within(screen.getByRole('list', { name: 'Dans le panier' })).getByRole('checkbox', { name: 'Café' }))
    expect(within(screen.getByRole('region', { name: 'Sans rayon' })).getByRole('checkbox', { name: 'Café' })).not.toBeChecked()
    await waitFor(() => expect(item(client, 'Café')?.checked).toBe(false))
  })

  it('revient en arrière et l’annonce si l’écriture échoue', async () => {
    const { client } = await open()
    client.failNext.add('checklist_item')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Avocats' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('« Avocats » n’a pas été coché. Réessaie.')
    expect(screen.getByRole('checkbox', { name: 'Avocats' })).not.toBeChecked()
  })
})

describe('ajout rapide', () => {
  it('ajoute plusieurs articles d’un coup, avec le rayon appris du catalogue', async () => {
    const { client } = await open()
    await userEvent.type(quickAdd(), 'fromage cheddar, 2 citrons, lait{Enter}')

    const laitiers = screen.getByRole('region', { name: 'Produits laitiers' })
    expect(within(laitiers).getByRole('checkbox', { name: 'Fromage cheddar' })).toBeInTheDocument()
    const loose = screen.getByRole('region', { name: 'Sans rayon' })
    expect(within(loose).getByRole('checkbox', { name: 'Citrons' })).toBeInTheDocument()
    expect(within(loose).getByText('×2')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('2 articles ajoutés · Lait déjà dans la liste')
    expect(quickAdd()).toHaveValue('')

    await waitFor(() => expect(item(client, 'Citrons')).toMatchObject({ quantity: '2', checklist_id: 'list-epicerie' }))
    const id = item(client, 'Citrons')!.id as string
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(id[14]).toBe('7')
  })

  it('ressort du panier un article déjà coché au lieu de le doubler', async () => {
    const { client } = await open()
    await userEvent.type(quickAdd(), 'café{Enter}')
    expect(screen.getByRole('checkbox', { name: 'Café' })).not.toBeChecked()
    await waitFor(() => expect(item(client, 'Café')?.checked).toBe(false))
    expect(client.rows.checklist_item.filter((r) => r.label === 'Café')).toHaveLength(1)
  })

  it('propose le catalogue pendant la frappe', async () => {
    await open()
    await userEvent.type(quickAdd(), 'œufs, fr')
    const suggestions = screen.getByRole('list', { name: 'Suggestions du catalogue' })
    expect(within(suggestions).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ajouter Fraises',
      'Ajouter Fromage cheddar',
    ])
    expect(within(suggestions).getByText('Fruits et légumes · 18 fois')).toBeInTheDocument()

    await userEvent.click(within(suggestions).getByRole('button', { name: 'Ajouter Fraises' }))
    expect(within(screen.getByRole('region', { name: 'Fruits et légumes' })).getByRole('checkbox', { name: 'Fraises' })).toBeInTheDocument()
    expect(quickAdd()).toHaveValue('œufs, ')
  })
})

describe('fiche article', () => {
  it('modifie la quantité et le rayon, et apprend le rayon au catalogue', async () => {
    const { client } = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Lait' }))
    const sheet = screen.getByRole('dialog', { name: 'Lait' })
    await userEvent.type(within(sheet).getByLabelText('Quantité'), '2 L')
    await userEvent.selectOptions(within(sheet).getByLabelText('Rayon'), 'Boulangerie')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Boulangerie' })).getByText('2 L')).toBeInTheDocument()
    await waitFor(() => expect(item(client, 'Lait')?.category_id).toBe('cat-boulangerie'))
    await waitFor(() => expect(client.rows.catalog_item.find((c) => c.id === 'c-lait')?.default_category_id).toBe('cat-boulangerie'))
    expect(item(client, 'Lait')).toMatchObject({ quantity: '2 L', category_id: 'cat-boulangerie' })
  })

  it('supprime un article en pierre tombale', async () => {
    const { client } = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Piles AA' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer l’article' }))
    expect(screen.queryByRole('checkbox', { name: 'Piles AA' })).not.toBeInTheDocument()
    await waitFor(() => expect(client.rows.checklist_item.find((r) => r.id === 'i-piles')?.deleted_at).not.toBeNull())
  })
})

describe('listes et rayons', () => {
  it('crée une liste et l’ouvre', async () => {
    const { client, router } = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle liste' }))
    await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Nom'), 'Costco')
    await userEvent.click(screen.getByRole('button', { name: 'Créer la liste' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Costco' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rien à acheter' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Achats fréquents' })).toHaveTextContent('Fraises')
    expect(router.state.location.pathname).toMatch(/^\/courses\/liste\//)
    await waitFor(() => expect(client.rows.checklist.find((l) => l.name === 'Costco')).toMatchObject({ kind: 'shopping', is_default: false }))
  })

  it('ne propose pas de supprimer la liste par défaut, mais bien les autres', async () => {
    const { client } = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Options de la liste' }))
    expect(screen.getByText(/liste par défaut : elle ne se supprime pas/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    await userEvent.click(screen.getByRole('link', { name: /Pharmacie/ }))
    await screen.findByRole('heading', { level: 1, name: 'Pharmacie' })
    await userEvent.click(screen.getByRole('button', { name: 'Options de la liste' }))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la liste' }))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Épicerie' })).toBeInTheDocument()
    await waitFor(() => expect(client.rows.checklist.find((l) => l.id === 'list-pharmacie')?.deleted_at).not.toBeNull())
  })

  it('réordonne les rayons et la liste suit', async () => {
    const { client, router } = await open('/courses/rayons', 'Ordre des rayons')
    await userEvent.click(await screen.findByRole('button', { name: 'Monter Boulangerie' }))
    const names = within(screen.getByRole('list', { name: 'Rayons' })).getAllByRole('button', { name: /^Modifier le rayon/ })
    expect(names.map((b) => b.textContent)).toEqual(['Fruits et légumes1', 'Boulangerie1', 'Produits laitiers1'])
    await waitFor(() => expect(client.rows.shopping_category.find((c) => c.id === 'cat-boulangerie')?.sort_order).toBe(1.5))

    await router.navigate('/courses')
    await screen.findByRole('heading', { level: 1, name: 'Épicerie' })
    expect(screen.getAllByRole('region').map((s) => s.getAttribute('aria-label')).slice(0, 3)).toEqual([
      'Fruits et légumes',
      'Boulangerie',
      'Produits laitiers',
    ])
  })
})
