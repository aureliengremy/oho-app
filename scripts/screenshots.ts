/**
 * Captures du manifeste (fiche d'installation Android) : quatre écrans sur un téléphone, avec les
 * données du seed. Prérequis : `npx supabase start` et `.env.local`, puis `npm run screenshots`
 * (l'app est servie par `vite preview` sur le port 4173, comme pour les tests E2E).
 */
import { chromium, devices } from '@playwright/test'

const base = process.env.BASE_URL ?? 'http://localhost:4173'
const id = (suffix: string) => `0192f000-0000-7000-8000-${suffix}`
const shots = [
  { file: 'courses', path: `/courses/liste/${id('0000000d0001')}`, heading: 'Épicerie' },
  { file: 'voyage', path: `/voyages/${id('0000000e0001')}/idees`, heading: 'Lisbonne & Porto' },
  { file: 'a-regarder', path: '/a-regarder', heading: 'À regarder' },
  { file: 'depenses', path: `/depenses/${id('000000120001')}`, heading: 'Dépenses' },
]

// Pixel 7 : 412 × 839 à 2,625, soit 1082 × 2202, au format « narrow » des fiches d'installation.
// Mieux vaut une base fraîche (`npx supabase db reset`) : les tests E2E y laissent leurs lignes.
const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-CA', timezoneId: 'America/Toronto', colorScheme: 'light' })
const page = await context.newPage()
await page.goto(`${base}/connexion`)
await page.getByLabel('Courriel').fill('aurelien@example.com')
await page.getByLabel('Mot de passe', { exact: true }).fill('oho-aurelien-dev')
await page.getByRole('button', { name: 'Se connecter' }).click()
await page.getByRole('navigation', { name: 'Navigation principale' }).waitFor()
for (const shot of shots) {
  await page.goto(base + shot.path)
  await page.getByRole('heading', { level: 1, name: shot.heading }).waitFor()
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `public/screenshots/${shot.file}.png` })
  console.log(`public/screenshots/${shot.file}.png`)
}
await browser.close()
