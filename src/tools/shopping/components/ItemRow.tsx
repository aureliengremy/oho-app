import { Check } from 'lucide-react'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { cn } from '@/core/lib/cn'
import { Avatar } from '@/core/ui/Avatar'
import type { Item } from '../model'
import { formatQuantity } from '../parse'

/** Une ligne de 52 px : case de 48 px, libellé et note, quantité et initiales de qui l'a ajouté (ou « En attente »). */
export function ItemRow({
  item,
  pending = false,
  onToggle,
  onEdit,
}: {
  item: Item
  /** Une écriture attend le réseau : « En attente » à la place des initiales. */
  pending?: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const { memberById } = useHousehold()
  const author = memberById(item.created_by)
  const quantity = formatQuantity(item.quantity)
  return (
    <li className="grid min-h-[52px] grid-cols-[48px_1fr_auto] items-center gap-x-1 pr-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={item.label}
        onClick={onToggle}
        className="group flex size-12 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          className={cn(
            'flex size-[22px] items-center justify-center rounded-[7px] border-2',
            item.checked ? 'border-accent-ink bg-accent-ink text-surface' : 'border-rule-strong bg-surface',
          )}
        >
          {item.checked ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Modifier ${item.label}`}
        className="flex min-h-11 min-w-0 flex-col justify-center py-1 text-left"
      >
        <span
          className={cn(
            'text-[16.5px] leading-snug',
            item.checked ? 'text-ink-3 line-through decoration-ink-4' : 'text-ink',
          )}
        >
          {item.label}
        </span>
        {item.note ? <span className="text-sm text-ink-3">{item.note}</span> : null}
      </button>
      <div className="flex items-center gap-2.5">
        {quantity ? <span className="font-mono text-[13px] text-ink-2 tabular-nums">{quantity}</span> : null}
        {pending ? (
          <span className="font-mono text-[12.5px] font-semibold tracking-[0.06em] text-warn uppercase">En attente</span>
        ) : author ? (
          <Avatar name={author.profile.display_name} chosenInitials={author.profile.initials} slot={author.slot} />
        ) : null}
      </div>
    </li>
  )
}
