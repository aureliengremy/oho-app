import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeClient, watchRows } from '@/test/fakeClient'
import { renderApp } from '@/test/renderApp'

beforeEach(() => localStorage.clear())

const open = async (path: string, heading: string, userId = 'user-a') => {
  const client = fakeClient({ userId, rows: watchRows })
  const router = renderApp(client, path)
  await screen.findByRole('heading', { level: 1, name: heading })
  return { client, router }
}

const live = (client: ReturnType<typeof fakeClient>, table: string) => client.rows[table].filter((r) => r.deleted_at === null)

describe('la liste', () => {
  it('ouvre sur « À voir », en grille, avec les compteurs par statut', async () => {
    await open('/a-regarder', 'À regarder')
    const list = await screen.findByRole('list', { name: 'Titres' })
    expect(within(list).getAllByRole('link')).toHaveLength(3)
    expect(within(list).getAllByRole('link')[0]).toHaveAccessibleName('The Bear, Série, 30 min, proposé par Aurélien')
    expect(within(list).getAllByRole('link')[1]).toHaveAccessibleName('Le règne animal, Film, 2 h 08 · Crave, proposé par Aurélien')
    expect(within(list).getAllByRole('link')[2]).toHaveAccessibleName('Past Lives, Film, 1 h 46 · Prime Video, proposé par Auriane')
    const nav = screen.getByRole('navigation', { name: 'Filtrer les titres' })
    expect(within(nav).getByRole('link', { name: /À voir\s*3/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /En cours\s*1/ })).toBeInTheDocument()
  })

  it('« Ce soir » filtre par durée et plateforme, et la durée se règle pour l’espace', async () => {
    const { client } = await open('/a-regarder?soir=1', 'À regarder')
    expect(await screen.findByText(/3 plateformes · 2 titres/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Durée maximale'), '150')
    await waitFor(() => expect(client.rows.tool_activation.find((a) => a.tool_key === 'watchlist')?.settings).toEqual({ tonight_max_min: 150 }))
    expect(await screen.findByText(/3 titres/)).toBeInTheDocument()
  })

  it('tirage au sort : une réponse, deux relances, « On regarde ça » la passe en cours', async () => {
    const { client } = await open('/a-regarder', 'À regarder')
    await userEvent.click(await screen.findByRole('button', { name: 'Tirer au sort' }))
    const sheet = screen.getByRole('dialog', { name: 'Ce soir, ce sera…' })
    const first = within(sheet).getByRole('status').textContent
    await userEvent.click(within(sheet).getByRole('button', { name: /Relancer · 2 restantes/ }))
    expect(within(sheet).getByRole('status').textContent).not.toBe(first)
    await userEvent.click(within(sheet).getByRole('button', { name: /Relancer · 1 restante/ }))
    expect(within(sheet).getByRole('button', { name: /plus de relance/ })).toBeDisabled()
    const pick = within(sheet).getByRole('status').textContent!
    await userEvent.click(within(sheet).getByRole('button', { name: 'On regarde ça' }))
    expect(await screen.findByRole('heading', { level: 1, name: pick })).toBeInTheDocument()
    await waitFor(() => expect(live(client, 'watch_item').find((i) => i.title === pick)?.status).toBe('watching'))
  })
})

describe('ajouter un titre', () => {
  it('cherche sur TMDB par la fonction serveur et ajoute la fiche', async () => {
    const { client } = await open('/a-regarder', 'À regarder')
    const calls: Record<string, unknown>[] = []
    client.functions.handlers.tmdb = async (body) => {
      calls.push(body)
      if (body.action === 'search')
        return {
          results: [
            { media_type: 'movie', external_id: '915935', title: 'Anatomie d’une chute', year: 2023, poster_path: null, overview: null },
            { media_type: 'movie', external_id: '666277', title: 'Past Lives', year: 2023, poster_path: null, overview: null },
          ],
        }
      const media = { id: 'm-anatomie', source: 'tmdb', media_type: 'movie', external_id: '915935', title: 'Anatomie d’une chute', original_title: null, year: 2023, overview: 'Sandra…', poster_path: null, runtime_min: 151, number_of_seasons: null, genres: null, providers: null, fetched_at: '', created_at: '', updated_at: '' }
      client.rows.external_media.push(media)
      return { media }
    }
    await userEvent.click(await screen.findByRole('button', { name: 'Titre' }))
    const sheet = screen.getByRole('dialog', { name: 'Ajouter un titre' })
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /Rechercher/ }), 'anatomie')
    const results = await within(sheet).findByRole('region', { name: 'Résultats TMDB' })
    expect(within(results).getByText('Dans la liste')).toBeInTheDocument()
    await userEvent.selectOptions(within(sheet).getByLabelText('Où le regarder'), 'pf-crave')
    await userEvent.click(within(results).getByRole('button', { name: 'Ajouter Anatomie d’une chute' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Anatomie d’une chute' })).toBeInTheDocument()
    expect(screen.getByText('Sandra…')).toBeInTheDocument()
    expect(calls).toEqual([{ action: 'search', query: 'anatomie' }, { action: 'import', media_type: 'movie', external_id: '915935' }])
    await waitFor(() =>
      expect(live(client, 'watch_item').find((i) => i.media_id === 'm-anatomie')).toMatchObject({ kind: 'movie', status: 'to_watch', platform_id: 'pf-crave' }),
    )
  })

  it('sans clé TMDB, le dit et propose l’ajout sans fiche', async () => {
    const { client } = await open('/a-regarder', 'À regarder')
    await userEvent.click(await screen.findByRole('button', { name: 'Titre' }))
    const sheet = screen.getByRole('dialog', { name: 'Ajouter un titre' })
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /Rechercher/ }), 'Shogun')
    expect(await within(sheet).findByText(/pas encore branchée/)).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Série' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Shogun' })).toBeInTheDocument()
    await waitFor(() => expect(live(client, 'watch_item').find((i) => i.title === 'Shogun')).toMatchObject({ kind: 'series', media_id: null, suggested_by: 'user-a' }))
  })
})

describe('la fiche', () => {
  it('montre nos deux notes ; je note pour moi seulement', async () => {
    const { client } = await open('/a-regarder/w-past', 'Past Lives', 'user-b')
    expect(screen.getByText('Proposé par Auriane')).toBeInTheDocument()
    expect(screen.getByText('Nora et Hae Sung se retrouvent.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: '4 sur 5' }))
    await waitFor(() => expect(live(client, 'watch_rating').find((r) => r.watch_item_id === 'w-past')).toMatchObject({ user_id: 'user-b', rating: 4 }))
    expect(screen.getAllByRole('radiogroup', { name: 'Ma note' })).toHaveLength(1)
    await userEvent.type(screen.getByLabelText('Mon mot'), 'Bouleversant')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mon mot' }))
    await waitFor(() => expect(live(client, 'watch_rating').find((r) => r.watch_item_id === 'w-past')?.comment).toBe('Bouleversant'))
    expect(live(client, 'watch_rating').filter((r) => r.watch_item_id === 'w-past')).toHaveLength(1)
  })

  it('série : la progression est partagée et avance d’un épisode', async () => {
    const { client } = await open('/a-regarder/w-sev', 'Severance')
    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
    expect(screen.getByText(/« Lent au début, puis impossible d’arrêter\. » — Auriane/)).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Épisode' })).toHaveTextContent('6')
    await userEvent.click(screen.getByRole('button', { name: 'Épisode suivant' }))
    expect(screen.getByRole('status', { name: 'Épisode' })).toHaveTextContent('7')
    expect(screen.getByRole('button', { name: 'Saison : plus' })).toBeDisabled()
    await waitFor(() => expect(client.rows.watch_item.find((i) => i.id === 'w-sev')).toMatchObject({ season_current: 2, episode_current: 7 }))
  })

  it('passer en « Vu » puis retirer de la liste', async () => {
    const { client } = await open('/a-regarder/w-regne', 'Le règne animal')
    await userEvent.click(screen.getByRole('radio', { name: 'Vu' }))
    await waitFor(() => expect(client.rows.watch_item.find((i) => i.id === 'w-regne')?.status).toBe('watched'))
    await userEvent.click(screen.getByRole('button', { name: 'Retirer de la liste' }))
    await userEvent.click(screen.getByRole('button', { name: /Retirer « Le règne animal »/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'À regarder' })).toBeInTheDocument()
    await waitFor(() => expect(client.rows.watch_item.find((i) => i.id === 'w-regne')?.deleted_at).not.toBeNull())
  })

  it('nos plateformes : se désabonner retire du filtre « ce soir »', async () => {
    const { client } = await open('/a-regarder?soir=1', 'À regarder')
    await userEvent.click(await screen.findByRole('button', { name: 'Nos plateformes' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Abonnés à Prime Video' }))
    await waitFor(() => expect(client.rows.watch_platform.find((p) => p.id === 'pf-prime')?.is_subscribed).toBe(false))
    await userEvent.type(screen.getByRole('textbox', { name: 'Nouvelle plateforme' }), 'Tou.tv{Enter}')
    await waitFor(() => expect(live(client, 'watch_platform').map((p) => p.name)).toContain('Tou.tv'))
  })
})
