import { lazy, Suspense, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ActivityFeed } from '@/core/household/ActivityFeed'
import { useHousehold } from '@/core/household/useHousehold'
import { greeting } from '@/core/lib/time'
import { Avatar } from '@/core/ui/Avatar'
import { activeTools, tools } from '@/tools/registry'

// Les cartes d'accueil des outils (« Prochain voyage »…), chargées à la demande une fois pour toutes.
const homeCards = tools.flatMap((t) => (t.homeCard ? [{ key: t.key, Card: lazy(t.homeCard) }] : []))

function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">{children}</h2>
      {action}
    </div>
  )
}

export function HomeScreen() {
  const { household, activations, me } = useHousehold()
  const enabled = activeTools(activations)
  const firstName = me?.profile.display_name ?? ''

  return (
    <div className="flex flex-col gap-8 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-8">
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate font-mono text-xs tracking-[var(--ls-eyebrow)] uppercase text-ink-3">
            {household.name}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-[var(--ls-head)] text-ink">
            {greeting()} {firstName}
          </h1>
        </div>
        <Link
          to="/reglages"
          className="flex size-11 items-center justify-center rounded-pill"
          aria-label="Réglages"
        >
          <Avatar name={firstName || '?'} chosenInitials={me?.profile.initials} slot={me?.slot ?? 'other'} size="lg" />
        </Link>
      </header>

      <Suspense fallback={null}>
        {homeCards
          .filter((c) => enabled.some((t) => t.key === c.key))
          .map(({ key, Card }) => (
            <Card key={key} />
          ))}
      </Suspense>

      <section className="flex flex-col gap-3" aria-labelledby="outils">
        <SectionTitle>Outils</SectionTitle>
        {enabled.length === 0 ? (
          <p className="rounded-lg bg-surface-2 px-4 py-4 text-ink-2">
            Aucun outil activé pour l’espace. Les outils s’activent dans les réglages de l’espace.
          </p>
        ) : (
          <ul id="outils" className="grid grid-cols-2 gap-3">
            {enabled.map(({ key, label, path, icon: Icon }) => (
              <li key={key}>
                <Link
                  to={path}
                  className="flex min-h-24 flex-col justify-between gap-3 rounded-lg bg-surface-2 p-4 hover:bg-card focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-accent-tint text-accent-ink">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="font-semibold text-ink">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle
          action={
            <Link to="/activite" className="-mx-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-accent-ink">
              Tout voir
            </Link>
          }
        >
          Activité récente
        </SectionTitle>
        <ActivityFeed limit={5} />
      </section>
    </div>
  )
}
