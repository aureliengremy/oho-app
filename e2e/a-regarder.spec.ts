import { expect, test } from '@playwright/test'
import { expectUsable, login, seed, unique } from './helpers'

test('ajouter un titre sans fiche, puis le noter', async ({ page }) => {
  const title = `Shogun ${unique()}`
  await login(page)
  await page.goto('/a-regarder')
  await expect(page.getByRole('list', { name: 'Titres' })).toBeVisible()
  await expectUsable(page)

  await page.getByRole('button', { name: 'Titre' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ajouter un titre' })
  await sheet.getByRole('searchbox', { name: /Rechercher/ }).fill(title)
  // Sans la fonction TMDB en local, la fiche propose l'ajout sans fiche.
  await sheet.getByRole('button', { name: 'Série' }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expectUsable(page)
})

test('la fiche d’une série passe l’audit', async ({ page }) => {
  await login(page)
  await page.goto(`/a-regarder/${seed.severance}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Severance' })).toBeVisible()
  await expectUsable(page)
})
