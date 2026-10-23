import { expect, test } from '@playwright/test'
import { expectUsable, login, seed, unique } from './helpers'

test('une dépense partagée à parts égales change le solde', async ({ page }) => {
  const label = `Épicerie ${unique()}`
  await login(page)
  await page.goto(`/depenses/${seed.dailyBook}`)
  await expect(page.getByRole('navigation', { name: 'Carnets' }).getByRole('link', { name: 'Quotidien' })).toHaveAttribute('aria-current', 'page')
  const balance = page.getByRole('link', { name: /Voir qui doit quoi/ })
  const before = await balance.getAttribute('aria-label')

  await page.getByRole('link', { name: 'Dépense', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Nouvelle dépense' })).toBeVisible()
  await expectUsable(page)
  await page.getByLabel('Montant').fill('40')
  await page.getByLabel('Quoi').fill(label)
  await page.getByRole('radio', { name: 'Auriane' }).check()
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible()
  await expect(balance).not.toHaveAttribute('aria-label', before ?? '')
})

test('qui doit quoi, puis « Marquer comme remboursé »', async ({ page }) => {
  await login(page)
  await page.goto(`/depenses/${seed.tripBook}/soldes`)
  await expect(page.getByRole('heading', { level: 1, name: 'Qui doit quoi' })).toBeVisible()
  await expectUsable(page)
  const suggested = page.getByRole('region', { name: 'Remboursement suggéré' })
  await suggested.getByRole('button', { name: 'Marquer comme remboursé' }).click()
  await expect(page.getByText('Vous êtes quittes sur ce carnet.')).toBeVisible()
  // Annuler le remboursement remet le solde, pour que le test se rejoue sur la même base.
  await page.getByRole('button', { name: /Annuler le remboursement/ }).first().click()
  await expect(suggested.getByRole('button', { name: 'Marquer comme remboursé' })).toBeVisible()

  await page.goto(`/depenses/${seed.tripBook}/stats`)
  await expect(page.getByRole('heading', { level: 1, name: 'Statistiques' })).toBeVisible()
  await expectUsable(page)
})
