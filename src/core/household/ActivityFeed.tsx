import { useClient } from '../client'
import { relativeTime } from '../lib/time'
import { useLiveQuery } from '../sync/useSync'
import { Avatar } from '../ui/Avatar'
import { describeActivity } from './activity'
import { fetchRecentActivity } from './queries'
import { useHousehold } from './useHousehold'

/** Fil des dernières actions de l'espace (« Auriane a coché Lait 2 % · il y a 2 min »). */
export function ActivityFeed({ limit = 5, toolKey }: { limit?: number; toolKey?: string }) {
  const client = useClient()
  const { household, memberById } = useHousehold()
  const query = useLiveQuery({
    tables: ['activity_log'],
    queryKey: ['activity', household.id, limit, toolKey ?? 'tout'],
    queryFn: () => fetchRecentActivity(client, household.id, limit, toolKey),
  })

  if (query.isPending) return <p className="text-ink-3">Chargement de l’activité…</p>
  if (query.isError) return <p className="text-ink-3">L’activité ne s’est pas chargée.</p>
  if (query.data.length === 0)
    return <p className="rounded-lg bg-surface-2 px-4 py-4 text-ink-2">Rien pour l’instant. Ce que vous faites tous les deux apparaîtra ici.</p>

  return (
    <ul className="flex flex-col gap-1">
      {query.data.map((entry) => {
        const actor = memberById(entry.actor_id)
        const name = actor?.profile.display_name ?? 'Quelqu’un'
        return (
          <li key={entry.id} className="flex min-h-12 items-start gap-3 py-2">
            <Avatar name={name} chosenInitials={actor?.profile.initials} slot={actor?.slot ?? 'other'} />
            <p className="flex-1 text-ink-2">
              <b className="font-semibold text-ink">{name}</b> {describeActivity(entry)}
            </p>
            <time dateTime={entry.created_at} className="font-mono text-xs whitespace-nowrap text-ink-3">
              {relativeTime(entry.created_at)}
            </time>
          </li>
        )
      })}
    </ul>
  )
}
