import { expect, test, type Page } from '@playwright/test'
import { accounts, expectUsable, login } from './helpers'

/** Boîte de réception du Supabase local (Mailpit). */
const mailpit = 'http://127.0.0.1:54324/api/v1'

async function lastLinkTo(page: Page, email: string, after: Date) {
  let link: string | null = null
  await expect(async () => {
    const search = await page.request.get(`${mailpit}/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`)
    const [message] = (await search.json()).messages as { ID: string; Created: string }[]
    expect(message && new Date(message.Created) >= after).toBeTruthy()
    const body = (await (await page.request.get(`${mailpit}/message/${message.ID}`)).json()) as { HTML: string; Text: string }
    link = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(body.HTML)?.[1]?.replaceAll('&amp;', '&') ?? null
    expect(link).toBeTruthy()
  }).toPass({ timeout: 15_000 })
  return link!
}

async function choosePassword(page: Page, password: string) {
  await page.getByLabel('Nouveau mot de passe').fill(password)
  await page.getByLabel('Confirmer le mot de passe').fill(password)
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await expect(page.getByRole('status')).toContainText('Mot de passe changé')
}

test('le lien reçu par courriel connecte et ouvre l’écran du nouveau mot de passe', async ({ page, browser }) => {
  const { email, password } = accounts.auriane
  const fresh = 'nouveau-secret-e2e'

  await login(page, 'auriane')
  await page.goto('/reglages')
  const sentAt = new Date(Date.now() - 1000)
  await page.getByRole('button', { name: /Recevoir le lien par courriel/ }).click()
  await expect(page.getByRole('region', { name: 'Mot de passe' })).toContainText(`Lien envoyé à ${email}`)
  const link = await lastLinkTo(page, email, sentAt)

  // Le lien s'ouvre ailleurs (appli de courriel) : un autre navigateur, sans session.
  const other = await browser.newContext({ baseURL: 'http://localhost:4173', locale: 'fr-CA' })
  const phone = await other.newPage()
  try {
    await phone.goto(link)
    await expect(phone).toHaveURL(/\/mot-de-passe/)
    await expect(phone.getByRole('heading', { level: 1, name: 'Nouveau mot de passe' })).toBeVisible()
    await expectUsable(phone)
    await choosePassword(phone, fresh)

    // Le nouveau mot de passe sert à la connexion, l'ancien non.
    await page.goto('/reglages')
    await page.getByRole('button', { name: /Se déconnecter/ }).click()
    await page.getByLabel('Courriel').fill(email)
    await page.getByLabel('Mot de passe', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByLabel('Mot de passe', { exact: true }).fill(fresh)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByRole('navigation', { name: /principale/i })).toBeVisible()
  } finally {
    // Remet le mot de passe du seed pour les autres parcours.
    await phone.goto('/mot-de-passe')
    await choosePassword(phone, password)
    await other.close()
  }
})
