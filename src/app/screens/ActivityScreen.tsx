import { useSearchParams } from 'react-router'
import { ActivityFeed } from '@/core/household/ActivityFeed'
import { useHousehold } from '@/core/household/useHousehold'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { activeTools } from '@/tools/registry'

/** Le journal complet, filtrable par outil (`/activite?outil=shopping`). */
export function ActivityScreen() {
  const { activations } = useHousehold()
  const [params, setParams] = useSearchParams()
  const tools = activeTools(activations)
  const selected = tools.find((t) => t.key === params.get('outil'))?.key
  const filters = [{ key: undefined, label: 'Tout' }, ...tools.map((t) => ({ key: t.key, label: t.label }))]

  return (
    <>
      <ScreenHeader title="Activité" back />
      {tools.length > 1 || selected ? (
        <div role="group" aria-label="Filtrer par outil" className="flex gap-2 overflow-x-auto px-5 pb-3">
          {filters.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={selected === f.key}
              onClick={() => setParams(f.key ? { outil: f.key } : {}, { replace: true })}
              className={cn(
                'flex min-h-11 flex-none items-center rounded-pill border px-4 text-[15px] font-semibold',
                selected === f.key ? 'border-accent-ink bg-accent-tint text-accent-ink' : 'border-rule text-ink-2',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="px-5 pb-8">
        <ActivityFeed limit={50} toolKey={selected} />
      </div>
    </>
  )
}
