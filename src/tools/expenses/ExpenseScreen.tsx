import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useClient } from '@/core/client'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { isoDay } from '@/core/lib/day'
import { categories, categoryLabel, centsToInput, COMMON_CURRENCIES, convertCents, formatCents, parseCents, type Category } from '@/core/lib/money'
import { Button } from '@/core/ui/Button'
import { Field, SelectField, TextAreaField } from '@/core/ui/Field'
import { BookGate } from './components/BookGate'
import { Choice } from './components/Choice'
import { useExpenses } from './ExpensesProvider'
import { computeShares, splitByWeights, splitEqual, splitLabel, type Book, type ExpensesData, type Expense, type SplitMode } from './model'
import { fetchBooking, type BookingPrefill } from './queries'

const modes: SplitMode[] = ['equal', 'amounts', 'weights']
const rateDay = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Saisir ou modifier une dépense : `/depenses/:bookId/depense/nouvelle` (option `?reservation=`) ou `/depense/:expenseId`. */
export function ExpenseScreen() {
  const { expenseId } = useParams()
  const [params] = useSearchParams()
  const client = useClient()
  const bookingId = expenseId === 'nouvelle' ? params.get('reservation') : null
  const booking = useQuery({ queryKey: ['booking', bookingId], queryFn: () => fetchBooking(client, bookingId!), enabled: bookingId !== null })
  const title = expenseId === 'nouvelle' ? 'Nouvelle dépense' : 'Dépense'

  return (
    <BookGate title={title}>
      {(book, data) => {
        if (bookingId && booking.isPending) return <ScreenHeader title={title} back={`/depenses/${book.id}`} />
        // Une réservation déjà comptée rouvre sa dépense plutôt que d'en créer une seconde.
        const linked = bookingId ? data.expenses.find((e) => e.booking_id === bookingId) : undefined
        if (linked) return <Navigate to={`/depenses/${book.id}/depense/${linked.id}`} replace />
        const existing = expenseId === 'nouvelle' ? undefined : data.expenses.find((e) => e.id === expenseId && e.book_id === book.id)
        if (expenseId !== 'nouvelle' && !existing) return <Navigate to={`/depenses/${book.id}`} replace />
        return <ExpenseForm key={existing?.id ?? 'nouvelle'} book={book} data={data} existing={existing} booking={booking.data ?? null} />
      }}
    </BookGate>
  )
}

function ExpenseForm({ book, data, existing, booking }: { book: Book; data: ExpensesData; existing?: Expense; booking: BookingPrefill | null }) {
  const { saveExpense, removeExpense, rate } = useExpenses()
  const { members, me } = useHousehold()
  const navigate = useNavigate()
  const memberIds = members.map((m) => m.profile.id)
  const back = `/depenses/${book.id}`

  const initialAmount = existing?.amount_cents ?? (booking?.amount != null ? parseCents(booking.amount.toFixed(2)) : null)
  const [amount, setAmount] = useState(initialAmount ? centsToInput(initialAmount) : '')
  const [currency, setCurrency] = useState(existing?.currency ?? booking?.currency ?? book.currency)
  const [fx, setFx] = useState(existing && existing.currency !== book.currency ? String(existing.fx_rate).replace('.', ',') : '')
  const [fxState, setFxState] = useState<{ status: 'idle' | 'loading' | 'missing' } | { status: 'found'; date: string }>(() => ({
    status: !existing && (booking?.currency ?? book.currency) !== book.currency ? 'loading' : 'idle',
  }))
  const [label, setLabel] = useState(existing?.label ?? booking?.title ?? '')
  const [paidBy, setPaidBy] = useState(existing?.paid_by ?? me?.profile.id ?? memberIds[0])
  const [mode, setMode] = useState<SplitMode>(existing?.split_mode ?? 'equal')
  const [inputs, setInputs] = useState<Record<string, string>>(() => initialInputs(existing, data, memberIds))
  const [category, setCategory] = useState<Category>(existing?.category ?? booking?.category ?? 'food')
  const [spentOn, setSpentOn] = useState(existing?.spent_on ?? isoDay())
  const [note, setNote] = useState(existing?.note ?? '')
  const [confirming, setConfirming] = useState(false)

  const foreign = currency !== book.currency
  const wanted = useRef(currency)

  // Le taux est figé à la saisie (M15) : on ne le redemande que si la devise change.
  const lookup = (code: string) => {
    wanted.current = code
    void rate(code, book.currency).then((found) => {
      if (wanted.current !== code) return
      if (found) {
        setFx(String(found.rate).replace('.', ','))
        setFxState({ status: 'found', date: found.date })
      } else setFxState({ status: 'missing' })
    })
  }
  const changeCurrency = (code: string) => {
    setCurrency(code)
    wanted.current = code
    if (code === book.currency || (existing && existing.currency === code)) {
      setFxState({ status: 'idle' })
      if (existing && existing.currency === code) setFx(String(existing.fx_rate).replace('.', ','))
      return
    }
    setFxState({ status: 'loading' })
    lookup(code)
  }
  // Une réservation dans une autre devise demande le taux dès l'ouverture.
  useEffect(() => {
    if (fxState.status === 'loading') lookup(currency)
    // Une seule fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cents = parseCents(amount)
  const fxRate = foreign ? Number(fx.replace(',', '.')) : 1
  const fxValid = !foreign || (Number.isFinite(fxRate) && fxRate > 0 && fxRate < 1e9)
  const bookCents = cents !== null && fxValid ? convertCents(cents, fxRate) : null

  const values = memberIds.map((id) => ({
    user_id: id,
    value: mode === 'amounts' ? (parseCents(inputs[id] ?? '') ?? 0) : Number((inputs[id] ?? '').replace(',', '.')) || 0,
  }))
  const assigned = values.reduce((s, v) => s + v.value, 0)
  const splitError =
    cents === null || mode === 'equal'
      ? null
      : mode === 'amounts'
        ? assigned === cents
          ? null
          : assigned < cents
            ? `Reste à répartir : ${formatCents(cents - assigned, currency)}`
            : `Trop réparti de ${formatCents(assigned - cents, currency)}`
        : assigned > 0 && values.every((v) => v.value <= 9999)
          ? null
          : 'Donne au moins une part.'
  const invalid = cents === null || cents === 0 || label.trim() === '' || !fxValid || splitError !== null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (invalid || cents === null || bookCents === null) return
    const shares = computeShares(mode, bookCents, memberIds, values)
    saveExpense(
      {
        book_id: book.id,
        label: label.trim(),
        paid_by: paidBy,
        amount_cents: cents,
        currency,
        fx_rate: foreign ? fxRate : 1,
        spent_on: spentOn,
        category,
        split_mode: mode,
        note: note.trim() || null,
        booking_id: existing?.booking_id ?? booking?.id ?? null,
      },
      shares,
      existing,
    )
    navigate(back, { replace: true })
  }

  const currencies = [...new Set([book.currency, currency, ...COMMON_CURRENCIES])]
  const preview = cents !== null && mode === 'equal' ? splitEqual(cents, memberIds) : []
  const nameOf = (id: string) => members.find((m) => m.profile.id === id)?.profile.display_name ?? 'Ancien membre'

  return (
    <form onSubmit={submit} className="flex flex-col pb-10">
      <ScreenHeader title={existing ? 'Modifier la dépense' : 'Nouvelle dépense'} eyebrow={book.name} back={back} />
      <div className="flex flex-col gap-5 px-5 pt-2">
        <div className="grid grid-cols-[1fr_104px] gap-3">
          <Field label="Montant" inputMode="decimal" autoFocus={!existing} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="font-mono text-xl" />
          <SelectField label="Devise" value={currency} onChange={(e) => changeCurrency(e.target.value)} options={currencies.map((c) => ({ value: c, label: c }))} className="font-mono" />
        </div>
        {foreign ? (
          <div className="-mt-2 flex flex-col gap-2 rounded-md bg-accent-tint px-4 py-3 text-accent-ink">
            <p className="text-sm">
              {bookCents !== null ? (
                <>
                  ≈ <b className="font-mono font-semibold tabular-nums">{formatCents(bookCents, book.currency)}</b>
                </>
              ) : (
                'Saisis le montant et le taux.'
              )}
              {fxState.status === 'found' ? ` · taux du ${rateDay.format(new Date(`${fxState.date}T00:00:00Z`))}` : null}
              {fxState.status === 'loading' ? ' · recherche du taux du jour…' : null}
            </p>
            {fxState.status === 'missing' ? <p className="text-sm">Taux du jour indisponible : saisis-le.</p> : null}
            <Field label={`Taux : 1 ${currency} = ? ${book.currency}`} inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="1,52" className="bg-surface font-mono" />
          </div>
        ) : null}

        <Field label="Quoi" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Dîner au Time Out" maxLength={120} />

        <Choice label="Payé par" value={paidBy} onChange={setPaidBy} options={members.map((m) => ({ value: m.profile.id, label: m.profile.display_name }))} wrap />

        <div className="flex flex-col gap-3">
          <Choice label="Partage" value={mode} onChange={setMode} options={modes.map((m) => ({ value: m, label: splitLabel[m] }))} />
          {mode === 'equal' ? (
            <p className="text-sm text-ink-2">
              {preview.length > 0 ? preview.map((p) => `${nameOf(p.key)} ${formatCents(p.cents, currency)}`).join(' · ') : 'Moitié-moitié entre vous.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {members.map((m) => (
                <Field
                  key={m.profile.id}
                  label={mode === 'amounts' ? `${m.profile.display_name} (${currency})` : `Parts ${m.profile.display_name}`}
                  inputMode="decimal"
                  value={inputs[m.profile.id] ?? ''}
                  onChange={(e) => setInputs({ ...inputs, [m.profile.id]: e.target.value })}
                  placeholder={mode === 'amounts' ? '0,00' : '1'}
                  className="font-mono"
                />
              ))}
            </div>
          )}
          {splitError ? (
            <p role="alert" className="rounded-md bg-warn-tint px-4 py-2 text-sm text-warn">
              {splitError}
            </p>
          ) : null}
        </div>

        <Choice label="Catégorie" value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: categoryLabel[c] }))} wrap />
        <Field label="Date" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value || isoDay())} />
        <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={invalid}>
            Enregistrer
          </Button>
          {existing ? (
            <Button
              variant="ghost"
              className="text-bad hover:bg-bad-tint"
              onClick={() => {
                if (!confirming) return setConfirming(true)
                removeExpense(existing)
                navigate(back, { replace: true })
              }}
            >
              {confirming ? 'Confirmer la suppression' : 'Supprimer la dépense'}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  )
}

/** Les champs « Montants » et « Parts » d'une dépense existante, retrouvés depuis ses parts. */
function initialInputs(existing: Expense | undefined, data: ExpensesData, memberIds: string[]): Record<string, string> {
  if (!existing || existing.split_mode === 'equal') return {}
  const shares = data.shares.filter((s) => s.expense_id === existing.id)
  if (existing.split_mode === 'weights') {
    return Object.fromEntries(shares.map((s) => [s.user_id, String(s.weight ?? '').replace('.', ',')]))
  }
  // Les parts sont en devise du carnet : on les ramène au montant saisi, au prorata (exact en même devise).
  const back = splitByWeights(existing.amount_cents, memberIds.map((id) => ({ key: id, weight: shares.find((s) => s.user_id === id)?.share_cents ?? 0 })))
  return Object.fromEntries(back.map((b) => [b.key, centsToInput(b.cents)]))
}
