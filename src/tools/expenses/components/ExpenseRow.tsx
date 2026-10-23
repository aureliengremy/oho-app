import { Link } from 'react-router'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { categoryLabel, formatCents } from '@/core/lib/money'
import { Avatar } from '@/core/ui/Avatar'
import type { Book, Expense } from '../model'
import { CategoryIcon } from './CategoryIcon'

/** Une dépense : qui a payé, la catégorie, le montant saisi puis sa conversion en devise du carnet. */
export function ExpenseRow({ expense, book }: { expense: Expense; book: Book }) {
  const { memberById } = useHousehold()
  const payer = memberById(expense.paid_by)
  const name = payer?.profile.display_name ?? 'Ancien membre'
  const amount = formatCents(expense.amount_cents, expense.currency)
  const converted = expense.currency !== book.currency ? formatCents(expense.book_amount_cents ?? 0, book.currency) : null
  return (
    <li>
      <Link
        to={`/depenses/${book.id}/depense/${expense.id}`}
        aria-label={`${expense.label}, ${amount}${converted ? ` (${converted})` : ''}, payé par ${name}`}
        className="flex min-h-16 items-center gap-3 py-2"
      >
        <CategoryIcon category={expense.category} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-ink">{expense.label}</span>
          <span className="flex items-center gap-1.5 text-sm text-ink-2" aria-hidden="true">
            <Avatar name={name} chosenInitials={payer?.profile.initials} slot={payer?.slot ?? 'other'} className="size-5 border text-[8px]" />
            {name} · {categoryLabel[expense.category]}
          </span>
        </span>
        <span className="flex flex-col items-end" aria-hidden="true">
          <b className="font-mono font-semibold text-ink tabular-nums">{amount}</b>
          {converted ? <span className="font-mono text-sm text-ink-3 tabular-nums">{converted}</span> : null}
        </span>
      </Link>
    </li>
  )
}
