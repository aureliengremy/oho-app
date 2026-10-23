import { useState } from 'react'
import { BarChart3, Plus, Settings2, Wallet } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { formatCents } from '@/core/lib/money'
import { ConnectionBanner, LiveBadge } from '@/core/sync/ConnectionStatus'
import { BookGate } from './components/BookGate'
import { BookSheet } from './components/BookSheet'
import { ExpenseRow } from './components/ExpenseRow'
import { Pill } from './components/Pill'
import { useExpenses } from './ExpensesProvider'
import { balances, byDay, dayLabel, situation, totals, type Book, type ExpensesData } from './model'

const iconButton = 'flex size-11 items-center justify-center rounded-pill text-ink hover:bg-surface-2'

/** Un carnet : les autres carnets en pastilles, le solde en une phrase, les dépenses par jour. */
export function BookScreen() {
  return <BookGate title="Dépenses">{(book, data) => <BookView book={book} data={data} />}</BookGate>
}

function BookView({ book, data }: { book: Book; data: ExpensesData }) {
  const { updatedAt, error, dismissError } = useExpenses()
  const { members, me, memberById } = useHousehold()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<'new' | 'edit' | null>(null)
  const myId = me?.profile.id ?? null
  const trip = data.trips.find((t) => t.id === book.trip_id)
  const expenses = data.expenses.filter((e) => e.book_id === book.id)
  const { total, mine } = totals(data, book.id, myId)
  const state = situation(balances(data, book.id, members.map((m) => m.profile.id)), myId)
  const name = (id: string) => memberById(id)?.profile.display_name ?? 'Ancien membre'

  const sentence =
    state.kind === 'even'
      ? 'Vous êtes quittes'
      : state.kind === 'owe'
        ? `Tu dois ${formatCents(state.transfer.cents, book.currency)} à ${name(state.transfer.to)}`
        : state.kind === 'owed'
          ? `${name(state.transfer.from)} te doit ${formatCents(state.transfer.cents, book.currency)}`
          : `${name(state.transfer.from)} doit ${formatCents(state.transfer.cents, book.currency)} à ${name(state.transfer.to)}`

  return (
    <div className="flex flex-col pb-28">
      <ScreenHeader
        title="Dépenses"
        actions={
          <>
            <LiveBadge />
            <Link to={`/depenses/${book.id}/stats`} aria-label="Statistiques du carnet" className={iconButton}>
              <BarChart3 size={20} />
            </Link>
            <button type="button" onClick={() => setSheet('edit')} aria-label="Réglages du carnet" className={iconButton}>
              <Settings2 size={20} />
            </button>
          </>
        }
      />
      <ConnectionBanner updatedAt={updatedAt} />

      <nav aria-label="Carnets" className="flex gap-2 overflow-x-auto px-5 pt-1 pb-3">
        {data.books.map((b) => (
          <Link
            key={b.id}
            to={`/depenses/${b.id}`}
            replace
            aria-current={b.id === book.id ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-none items-center rounded-pill border px-4 text-[15px] font-semibold',
              b.id === book.id ? 'border-accent-ink bg-accent-tint text-accent-ink' : 'border-rule text-ink-2',
            )}
          >
            {b.name}
          </Link>
        ))}
        <button type="button" onClick={() => setSheet('new')} aria-label="Nouveau carnet" className="flex size-11 flex-none items-center justify-center rounded-pill border border-rule text-ink-2">
          <Plus size={18} />
        </button>
      </nav>

      <Link to={`/depenses/${book.id}/soldes`} className="mx-5 flex flex-col gap-1 rounded-lg bg-surface-2 px-4 py-3" aria-label={`${sentence}. Voir qui doit quoi`}>
        <span className="flex items-center gap-2" aria-hidden="true">
          <span className="flex-1 font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">SOLDE · EN {book.currency}</span>
          {state.kind === 'even' ? <Pill tone="ok">Équilibré</Pill> : state.kind === 'owed' ? <Pill tone="ok">À recevoir</Pill> : <Pill tone="warn">À rembourser</Pill>}
        </span>
        <span className="font-display text-2xl font-semibold text-ink" aria-hidden="true">
          {sentence}
        </span>
        <span className="text-sm text-ink-2">
          Total <b className="font-mono font-semibold tabular-nums">{formatCents(total, book.currency)}</b> · ta part{' '}
          <b className="font-mono font-semibold tabular-nums">{formatCents(mine, book.currency)}</b>
        </span>
      </Link>

      {error ? (
        <div role="alert" className="mx-5 mt-3 flex items-center gap-3 rounded-md bg-bad-tint px-4 py-3 text-bad">
          <p className="flex-1 text-sm">{error}</p>
          <button type="button" onClick={dismissError} className="min-h-11 px-2 text-sm font-semibold">
            Fermer
          </button>
        </div>
      ) : null}

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent-ink">
            <Wallet size={24} aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-semibold text-ink">Aucune dépense pour l’instant</h2>
          <p className="text-ink-2">Chaque dépense dit qui a payé et comment elle se partage ; le solde se calcule tout seul.</p>
        </div>
      ) : (
        byDay(expenses, trip?.start_date).map((group) => (
          <section key={group.day} className="px-5 pt-4" aria-label={dayLabel(group.day, trip?.start_date)}>
            <h2 className="flex items-baseline border-b border-rule pb-1">
              <span className="flex-1 font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">{dayLabel(group.day, trip?.start_date).toUpperCase()}</span>
              <span className="font-mono text-sm text-ink-2 tabular-nums">{formatCents(group.total, book.currency)}</span>
            </h2>
            <ul className="flex flex-col divide-y divide-rule">
              {group.expenses.map((e) => (
                <ExpenseRow key={e.id} expense={e} book={book} />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="fixed right-5 bottom-[calc(72px+env(safe-area-inset-bottom))] z-10">
        <Link
          to={`/depenses/${book.id}/depense/nouvelle`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-accent-ink px-5 font-semibold text-surface shadow-lg hover:opacity-90"
        >
          <Plus size={18} aria-hidden="true" />
          Dépense
        </Link>
      </div>

      <BookSheet
        open={sheet !== null}
        book={sheet === 'edit' ? book : undefined}
        onClose={() => setSheet(null)}
        onSaved={(id) => {
          setSheet(null)
          navigate(id ? `/depenses/${id}` : '/depenses', { replace: true })
        }}
      />
    </div>
  )
}
