import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { daysBetween } from '@/core/lib/day'
import { categoryLabel, formatCents } from '@/core/lib/money'
import { BookGate } from './components/BookGate'
import { byCategory, totals, type Book, type ExpensesData } from './model'

const round = (cents: number, currency: string) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(cents / 100))

/** Statistiques d'un carnet : total, moyenne par jour, dépensé par catégorie et qui a payé. */
export function StatsScreen() {
  return <BookGate title="Statistiques">{(book, data) => <StatsView book={book} data={data} />}</BookGate>
}

function StatsView({ book, data }: { book: Book; data: ExpensesData }) {
  const { members } = useHousehold()
  const expenses = data.expenses.filter((e) => e.book_id === book.id)
  const { total, paid } = totals(data, book.id, null)
  const trip = data.trips.find((t) => t.id === book.trip_id)
  const days = expenses.map((e) => e.spent_on).sort()
  // Un voyage se moyenne sur ses dates ; un carnet libre, du premier au dernier jour saisi.
  const span = trip?.start_date ? daysBetween(trip.start_date, trip.end_date ?? trip.start_date) + 1 : days.length > 0 ? daysBetween(days[0], days[days.length - 1]) + 1 : 0
  const categories = byCategory(expenses)
  const top = categories[0]?.cents ?? 1
  const foreign = expenses.some((e) => e.currency !== book.currency)

  return (
    <div className="flex flex-col gap-6 pb-10">
      <ScreenHeader title="Statistiques" eyebrow={book.name} back={`/depenses/${book.id}`} />
      {expenses.length === 0 ? (
        <p className="px-5 text-ink-2">Les statistiques apparaîtront avec les premières dépenses.</p>
      ) : (
        <>
          <dl className="flex gap-8 px-5">
            <div className="flex flex-col-reverse">
              <dt className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">Total</dt>
              <dd className="font-display text-3xl font-semibold text-ink tabular-nums">{formatCents(total, book.currency)}</dd>
            </div>
            {span > 0 ? (
              <div className="flex flex-col-reverse">
                <dt className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">Par jour</dt>
                <dd className="font-display text-3xl font-semibold text-ink tabular-nums">{round(total / span, book.currency)}</dd>
              </div>
            ) : null}
          </dl>

          <section aria-labelledby="par-categorie" className="flex flex-col gap-3 px-5">
            <h2 id="par-categorie" className="text-sm font-semibold text-ink">
              Par catégorie, en {book.currency}
            </h2>
            <ul className="flex flex-col gap-2">
              {categories.map((c) => (
                <li key={c.category} className="grid grid-cols-[84px_1fr] items-center gap-3">
                  <span className="text-sm text-ink-2">{categoryLabel[c.category]}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 rounded-pill bg-accent" style={{ width: `${Math.max(2, (c.cents / top) * 75)}%` }} aria-hidden="true" />
                    <span className="font-mono text-sm text-ink tabular-nums">{round(c.cents, book.currency)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="qui-a-paye" className="flex flex-col gap-3 px-5">
            <h2 id="qui-a-paye" className="text-sm font-semibold text-ink">
              Qui a payé, en {book.currency}
            </h2>
            <div className="flex h-4 gap-0.5 overflow-hidden rounded-pill" aria-hidden="true">
              {members.map((m) => (
                <span
                  key={m.profile.id}
                  className={cn(m.slot === 'b' ? 'bg-person-b' : 'bg-person-a')}
                  style={{ width: `${total > 0 ? ((paid.get(m.profile.id) ?? 0) / total) * 100 : 0}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              {members.map((m) => (
                <li key={m.profile.id} className="flex items-center gap-1.5">
                  <span className={cn('size-2.5 rounded-pill', m.slot === 'b' ? 'bg-person-b' : 'bg-person-a')} aria-hidden="true" />
                  {m.profile.display_name} · {formatCents(paid.get(m.profile.id) ?? 0, book.currency)}
                </li>
              ))}
            </ul>
            {foreign ? <p className="text-sm text-ink-3">Les montants en devises sont convertis au taux figé le jour de la saisie.</p> : null}
          </section>
        </>
      )}
    </div>
  )
}
