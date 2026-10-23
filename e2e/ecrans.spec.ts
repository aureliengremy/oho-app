import { expect, test } from '@playwright/test'
import { expectUsable, login, seed } from './helpers'

/** Chaque écran, en clair puis en sombre : WCAG 2.1 AA et cibles de 44 px. */
const screens = [
  ['Accueil', '/'],
  ['Courses', `/courses/liste/${seed.groceries}`],
  ['Rayons', '/courses/rayons'],
  ['Voyages', '/voyages'],
  ['À regarder', '/a-regarder'],
  ['À regarder, liste vide', '/a-regarder?statut=dropped'],
  ['Carnet', `/depenses/${seed.tripBook}`],
  ['Dépense', `/depenses/${seed.tripBook}/depense/${seed.lodging}`],
  ['Activité', '/activite'],
  ['Réglages', '/reglages'],
  ['État', '/etat'],
] as const

for (const scheme of ['light', 'dark'] as const) {
  test(`tous les écrans en ${scheme === 'light' ? 'clair' : 'sombre'}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await login(page)
    for (const [name, path] of screens) {
      await test.step(name, async () => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByText(/^Chargement/)).toHaveCount(0)
        await expectUsable(page)
      })
    }
  })
}
