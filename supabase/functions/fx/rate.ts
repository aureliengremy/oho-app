// Taux du jour pour l'outil Dépenses (M15), sans dépendance Deno : testé par Vitest.
// Source : Frankfurter (taux de référence de la BCE), gratuite et sans clé.

export const CURRENCY = /^[A-Z]{3}$/

/** URL du taux de `from` vers `to`. */
export function rateUrl(from: string, to: string): string {
  return `https://api.frankfurter.app/latest?from=${from}&to=${to}`
}

/** Lit la réponse de Frankfurter : `{ date, rates: { CAD: 1.52 } }`. */
export function readRate(body: unknown, to: string): { rate: number; date: string } | null {
  const data = body as { date?: unknown; rates?: Record<string, unknown> } | null
  const rate = data?.rates?.[to]
  if (typeof rate !== 'number' || !(rate > 0) || typeof data?.date !== 'string') return null
  return { rate, date: data.date }
}
