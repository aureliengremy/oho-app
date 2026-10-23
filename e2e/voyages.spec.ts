import { expect, test } from '@playwright/test'
import { expectUsable, login, seed, unique } from './helpers'

test('créer un voyage daté, puis y noter une idée', async ({ page }) => {
  const title = `Gaspésie ${unique()}`
  await login(page)
  await page.goto('/voyages')
  await page.getByRole('button', { name: 'Voyage' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nouveau voyage' })
  await expectUsable(page)
  await sheet.getByLabel('Titre').fill(title)
  await sheet.getByLabel('Départ').fill('2027-07-10')
  await sheet.getByLabel('Retour').fill('2027-07-20')
  await sheet.getByRole('button', { name: 'Créer le voyage' }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

  await page.getByRole('textbox', { name: 'Nouvelle idée' }).fill('Rocher Percé')
  // Voyages écrit directement (sans file hors ligne) : on attend la réponse avant de recharger.
  const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/trip_activity') && r.request().method() !== 'GET')
  await page.getByRole('textbox', { name: 'Nouvelle idée' }).press('Enter')
  await expect(page.getByRole('checkbox', { name: 'Rocher Percé' })).toBeVisible()
  expect((await saved).ok()).toBe(true)
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Rocher Percé' })).toBeVisible()
})

test('les quatre onglets d’un voyage passent l’audit', async ({ page }) => {
  await login(page)
  for (const tab of ['idees', 'checklist', 'reservations', 'budget']) {
    await page.goto(`/voyages/${seed.trip}/${tab}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Lisbonne & Porto' })).toBeVisible()
    await expect(page.getByText(/^Chargement/)).toHaveCount(0)
    await expectUsable(page)
  }
})
