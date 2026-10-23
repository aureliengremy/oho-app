import { useState, type FormEvent } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useClient } from '@/core/client'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { formatCents } from '@/core/lib/money'
import { useLiveQuery } from '@/core/sync/SyncProvider'
import { Button } from '@/core/ui/Button'
import { Field, SelectField } from '@/core/ui/Field'
import { Sheet } from '@/core/ui/Sheet'
import { budgetCategoryLabel, formatMoney, type BudgetCategory, type BudgetLine, type Trip, type TripsData } from '../model'
import { fetchTripSpent } from '../queries'
import { useTrips } from '../TripsProvider'

const categories = Object.keys(budgetCategoryLabel) as BudgetCategory[]

/** Onglet Budget : le prévu par poste (P3) et le dépensé du carnet de dépenses lié (M11). */
export function BudgetTab({ trip, data }: { trip: Trip; data: TripsData }) {
  const [editing, setEditing] = useState<BudgetLine | 'new' | null>(null)
  const client = useClient()
  const { household, activations } = useHousehold()
  const expensesOn = activations.some((a) => a.tool_key === 'expenses' && a.enabled)
  const spent = useLiveQuery({
    tables: ['expense', 'expense_book'],
    queryKey: ['trip-spent', household.id, trip.id],
    queryFn: () => fetchTripSpent(client, household.id, trip.id),
    enabled: expensesOn,
  }).data
  const lines = data.budget.filter((b) => b.trip_id === trip.id)
  const totals = new Map<string, number>()
  for (const l of lines) if (l.planned_amount !== null) totals.set(l.currency, (totals.get(l.currency) ?? 0) + l.planned_amount)
  const free = categories.filter((c) => !lines.some((l) => l.category === c))

  return (
    <div className="flex flex-col gap-3 px-5 pt-2">
      {lines.length === 0 ? (
        <p className="py-4 text-center text-ink-2">Combien prévoir pour le transport, le logement, les repas… Le dépensé vient du carnet de dépenses du voyage.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-rule rounded-lg bg-surface-2" aria-label="Budget prévu">
            {lines.map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => setEditing(line)}
                  aria-label={`Modifier ${budgetCategoryLabel[line.category]}`}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
                >
                  <span className="flex-1 text-ink">{budgetCategoryLabel[line.category]}</span>
                  <span className="flex flex-col items-end">
                    <span className="font-mono text-ink tabular-nums">
                      {line.planned_amount === null ? '—' : formatMoney(line.planned_amount, line.currency)}
                    </span>
                    {spent ? (
                      <span className="font-mono text-sm text-ink-3 tabular-nums">
                        dépensé {formatCents(spent.byCategory[line.category] ?? 0, spent.currency)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between px-1">
            <span className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">Total prévu</span>
            <span className="flex flex-col items-end font-mono font-semibold text-ink tabular-nums">
              {[...totals].map(([currency, total]) => (
                <span key={currency}>{formatMoney(total, currency)}</span>
              ))}
            </span>
          </div>
        </>
      )}
      {expensesOn ? (
        <Link to={`/depenses/voyage/${trip.id}`} className="flex min-h-14 items-center gap-3 rounded-lg bg-surface-2 px-4">
          <span className="flex-1 text-ink">{spent ? 'Carnet lié' : 'Suivre les dépenses du voyage'}</span>
          {spent ? <span className="font-mono text-ink tabular-nums">{formatCents(spent.total, spent.currency)}</span> : null}
          <span className="flex items-center gap-1 text-sm font-semibold text-accent-ink">
            {spent ? 'Ouvrir le carnet' : 'Ouvrir un carnet'}
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </Link>
      ) : null}
      {free.length > 0 ? (
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Plus size={18} aria-hidden="true" />
          Ajouter un poste
        </Button>
      ) : null}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' || !editing ? 'Nouveau poste' : budgetCategoryLabel[editing.category]} eyebrow="Budget">
        {editing ? (
          <BudgetForm
            key={editing === 'new' ? 'nouveau' : editing.id}
            tripId={trip.id}
            line={editing === 'new' ? undefined : editing}
            free={free}
            currency={lines[0]?.currency ?? 'CAD'}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
    </div>
  )
}

function BudgetForm({
  tripId,
  line,
  free,
  currency: defaultCurrency,
  onDone,
}: {
  tripId: string
  line?: BudgetLine
  free: BudgetCategory[]
  currency: string
  onDone: () => void
}) {
  const { saveBudgetLine, removeBudgetLine } = useTrips()
  const [category, setCategory] = useState<BudgetCategory>(line?.category ?? free[0])
  const [amount, setAmount] = useState(line?.planned_amount?.toString().replace('.', ',') ?? '')
  const [currency, setCurrency] = useState(line?.currency ?? defaultCurrency)
  const parsed = amount.trim() === '' ? null : Number(amount.replace(/\s/g, '').replace(',', '.'))
  const invalid = (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) || !/^[A-Z]{3}$/.test(currency)
  const options = (line ? [line.category, ...free] : free).map((c) => ({ value: c, label: budgetCategoryLabel[c] }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (invalid) return
    saveBudgetLine(tripId, { category, planned_amount: parsed, currency }, line)
    onDone()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SelectField label="Poste" value={category} onChange={(e) => setCategory(e.target.value as BudgetCategory)} options={options} />
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Montant prévu" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1 500" />
        <Field label="Devise" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" />
      </div>
      {invalid ? (
        <p role="alert" className="rounded-md bg-bad-tint px-4 py-2 text-sm text-bad">
          Un montant positif et une devise en trois lettres (CAD, EUR…).
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={invalid}>
          Enregistrer
        </Button>
        {line ? (
          <Button
            variant="ghost"
            className="text-bad hover:bg-bad-tint"
            onClick={() => {
              removeBudgetLine(line)
              onDone()
            }}
          >
            Supprimer le poste
          </Button>
        ) : null}
      </div>
    </form>
  )
}
