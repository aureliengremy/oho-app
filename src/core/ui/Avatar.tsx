import { cn } from '../lib/cn'
import { initials } from './initials'

const slotColor = { a: 'border-person-a', b: 'border-person-b', other: 'border-ink-4' } as const

/** Avatar cerclé de la couleur de la personne, toujours avec ses initiales (décision D2). */
export function Avatar({
  name,
  chosenInitials,
  slot,
  size = 'sm',
  className,
}: {
  name: string
  chosenInitials?: string | null
  slot: 'a' | 'b' | 'other'
  size?: 'sm' | 'lg'
  className?: string
}) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex flex-none items-center justify-center rounded-full border-2 bg-surface font-bold text-ink',
        size === 'sm' ? 'size-7 text-[10.5px]' : 'size-10 text-sm',
        slotColor[slot],
        className,
      )}
    >
      {initials(name, chosenInitials)}
    </span>
  )
}
