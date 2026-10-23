import { X } from 'lucide-react'
import { cn } from '@/core/lib/cn'
import { Sheet } from '@/core/ui/Sheet'
import { useWatch } from '../WatchProvider'
import { AddBar } from '@/core/ui/AddBar'

/** Nos plateformes : celles où l'on est abonnés servent au filtre « ce soir ». */
export function PlatformsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addPlatform, updatePlatform, removePlatform } = useWatch()
  return (
    <Sheet open={open} onClose={onClose} title="Nos plateformes" eyebrow="À regarder">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">Le filtre « Ce soir » ne garde que les titres des plateformes où vous êtes abonnés.</p>
        <ul className="flex flex-col gap-2">
          {(data?.platforms ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-lg bg-surface-2 pl-1">
              <button
                type="button"
                role="switch"
                aria-checked={p.is_subscribed}
                aria-label={`Abonnés à ${p.name}`}
                onClick={() => updatePlatform(p, { is_subscribed: !p.is_subscribed })}
                className="flex min-h-14 flex-1 items-center gap-3 px-3 text-left"
              >
                <span className="flex-1 font-semibold text-ink">{p.name}</span>
                <span className="text-sm text-ink-3">{p.is_subscribed ? 'Abonnés' : 'Pas abonnés'}</span>
                <span className={cn('flex h-7 w-12 items-center rounded-pill p-1', p.is_subscribed ? 'bg-accent-ink' : 'bg-rule-strong')} aria-hidden="true">
                  <span className={cn('size-5 rounded-pill bg-surface transition-transform', p.is_subscribed ? 'translate-x-5' : null)} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => removePlatform(p)}
                aria-label={`Retirer ${p.name}`}
                className="flex size-11 flex-none items-center justify-center rounded-md text-ink-3 hover:text-bad"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <AddBar className="px-0" label="Nouvelle plateforme" placeholder="Netflix, Crave, Tou.tv…" onAdd={addPlatform} />
      </div>
    </Sheet>
  )
}
