import { useState, type ReactNode } from 'react'
import { BellRing, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { cn } from '@/core/lib/cn'
import { decodeKey, pushConfig } from '@/core/push/push'
import { useLiveQuery } from '@/core/sync/SyncProvider'
import { Button } from '@/core/ui/Button'
import { activeTools } from '@/tools/registry'

const digestChoices = [
  { value: 0, label: 'Tout de suite' },
  { value: 5, label: 'Regroupées sur 5 min' },
  { value: 15, label: 'Regroupées sur 15 min' },
  { value: 60, label: 'Regroupées sur 1 h' },
]

const heading = 'font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3'

/**
 * Réglages des notifications push (lot 10). La permission n'est demandée que sur un geste
 * explicite (« Activer sur ce téléphone »), jamais à l'ouverture de l'app.
 */
export function NotificationsSection() {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household, me, members, activations } = useHousehold()
  const { platform, vapidKey } = pushConfig
  const myId = me?.profile.id ?? ''
  const support = platform.support()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const other = members.find((m) => m.profile.id !== myId)?.profile.display_name ?? 'l’autre'

  const device = useQuery({ queryKey: ['push-device'], queryFn: () => platform.current(), enabled: support === 'ok' })
  const devices = useQuery({
    queryKey: ['push-devices', myId],
    queryFn: async () => {
      const { data, error } = await client.from('push_subscription').select('id, endpoint, user_agent').eq('user_id', myId)
      if (error) throw error
      return data ?? []
    },
  })
  const prefKey = ['notification-pref', household.id, myId] as const
  const prefs = useLiveQuery({
    tables: ['notification_pref'],
    queryKey: prefKey,
    queryFn: async () => {
      const { data, error } = await client.from('notification_pref').select('*').eq('household_id', household.id).eq('user_id', myId)
      if (error) throw error
      return data ?? []
    },
  })

  const thisDevice = device.data ? devices.data?.find((d) => d.endpoint === device.data?.endpoint) : undefined
  const tools = activeTools(activations)
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['push-device'] }), queryClient.invalidateQueries({ queryKey: ['push-devices'] })])

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true)
    setProblem(null)
    try {
      await action()
    } catch {
      setProblem(failure)
    } finally {
      await refresh()
      setBusy(false)
    }
  }

  const enable = () =>
    run(async () => {
      const permission = await platform.requestPermission()
      if (permission !== 'granted') return
      const keys = await platform.subscribe(decodeKey(vapidKey!))
      const { error } = await client.rpc('register_push', { p_endpoint: keys.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_user_agent: platform.deviceLabel() })
      if (error) throw error
    }, 'Ce téléphone n’a pas pu s’abonner. Vérifie la connexion puis réessaie.')

  const disable = () =>
    run(async () => {
      const endpoint = device.data?.endpoint
      await platform.unsubscribe()
      if (endpoint) {
        const { error } = await client.from('push_subscription').delete().eq('endpoint', endpoint)
        if (error) throw error
      }
    }, 'Les notifications n’ont pas été coupées. Réessaie.')

  const removeDevice = (id: string) =>
    run(async () => {
      const { error } = await client.from('push_subscription').delete().eq('id', id)
      if (error) throw error
    }, 'L’appareil n’a pas été retiré. Réessaie.')

  const savePref = async (toolKey: string, patch: { enabled?: boolean; digest_minutes?: number }) => {
    const existing = prefs.data?.find((p) => p.tool_key === toolKey)
    const { error } = existing
      ? await client.from('notification_pref').update(patch).eq('household_id', household.id).eq('user_id', myId).eq('tool_key', toolKey)
      : await client.from('notification_pref').insert({ household_id: household.id, user_id: myId, tool_key: toolKey, ...patch })
    if (error) throw error
  }
  const changePrefs = (changes: { toolKey: string; patch: { enabled?: boolean; digest_minutes?: number } }[]) =>
    run(async () => {
      await Promise.all(changes.map((c) => savePref(c.toolKey, c.patch)))
      await queryClient.invalidateQueries({ queryKey: prefKey })
    }, 'Le réglage n’a pas été enregistré. Réessaie.')

  const permission = support === 'ok' ? platform.permission() : 'default'
  const digest = prefs.data?.find((p) => tools.some((t) => t.key === p.tool_key))?.digest_minutes ?? 5

  let state: ReactNode
  if (support === 'needs-install') {
    state = <p className="text-ink-2">Sur iPhone, ajoute d’abord OhO à l’écran d’accueil (Partager, puis « Sur l’écran d’accueil »), puis reviens ici.</p>
  } else if (support === 'unsupported') {
    state = <p className="text-ink-2">Ce navigateur ne reçoit pas de notifications.</p>
  } else if (!vapidKey) {
    state = <p className="text-ink-2">Les notifications ne sont pas encore branchées sur le serveur.</p>
  } else if (permission === 'denied') {
    state = <p className="text-ink-2">Les notifications sont bloquées pour OhO dans les réglages du navigateur. Autorise-les là, puis reviens ici.</p>
  } else if (device.isPending || devices.isPending) {
    state = null
  } else if (!thisDevice) {
    state = (
      <div className="flex flex-col gap-3 rounded-lg bg-accent-tint px-4 py-4 text-accent-ink">
        <p className="flex items-start gap-3">
          <BellRing size={20} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>Être prévenu quand {other} ajoute quelque chose. Jamais pour tes propres ajouts, et regroupé pour ne pas sonner à chaque article.</span>
        </p>
        <Button onClick={enable} disabled={busy}>
          Activer sur ce téléphone
        </Button>
      </div>
    )
  } else {
    state = (
      <div className="flex min-h-14 items-center gap-3 rounded-lg bg-surface-2 px-4">
        <BellRing size={20} aria-hidden="true" className="text-accent-ink" />
        <span className="flex-1 text-ink">Ce téléphone reçoit les notifications.</span>
        <Button variant="ghost" className="min-h-11 px-3 text-sm" onClick={disable} disabled={busy}>
          Couper
        </Button>
      </div>
    )
  }

  const hasDevice = (devices.data?.length ?? 0) > 0

  return (
    <section className="flex flex-col gap-3" aria-labelledby="notifications">
      <h2 id="notifications" className={heading}>
        NOTIFICATIONS
      </h2>
      {state}
      {hasDevice ? (
        <>
          <ul className="flex flex-col gap-2" aria-label="Prévenir pour">
            {tools.map((tool) => {
              const on = prefs.data?.find((p) => p.tool_key === tool.key)?.enabled ?? true
              const Icon = tool.icon
              return (
                <li key={tool.key}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`Prévenir pour ${tool.label}`}
                    disabled={busy}
                    onClick={() => changePrefs([{ toolKey: tool.key, patch: { enabled: !on } }])}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface-2 px-4 text-left disabled:opacity-60"
                  >
                    <Icon size={20} aria-hidden="true" className="text-accent-ink" />
                    <span className="flex-1 font-semibold text-ink">{tool.label}</span>
                    <span className="text-sm text-ink-3">{on ? 'Prévenir' : 'Silence'}</span>
                    <span className={cn('flex h-7 w-12 items-center rounded-pill p-1', on ? 'bg-accent-ink' : 'bg-rule-strong')} aria-hidden="true">
                      <span className={cn('size-5 rounded-pill bg-surface transition-transform', on ? 'translate-x-5' : null)} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <label className="flex min-h-14 items-center gap-3 rounded-lg bg-surface-2 px-4">
            <span className="flex-1 text-ink">Les ajouts arrivent</span>
            <select
              value={digest}
              disabled={busy}
              onChange={(e) => changePrefs(tools.map((t) => ({ toolKey: t.key, patch: { digest_minutes: Number(e.target.value) } })))}
              className="min-h-11 rounded-md bg-surface px-2 text-sm text-ink"
            >
              {digestChoices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <h3 className={heading}>MES APPAREILS</h3>
            <ul className="flex flex-col divide-y divide-rule">
              {devices.data?.map((d) => (
                <li key={d.id} className="flex min-h-12 items-center gap-2">
                  <span className="flex-1 text-ink">
                    {d.user_agent ?? 'Appareil'}
                    {d.id === thisDevice?.id ? <span className="text-ink-3"> · ce téléphone</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => (d.id === thisDevice?.id ? disable() : removeDevice(d.id))}
                    disabled={busy}
                    aria-label={`Retirer ${d.user_agent ?? 'cet appareil'}`}
                    className="flex size-11 items-center justify-center rounded-md text-ink-3 hover:text-bad"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
      {problem ? (
        <p role="alert" className="rounded-md bg-bad-tint px-4 py-2 text-sm text-bad">
          {problem}
        </p>
      ) : null}
    </section>
  )
}
