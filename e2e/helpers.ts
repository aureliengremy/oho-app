import AxeBuilder from '@axe-core/playwright'
import { devices, expect, type Browser, type Page } from '@playwright/test'

/** Comptes du seed (`supabase/seed.sql`). */
export const accounts = {
  aurelien: { email: 'aurelien@example.com', password: 'oho-aurelien-dev' },
  auriane: { email: 'auriane@example.com', password: 'oho-auriane-dev' },
} as const

const id = (suffix: string) => `0192f000-0000-7000-8000-${suffix}`
export const seed = {
  groceries: id('0000000d0001'),
  trip: id('0000000e0001'),
  severance: id('000000110002'),
  tripBook: id('000000120001'),
  dailyBook: id('000000120002'),
  lodging: id('000000130001'),
}

/** Un suffixe court pour que chaque passage écrive ses propres lignes sans remettre la base à zéro. */
export const unique = () => Date.now().toString(36).slice(-5)

export async function login(page: Page, who: keyof typeof accounts = 'aurelien') {
  await page.goto('/connexion')
  await page.getByLabel('Courriel').fill(accounts[who].email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(accounts[who].password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('navigation', { name: /principale/i })).toBeVisible()
}

/** Un second téléphone, connecté sur l'autre compte. */
export async function secondPhone(browser: Browser, who: keyof typeof accounts) {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:4173', locale: 'fr-CA', timezoneId: 'America/Toronto' })
  const page = await context.newPage()
  await login(page, who)
  return { context, page }
}

/** WCAG 2.1 AA (axe) et cibles tactiles d'au moins 44 px sur ce qui est affiché. */
export async function expectUsable(page: Page) {
  // label-content-name-mismatch (2.5.3) est une règle expérimentale d'axe : elle refuse « Modifier Lait »
  // sur une ligne qui affiche aussi la quantité et l'auteur, et « Réglages » sur l'avatar AL. Le nom
  // accessible contient bien le titre affiché, ce qui suffit à la commande vocale.
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['label-content-name-mismatch'])
    .analyze()
  const violations = axe.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(violations, 'violations axe').toEqual([])
  expect(await smallTargets(page), 'cibles de moins de 44 px').toEqual([])
}

/**
 * Ce qui se touche et fait moins de 44 × 44 px. Un champ placé dans une étiquette assez grande
 * compte comme l'étiquette, et les liens au fil d'un texte sont exemptés (WCAG 2.5.8).
 */
export function smallTargets(page: Page) {
  return page.evaluate(() => {
    const MIN = 44
    const selector = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=link]'
    const big = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width >= MIN - 0.5 && r.height >= MIN - 0.5
    }
    return [...document.querySelectorAll(selector)]
      .filter((el) => {
        const style = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (style.visibility === 'hidden' || style.display === 'none' || r.width <= 1 || r.height <= 1) return false
        if (el.closest('[aria-hidden="true"], [inert]')) return false
        if (big(el)) return false
        const label = el.closest('label')
        if (label && big(label)) return false
        // Case et bouton radio natifs : la cible est l'étiquette qui les porte.
        if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) {
          const owner = el.labels?.[0]
          if (owner && big(owner)) return false
        }
        if (el.tagName === 'A' && el.closest('p')) return false
        return true
      })
      .map((el) => {
        const r = el.getBoundingClientRect()
        const name = el.getAttribute('aria-label') ?? el.textContent ?? ''
        return `${el.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)} « ${name.trim().slice(0, 40)} »`
      })
  })
}
