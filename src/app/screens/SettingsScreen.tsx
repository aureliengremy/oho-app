import { useState } from 'react'
import { Activity, ChevronRight, LogOut } from 'lucide-react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import { useAuth } from '@/core/auth/AuthProvider'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { useTheme, type ThemePreference } from '@/core/theme/ThemeProvider'
import { Avatar } from '@/core/ui/Avatar'
import { Button } from '@/core/ui/Button'
import { tools, type ToolDefinition } from '@/tools/registry'
import { NotificationsSection } from './NotificationsSection'

const themes: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

const slotLabel = { a: 'Océan', b: 'Sable', other: 'Gris' } as const

export function SettingsScreen() {
  const { signOut } = useAuth()
  const { household, members } = useHousehold()
  const { preference, setPreference } = useTheme()

  return (
    <>
      <ScreenHeader title="Réglages" back />
      <div className="flex flex-col gap-8 px-5 pb-8">
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">THÈME</h2>
          <div role="radiogroup" aria-label="Thème" className="flex rounded-pill bg-surface-2 p-1">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={preference === t.value}
                onClick={() => setPreference(t.value)}
                className={cn(
                  'min-h-11 flex-1 rounded-pill text-sm font-semibold',
                  preference === t.value ? 'bg-accent-ink text-surface' : 'text-ink-2',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">
            {`MEMBRES · ${household.name.toUpperCase()}`}
          </h2>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.profile.id} className="flex min-h-14 items-center gap-3 rounded-lg bg-surface-2 px-4">
                <Avatar name={m.profile.display_name} chosenInitials={m.profile.initials} slot={m.slot} />
                <span className="flex-1 font-semibold text-ink">{m.profile.display_name}</span>
                <span className="text-sm text-ink-3">{slotLabel[m.slot]}</span>
              </li>
            ))}
          </ul>
        </section>

        <NotificationsSection />

        <ToolsSection />

        <Link to="/etat" className="flex min-h-14 items-center gap-3 rounded-lg bg-surface-2 px-4">
          <Activity size={20} aria-hidden="true" className="text-accent-ink" />
          <span className="flex-1 font-semibold text-ink">État du système et sauvegardes</span>
          <ChevronRight size={18} aria-hidden="true" className="text-ink-3" />
        </Link>

        <Button variant="secondary" onClick={() => signOut()}>
          <LogOut size={18} aria-hidden="true" /> Se déconnecter
        </Button>
      </div>
    </>
  )
}

/** Activer ou masquer un outil pour tout l'espace (tool_activation). */
function ToolsSection() {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household, activations } = useHousehold()
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const toggle = async (tool: ToolDefinition) => {
    const row = activations.find((a) => a.tool_key === tool.key)
    setBusy(tool.key)
    setProblem(null)
    const { error } = row
      ? await client.from('tool_activation').update({ enabled: !row.enabled }).eq('household_id', household.id).eq('tool_key', tool.key)
      : await client.from('tool_activation').insert({ household_id: household.id, tool_key: tool.key, enabled: true, sort_order: tool.defaultOrder })
    if (error) setProblem(`${tool.label} n’a pas changé. Vérifie la connexion puis réessaie.`)
    await queryClient.invalidateQueries({ queryKey: ['household'] })
    setBusy(null)
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] text-ink-3">OUTILS DE L’ESPACE</h2>
      <ul className="flex flex-col gap-2">
        {tools.map((tool) => {
          const on = activations.some((a) => a.tool_key === tool.key && a.enabled)
          const Icon = tool.icon
          return (
            <li key={tool.key}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={busy !== null}
                onClick={() => toggle(tool)}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface-2 px-4 text-left disabled:opacity-60"
              >
                <Icon size={20} aria-hidden="true" className="text-accent-ink" />
                <span className="flex-1 font-semibold text-ink">{tool.label}</span>
                <span className="text-sm text-ink-3">{on ? 'Activé' : 'Masqué'}</span>
                <span className={cn('flex h-7 w-12 items-center rounded-pill p-1', on ? 'bg-accent-ink' : 'bg-rule-strong')} aria-hidden="true">
                  <span className={cn('size-5 rounded-pill bg-surface transition-transform', on ? 'translate-x-5' : null)} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-ink-3">Un outil masqué disparaît pour vous deux ; ses données restent là.</p>
      {problem ? (
        <p role="alert" className="rounded-md bg-bad-tint px-4 py-2 text-sm text-bad">
          {problem}
        </p>
      ) : null}
    </section>
  )
}
