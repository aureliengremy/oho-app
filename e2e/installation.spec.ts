import { expect, test } from '@playwright/test'
import { accounts } from './helpers'

/** Ce que Chrome et PWABuilder lisent pour installer l'app ou en faire un APK (lot 9). */
test('le manifeste est complet et Chrome juge l’app installable', async ({ page, request }) => {
  await page.goto('/connexion')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(href!)).json()

  expect(manifest).toMatchObject({ id: '/', name: 'OhO', short_name: 'OhO', start_url: '/', scope: '/', display: 'standalone', lang: 'fr' })
  const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any')
  expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable', 'monochrome']))
  expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['/courses', '/voyages', '/a-regarder', '/depenses'])
  expect(manifest.screenshots.length).toBeGreaterThanOrEqual(3)

  // Chaque image annoncée existe, avec la taille annoncée.
  for (const image of [...manifest.icons, ...manifest.screenshots]) {
    const response = await request.get(`/${image.src}`)
    expect(response.ok(), image.src).toBe(true)
    expect(response.headers()['content-type']).toBe('image/png')
    const png = await response.body()
    const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`
    expect(size, image.src).toBe(image.sizes)
  }

  // Le service worker prend la main, puis Chrome ne relève aucun obstacle à l'installation.
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active)).toBe(true)
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  expect(installabilityErrors).toEqual([])
})

test('un raccourci ouvre son outil, même s’il faut d’abord se connecter', async ({ page }) => {
  await page.goto('/voyages')
  await expect(page).toHaveURL(/\/connexion/)
  await page.getByLabel('Courriel').fill(accounts.aurelien.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(accounts.aurelien.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Voyages' })).toBeVisible()
})
