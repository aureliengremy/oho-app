import { Navigate, Route, Routes, useNavigate } from 'react-router'
import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { isoDay } from '@/core/lib/day'
import { Button } from '@/core/ui/Button'
import { BalancesScreen } from './BalancesScreen'
import { BookScreen } from './BookScreen'
import { BookSheet } from './components/BookSheet'
import { ExpenseScreen } from './ExpenseScreen'
import { ExpensesProvider } from './ExpensesProvider'
import { useExpenses } from './useExpenses'
import { defaultBook } from './model'
import { StatsScreen } from './StatsScreen'
import { TripBookScreen } from './TripBookScreen'

/**
 * Outil Dépenses (lot 13) : `/depenses/:bookId`, `/depenses/:bookId/depense/:expenseId|nouvelle`,
 * `/depenses/:bookId/soldes`, `/depenses/:bookId/stats` et `/depenses/voyage/:tripId`.
 */
export default function ExpensesTool() {
  return (
    <ExpensesProvider>
      <Routes>
        <Route index element={<Start />} />
        <Route path="voyage/:tripId" element={<TripBookScreen />} />
        <Route path=":bookId" element={<BookScreen />} />
        <Route path=":bookId/depense/:expenseId" element={<ExpenseScreen />} />
        <Route path=":bookId/soldes" element={<BalancesScreen />} />
        <Route path=":bookId/stats" element={<StatsScreen />} />
        <Route path="*" element={<Navigate to="/depenses" replace />} />
      </Routes>
    </ExpensesProvider>
  )
}

/** `/depenses` : ouvre le carnet du voyage en cours, sinon le premier ; propose d'en créer un s'il n'y en a aucun. */
function Start() {
  const { data, isPending, isError, refetch } = useExpenses()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const book = data ? defaultBook(data, isoDay()) : undefined
  if (book) return <Navigate to={`/depenses/${book.id}`} replace />
  return (
    <>
      <ScreenHeader title="Dépenses" />
      {isPending ? (
        <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
          Chargement des dépenses…
        </p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          <p className="text-ink-2">Les dépenses ne se sont pas chargées. Vérifie la connexion puis réessaie.</p>
          <Button onClick={refetch}>Réessayer</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent-ink">
            <Wallet size={24} aria-hidden="true" />
          </span>
          <h2 className="font-display text-xl font-semibold text-ink">Aucun carnet</h2>
          <p className="text-ink-2">Un carnet Quotidien pour les dépenses de tous les jours, un par voyage si besoin.</p>
          <Button onClick={() => setCreating(true)}>Créer un carnet</Button>
        </div>
      )}
      <BookSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => {
          setCreating(false)
          if (id) navigate(`/depenses/${id}`, { replace: true })
        }}
      />
    </>
  )
}
