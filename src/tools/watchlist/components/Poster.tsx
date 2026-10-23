import { Clapperboard } from 'lucide-react'
import { cn } from '@/core/lib/cn'
import { posterUrl } from '../model'

/** Affiche au format 2:3 ; sans fiche TMDB, un aplat avec le titre. */
export function Poster({ path, title, size = 'w342', className }: { path: string | null | undefined; title: string; size?: 'w185' | 'w342' | 'w500'; className?: string }) {
  const url = posterUrl(path, size)
  return (
    <div aria-hidden="true" className={cn('relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface-2', className)}>
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-ink-3">
          <Clapperboard size={22} aria-hidden="true" />
          <span className="font-display text-base leading-tight text-ink-2">{title}</span>
        </div>
      )}
    </div>
  )
}
