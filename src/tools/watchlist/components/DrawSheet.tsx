import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { relativeTime } from '@/core/lib/time'
import { Button } from '@/core/ui/Button'
import { Sheet } from '@/core/ui/Sheet'
import { describeMedia, draw, formatRuntime, runtimeOf, type WatchItem } from '../model'
import { useWatch } from '../WatchProvider'
import { Poster } from './Poster'

/** Deux relances, pour garder le jeu honnête. */
const RELAUNCHES = 2

/** Le tirage au sort : une seule réponse, deux relances, « On regarde ça » passe le titre en cours. */
export function DrawSheet({ open, pool, label, onClose }: { open: boolean; pool: WatchItem[]; label: string; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Ce soir, ce sera…" eyebrow={`Tirage parmi ${pool.length} titres · ${label}`}>
      {open ? <Draw pool={pool} onDone={onClose} /> : null}
    </Sheet>
  )
}

function Draw({ pool, onDone }: { pool: WatchItem[]; onDone: () => void }) {
  const { data, updateItem } = useWatch()
  const { memberById } = useHousehold()
  const navigate = useNavigate()
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [pick, setPick] = useState<WatchItem | null>(() => draw(pool, new Set()))
  const left = RELAUNCHES - seen.size
  if (!pick) return <p className="text-ink-2">Rien à tirer pour l’instant.</p>

  const media = data?.media.find((m) => m.id === pick.media_id)
  const platform = data?.platforms.find((p) => p.id === pick.platform_id)
  const suggester = memberById(pick.suggested_by)

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Poster path={media?.poster_path} title={pick.title} size="w500" className="w-44" />
      <div className="flex flex-col gap-1">
        <p role="status" aria-live="polite" className="font-display text-2xl font-semibold text-ink">
          {pick.title}
        </p>
        <p className="text-sm text-ink-3">{[describeMedia(pick, media), formatRuntime(runtimeOf(pick, media)), platform?.name].filter(Boolean).join(' · ')}</p>
        {suggester ? (
          <p className="text-sm text-ink-3">
            Proposé par {suggester.profile.display_name} {relativeTime(pick.created_at)}
          </p>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button
          onClick={() => {
            if (pick.status !== 'watching') updateItem(pick, { status: 'watching' })
            onDone()
            navigate(`/a-regarder/${pick.id}`)
          }}
        >
          On regarde ça
        </Button>
        <Button
          variant="secondary"
          disabled={left <= 0 || pool.length < 2}
          onClick={() => {
            const nextSeen = new Set(seen).add(pick.id)
            setSeen(nextSeen)
            setPick(draw(pool, nextSeen))
          }}
        >
          Relancer · {left > 0 ? `${left} restante${left > 1 ? 's' : ''}` : 'plus de relance'}
        </Button>
      </div>
    </div>
  )
}
