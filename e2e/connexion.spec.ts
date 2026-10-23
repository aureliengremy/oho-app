import { expect, test } from '@playwright/test'
import { expectUsable, login } from './helpers'

test('un mauvais mot de passe le dit, le bon ouvre l’accueil', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/connexion$/)
  await expectUsable(page)

  await page.getByLabel('Courriel').fill('aurelien@example.com')
  await page.getByLabel('Mot de passe', { exact: true }).fill('pas-le-bon')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  await login(page)
  await expect(page).toHaveURL(/\/$/)
  await expectUsable(page)
})

test('la session tient après un rechargement, et la déconnexion la ferme', async ({ page }) => {
  await login(page)
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  await page.goto('/reglages')
  await page.getByRole('button', { name: /Se déconnecter/ }).click()
  await expect(page).toHaveURL(/\/connexion$/)
})
