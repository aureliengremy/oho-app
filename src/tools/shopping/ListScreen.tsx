import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Ellipsis, Plus, ShoppingCart } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { ConnectionBanner, LiveBadge } from '@/core/sync/ConnectionStatus'
import { cn } from '@/core/lib/cn'
import { relativeTime } from '@/core/lib/time'
import { Button } from '@/core/ui/Button'
import { ItemRow } from '@/core/checklist/ItemRow'
import { ItemSheet } from './components/ItemSheet'
import { ListOptionsSheet, NewListSheet } from './components/ListSheets'
import { describeAdd, QuickAdd } from './components/QuickAdd'
import { cartItems, frequent, pickList, remainingByList, sectionsFor, type Item, type ShoppingData, type ShoppingList } from './model'
import { labelKey } from '@/core/checklist/parse'
import { useShopping } from './ShoppingProvider'

const LAST_LIST_KEY = 'oho.courses.liste'

function readLastList(): string | null {
  try {
    return localStorage.getItem(LAST_LIST_KEY)
  } catch {
    return null
  }
}

function rememberList(id: string) {
  try {
    localStorage.setItem(LAST_LIST_KEY, id)
  } catch {
    // Stockage indisponible (navigation privée) : on rouvrira la liste par défaut.
  }
}

/** L'écran Courses : la liste choisie, ses rayons, le panier et l'ajout rapide. */
export function ListScreen() {
  const { data, isPending, isError, refetch } = useShopping()
  const { listId } = useParams()
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  if (isPending) {
    return (
      <>
        <ScreenHeader title="Courses" />
        <p role="status" className="px-5 py-6 font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
          CHARGEMENT DES LISTES…
        </p>
      </>
    )
  }
  if (isError || !data) {
    return (
      <>
        <ScreenHeader title="Courses" />
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          <p className="text-ink-2">Les listes ne se sont pas chargées. Vérifie la connexion puis réessaie.</p>
          <Button onClick={refetch}>Réessayer</Button>
        </div>
      </>
    )
  }

  const list = pickList(data.lists, listId ?? readLastList())
  if (!list) {
    return (
      <>
        <ScreenHeader title="Courses" />
        <div className="flex flex-col items-start gap-4 px-5 py-6">
          <p className="text-ink-2">Aucune liste pour l’instant. Commencez par l’épicerie.</p>
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" />
            Nouvelle liste
          </Button>
        </div>
        <NewListSheet
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            navigate(`/courses/liste/${id}`, { replace: true })
          }}
        />
      </>
    )
  }
  return <ListView key={list.id} list={list} data={data} />
}

function ListView({ list, data }: { list: ShoppingList; data: ShoppingData }) {
  const { catalog, pending, updatedAt, error, dismissError, addEntries, toggle, clearChecked } = useShopping()
  const { memberById } = useHousehold()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Item | null>(null)
  const [options, setOptions] = useState(false)
  const [creating, setCreating] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [announce, setAnnounce] = useState('')

  useEffect(() => rememberList(list.id), [list.id])

  const items = data.items.filter((i) => i.checklist_id === list.id)
  const toBuy = items.filter((i) => !i.checked)
  const cart = cartItems(items)
  const sections = sectionsFor(toBuy, data.categories)
  const counts = remainingByList(data.items)
  const exclude = new Set(toBuy.map((i) => labelKey(i.label)))
  const suggestions = toBuy.length === 0 ? frequent(catalog, exclude) : []
  const lastChecked = cart.length === 0 ? null : cart[0]

  const add = (entries: Parameters<typeof addEntries>[1]) => setAnnounce(describeAdd(addEntries(list.id, entries)))

  return (
    <div className="flex min-h-[calc(100dvh-56px-env(safe-area-inset-bottom))] flex-col">
      <ScreenHeader
        title={list.name}
        actions={
          <>
          <LiveBadge />
          <button
            type="button"
            onClick={() => setOptions(true)}
            aria-label="Options de la liste"
            className="flex size-11 items-center justify-center rounded-pill text-ink hover:bg-surface-2"
          >
            <Ellipsis size={22} />
          </button>
          </>
        }
      />
      <ConnectionBanner updatedAt={updatedAt} />

      <nav aria-label="Listes de courses" className="flex gap-2 overflow-x-auto px-5 pt-1 pb-2">
        {data.lists.map((l) => (
          <Link
            key={l.id}
            to={`/courses/liste/${l.id}`}
            replace
            aria-current={l.id === list.id ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-none items-center gap-2 rounded-pill border px-4 text-[15px] font-semibold',
              l.id === list.id ? 'border-accent-ink bg-accent-tint text-accent-ink' : 'border-rule text-ink-2',
            )}
          >
            {l.name}
            <span className="font-mono text-xs tabular-nums">{counts.get(l.id) ?? 0}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Nouvelle liste"
          className="flex size-11 flex-none items-center justify-center rounded-pill border border-rule text-ink-2"
        >
          <Plus size={18} />
        </button>
      </nav>

      {error ? (
        <div role="alert" className="mx-5 mb-2 flex items-center gap-3 rounded-md bg-bad-tint px-4 py-3 text-bad">
          <p className="flex-1 text-sm">{error}</p>
          <button type="button" onClick={dismissError} className="min-h-11 px-2 text-sm font-semibold">
            Fermer
          </button>
        </div>
      ) : null}

      <div className="flex-1 pb-4">
        {toBuy.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent-ink">
              <ShoppingCart size={24} aria-hidden="true" />
            </span>
            <h2 className="font-display text-xl font-semibold text-ink">Rien à acheter</h2>
            <p className="text-ink-2">
              {suggestions.length > 0
                ? 'Vos achats habituels, en un geste :'
                : 'Ajoutez des articles avec le champ du bas, séparés par des virgules.'}
            </p>
            {suggestions.length > 0 ? (
              <ul className="flex flex-wrap justify-center gap-2" aria-label="Achats fréquents">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => add([{ label: s.label, quantity: null }])}
                      className="flex min-h-11 items-center gap-1.5 rounded-pill border border-rule px-4 text-ink"
                    >
                      <Plus size={14} aria-hidden="true" />
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.category?.id ?? 'sans-rayon'} aria-label={section.category?.name ?? 'Sans rayon'}>
              <h2 className="px-4 pt-3.5 pb-1 font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
                {(section.category?.name ?? 'Sans rayon').toUpperCase()}
              </h2>
              <ul>
                {section.items.map((item) => (
                  <ItemRow key={item.id} item={item} pending={pending.has(item.id)} onToggle={() => toggle(item)} onEdit={() => setEditing(item)} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 flex flex-col">
        {cart.length > 0 ? (
          <div className="bg-surface-2">
            <div className="flex min-h-14 items-center gap-2 pr-2 pl-2">
              <button
                type="button"
                onClick={() => setCartOpen((o) => !o)}
                aria-expanded={cartOpen}
                aria-controls="panier"
                className="flex min-h-12 flex-1 items-center gap-2 rounded-md px-2 text-left text-[15px] text-ink-2"
              >
                {cartOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
                <span>
                  <b className="font-semibold text-ink">Dans le panier</b> · {cart.length}
                </span>
              </button>
              <Button
                variant="secondary"
                className="min-h-11 bg-surface px-4 text-sm"
                onClick={() => {
                  clearChecked(list.id)
                  setCartOpen(false)
                  setAnnounce('Panier vidé')
                }}
              >
                Vider les cochés
              </Button>
            </div>
            {cartOpen ? (
              <div id="panier" className="max-h-[40dvh] overflow-y-auto pb-2">
                <ul aria-label="Dans le panier">
                  {cart.map((item) => (
                    <ItemRow key={item.id} item={item} pending={pending.has(item.id)} onToggle={() => toggle(item)} onEdit={() => setEditing(item)} />
                  ))}
                </ul>
                {lastChecked?.checked_at ? (
                  <p className="px-4 pt-1 text-sm text-ink-3">
                    Dernier coché par {memberById(lastChecked.checked_by)?.profile.display_name ?? 'quelqu’un'} ·{' '}
                    {relativeTime(lastChecked.checked_at)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <QuickAdd
          catalog={catalog}
          categories={data.categories}
          exclude={exclude}
          placeholder={list.is_default ? 'Ajouter : lait, œufs, pain…' : 'Ajouter un article…'}
          onAdd={add}
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <ItemSheet item={editing} categories={data.categories} onClose={() => setEditing(null)} />
      <ListOptionsSheet
        list={list}
        open={options}
        onClose={() => setOptions(false)}
        onRemoved={() => {
          setOptions(false)
          navigate('/courses', { replace: true })
        }}
      />
      <NewListSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false)
          navigate(`/courses/liste/${id}`, { replace: true })
        }}
      />
    </div>
  )
}
