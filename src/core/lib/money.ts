import type { Enums } from '../db/database.types'

/**
 * Argent : montants en centièmes de la devise (entiers), jamais en flottant dans les comptes.
 * Partagé par Voyages (budget) et Dépenses.
 */

export type Category = Enums<'expense_category'>

export const categoryLabel: Record<Category, string> = {
  transport: 'Transport',
  lodging: 'Logement',
  food: 'Restos',
  activity: 'Activités',
  shopping: 'Courses',
  other: 'Divers',
}

export const categories = Object.keys(categoryLabel) as Category[]

/** Devises proposées en premier ; toute autre devise ISO à trois lettres reste possible. */
export const COMMON_CURRENCIES = ['CAD', 'EUR', 'USD', 'GBP', 'CHF', 'MXN', 'JPY'] as const

/** « 1 486,00 $ », « 64,00 € », « 12,00 $ US ». */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export const formatCents = (cents: number, currency: string) => formatMoney(cents / 100, currency)

/** « 64 », « 64,5 », « 1 486,00 » → centièmes ; null si ce n'est pas un montant positif à deux décimales au plus. */
export function parseCents(input: string): number | null {
  const text = input.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null
  const [units, decimals = ''] = text.split('.')
  const cents = Number(units) * 100 + Number(decimals.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/** Centièmes → saisie : 6400 → « 64,00 ». */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

const SCALE = 100_000_000n

/** Taux en entier à 8 décimales, comme `numeric(18,8)` en base. */
function scaledRate(rate: number | string): bigint {
  const [units, decimals = ''] = String(rate).split('.')
  return BigInt(units) * SCALE + BigInt(decimals.slice(0, 8).padEnd(8, '0'))
}

/**
 * Conversion au taux figé, arrondie comme Postgres (`round(amount_cents * fx_rate)`, demi vers le haut
 * pour un positif), en entiers exacts : le téléphone et la base tombent sur le même centime.
 */
export function convertCents(cents: number, rate: number | string): number {
  const product = BigInt(cents) * scaledRate(rate)
  return Number((product + SCALE / 2n) / SCALE)
}
