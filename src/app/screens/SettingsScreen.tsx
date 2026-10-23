import { LogOut } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthProvider'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { ScreenHeader } from '@/core/layout/ScreenHeader'
import { cn } from '@/core/lib/cn'
import { useTheme, type ThemePreference } from '@/core/theme/ThemeProvider'
import { Avatar } from '@/core/ui/Avatar'
import { Button } from '@/core/ui/Button'

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

        <Button variant="secondary" onClick={() => signOut()}>
          <LogOut size={18} aria-hidden="true" /> Se déconnecter
        </Button>
      </div>
    </>
  )
}
