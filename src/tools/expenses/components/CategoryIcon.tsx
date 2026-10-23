import { BedDouble, Receipt, ShoppingBasket, Ticket, TramFront, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { Category } from '@/core/lib/money'

const icons: Record<Category, LucideIcon> = {
  transport: TramFront,
  lodging: BedDouble,
  food: UtensilsCrossed,
  activity: Ticket,
  shopping: ShoppingBasket,
  other: Receipt,
}

export function CategoryIcon({ category }: { category: Category }) {
  const Icon = icons[category]
  return (
    <span className="flex size-10 flex-none items-center justify-center rounded-md bg-accent-tint text-accent-ink" aria-hidden="true">
      <Icon size={18} />
    </span>
  )
}
