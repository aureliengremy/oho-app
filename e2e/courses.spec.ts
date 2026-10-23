import { expect, test } from '@playwright/test'
import { expectUsable, login, secondPhone, seed, unique } from './helpers'

const quickAdd = /Ajouter des articles/

test('un article ajouté sur un téléphone apparaît sur l’autre, coché compris', async ({ page, browser }) => {
  const item = `Kiwis ${unique()}`
  await login(page, 'aurelien')
  await page.goto(`/courses/liste/${seed.groceries}`)
  const auriane = await secondPhone(browser, 'auriane')
  await auriane.page.goto(`/courses/liste/${seed.groceries}`)
  await expect(auriane.page.getByText('En direct')).toBeVisible()

  await page.getByRole('textbox', { name: quickAdd }).fill(item)
  await page.getByRole('textbox', { name: quickAdd }).press('Enter')
  await expect(page.getByRole('checkbox', { name: item })).toBeVisible()

  // Sans recharger : le temps réel l'amène chez Auriane, qui le coche.
  const onHers = auriane.page.getByRole('checkbox', { name: item })
  await expect(onHers).toBeVisible()
  await onHers.click()
  // Coché, il descend dans « Dans le panier », replié.
  await expect(onHers).toBeHidden()

  await page.getByRole('button', { name: /Dans le panier/ }).click()
  await expect(page.getByRole('list', { name: 'Dans le panier' }).getByRole('checkbox', { name: item })).toBeChecked()
  await auriane.context.close()
})

test('la fiche d’un article et la liste passent l’audit', async ({ page }) => {
  await login(page)
  await page.goto(`/courses/liste/${seed.groceries}`)
  await expect(page.getByRole('checkbox', { name: 'Pommes' })).toBeVisible()
  await expectUsable(page)
  await page.getByRole('button', { name: 'Modifier Pommes' }).click()
  await expect(page.getByRole('dialog', { name: 'Pommes' })).toBeVisible()
  await expectUsable(page)
})

test('hors ligne, l’ajout attend puis part au retour du réseau', async ({ page, context, browser }) => {
  const item = `Citrons ${unique()}`
  await login(page)
  await page.goto(`/courses/liste/${seed.groceries}`)
  await expect(page.getByText('En direct')).toBeVisible()

  await context.setOffline(true)
  await page.getByRole('textbox', { name: quickAdd }).fill(item)
  await page.getByRole('textbox', { name: quickAdd }).press('Enter')
  await expect(page.getByRole('checkbox', { name: item })).toBeVisible()
  await expect(page.getByText(/Hors ligne · 1 modification en attente/)).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText('En direct')).toBeVisible({ timeout: 20_000 })

  const auriane = await secondPhone(browser, 'auriane')
  await auriane.page.goto(`/courses/liste/${seed.groceries}`)
  await expect(auriane.page.getByRole('checkbox', { name: item })).toBeVisible()
  await auriane.context.close()
})
