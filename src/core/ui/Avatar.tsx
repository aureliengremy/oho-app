import { cn } from '../lib/cn'
import { initials } from './initials'

const slotColor = { a: 'border-person-a', b: 'border-person-b', other: 'border-ink-4' } as const

/**
 * Avatar cerclé de la couleur de la personne (décision D2) : son emoji s'il en a choisi un
 * dans les Réglages, sinon ses initiales.
 */
export function Avatar({
  name,
  chosenInitials,
  emoji,
  slot,
  size = 'sm',
  className,
}: {
  name: string
  chosenInitials?: string | null
  emoji?: string | null
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
      {emoji ? (
        <span role="img" aria-label={name} className="text-[1.4em] leading-none">
          {emoji}
        </span>
      ) : (
        initials(name, chosenInitials)
      )}
    </span>
  )
}
