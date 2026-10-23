import { ArrowRight, X } from 'lucide-react'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { formatCents } from '@/core/lib/money'
import { Avatar } from '@/core/ui/Avatar'
import { Button } from '@/core/ui/Button'
import { BookGate } from './components/BookGate'
import { Pill } from './components/Pill'
import { useExpenses } from './ExpensesProvider'
import { balances, suggestTransfers, totals, type Book, type ExpensesData } from './model'

const settledFormat = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Qui doit quoi : une barre par personne autour du zéro, le virement suggéré et les remboursements passés (M21). */
export function BalancesScreen() {
  return <BookGate title="Qui doit quoi">{(book, data) => <BalancesView book={book} data={data} />}</BookGate>
}

function BalancesView({ book, data }: { book: Book; data: ExpensesData }) {
  const { settle, removeSettlement, error, dismissError } = useExpenses()
  const { members, memberById } = useHousehold()
  const balance = balances(data, book.id, members.map((m) => m.profile.id))
  const transfers = suggestTransfers(balance)
  const { paid } = totals(data, book.id, null)
  const max = Math.max(1, ...[...balance.values()].map(Math.abs))
  const member = (id: string) => memberById(id)
  const name = (id: string) => member(id)?.profile.display_name ?? 'Ancien membre'
  const owed = new Map<string, number>()
  const ids = new Set(data.expenses.filter((e) => e.book_id === book.id).map((e) => e.id))
  for (const s of data.shares) if (ids.has(s.expense_id)) owed.set(s.user_id, (owed.get(s.user_id) ?? 0) + s.share_cents)

  return (
    <div className="flex flex-col gap-5 pb-10">
      <ScreenHeader title="Qui doit quoi" eyebrow={book.name} back={`/depenses/${book.id}`} />

      {error ? (
        <div role="alert" className="mx-5 flex items-center gap-3 rounded-md bg-bad-tint px-4 py-3 text-bad">
          <p className="flex-1 text-sm">{error}</p>
          <button type="button" onClick={dismissError} className="min-h-11 px-2 text-sm font-semibold">
            Fermer
          </button>
        </div>
      ) : null}

      <section aria-label="Soldes" className="mx-5 flex flex-col gap-3 rounded-lg bg-surface-2 px-4 py-4">
        {members.map((m) => {
          const cents = balance.get(m.profile.id) ?? 0
          const width = `calc(${(Math.abs(cents) / max) * 50}% - 2px)`
          return (
            <div key={m.profile.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Avatar name={m.profile.display_name} chosenInitials={m.profile.initials} slot={m.slot} />
                <span className="flex-1 font-semibold text-ink">{m.profile.display_name}</span>
                {cents > 0 ? <Pill tone="ok">À recevoir</Pill> : cents < 0 ? <Pill tone="warn">Doit</Pill> : <Pill tone="neutral">Quitte</Pill>}
                <span className="w-24 text-right font-mono font-semibold text-ink tabular-nums">
                  {cents > 0 ? '+' : cents < 0 ? '−' : ''}
                  {formatCents(Math.abs(cents), book.currency)}
                </span>
              </div>
              <div className="relative h-2.5 rounded-pill bg-surface" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-rule-strong" />
                {cents !== 0 ? (
                  <span
                    className={cn('absolute inset-y-0 rounded-pill', m.slot === 'b' ? 'bg-person-b' : 'bg-person-a', cents > 0 ? 'left-[calc(50%+2px)]' : 'right-[calc(50%+2px)]')}
                    style={{ width }}
                  />
                ) : null}
              </div>
            </div>
          )
        })}
        <div className="flex justify-between font-mono text-[11px] tracking-[var(--ls-eyebrow)] text-ink-3" aria-hidden="true">
          <span>DOIT</span>
          <span>0</span>
          <span>À RECEVOIR</span>
        </div>
        <ul className="flex flex-col gap-0.5 text-sm text-ink-2">
          {members.map((m) => (
            <li key={m.profile.id}>
              {m.profile.display_name} a payé <b className="font-mono font-semibold tabular-nums">{formatCents(paid.get(m.profile.id) ?? 0, book.currency)}</b>, sa part est de{' '}
              <b className="font-mono font-semibold tabular-nums">{formatCents(owed.get(m.profile.id) ?? 0, book.currency)}</b>.
            </li>
          ))}
        </ul>
      </section>

      {transfers.length === 0 ? (
        <p className="mx-5 rounded-md bg-ok-tint px-4 py-3 text-ok">Vous êtes quittes sur ce carnet.</p>
      ) : (
        transfers.map((t) => (
          <section key={`${t.from}-${t.to}`} aria-label="Remboursement suggéré" className="mx-5 flex flex-col gap-2 rounded-lg border border-accent-ink/30 bg-accent-tint px-4 py-4">
            <p className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-accent-ink">REMBOURSEMENT SUGGÉRÉ</p>
            <p className="flex items-center gap-2 text-ink">
              {name(t.from)} <ArrowRight size={16} aria-label="rembourse" /> {name(t.to)}
            </p>
            <p className="font-display text-3xl font-semibold text-ink tabular-nums">{formatCents(t.cents, book.currency)}</p>
            <p className="text-sm text-ink-2">Par Interac ou comptant, hors de l’app.</p>
            <Button onClick={() => settle(book.id, t.from, t.to, t.cents)}>Marquer comme remboursé</Button>
          </section>
        ))
      )}

      {data.settlements.length > 0 ? (
        <section aria-labelledby="passes" className="flex flex-col gap-2 px-5">
          <h2 id="passes" className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
            REMBOURSEMENTS PASSÉS
          </h2>
          <ul className="flex flex-col divide-y divide-rule">
            {data.settlements.map((s) => {
              const from = member(s.from_user)
              const bookName = data.books.find((b) => b.id === s.book_id)?.name ?? ''
              const currency = data.books.find((b) => b.id === s.book_id)?.currency ?? book.currency
              return (
                <li key={s.id} className="flex min-h-14 items-center gap-3 py-1">
                  <Avatar name={name(s.from_user)} chosenInitials={from?.profile.initials} slot={from?.slot ?? 'other'} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-ink">
                      {name(s.from_user)} → {name(s.to_user)} · <b className="font-mono tabular-nums">{formatCents(s.amount_cents, currency)}</b>
                    </span>
                    <span className="text-sm text-ink-3">
                      {bookName} · {settledFormat.format(new Date(`${s.settled_on}T00:00:00Z`))}
                    </span>
                  </span>
                  <Pill tone="ok">Réglé</Pill>
                  <button
                    type="button"
                    onClick={() => removeSettlement(s)}
                    aria-label={`Annuler le remboursement de ${formatCents(s.amount_cents, currency)}`}
                    className="flex size-11 flex-none items-center justify-center rounded-md text-ink-3 hover:text-bad"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
