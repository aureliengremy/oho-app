import { supabase } from '../core/supabase'
import { tools } from '../tools/registry'

function isInstalled() {
  return typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** Coquille provisoire du lot 1 : l'accueil, la connexion et les routes arrivent au lot 3. */
export default function App() {
  const checks = [
    {
      label: 'Supabase',
      ok: supabase !== null,
      value: supabase ? 'Configuré' : 'À configurer dans .env.local',
    },
    { label: 'Outils enregistrés', ok: true, value: String(tools.length) },
    { label: 'Mode', ok: true, value: isInstalled() ? 'Application installée' : 'Navigateur' },
  ]

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-semibold tracking-[var(--ls-eyebrow)] text-accent-ink">
          SOCLE · LOT 1
        </p>
        <h1 className="font-display text-6xl font-semibold tracking-[var(--ls-head)] text-ink">
          Oh<span className="text-accent">O</span>
        </h1>
        <p className="font-display text-xl text-ink-2">Nos outils, à deux.</p>
      </header>

      <ul className="flex flex-col gap-2" aria-label="État du socle">
        {checks.map((check) => (
          <li
            key={check.label}
            className="flex min-h-12 items-center justify-between gap-4 rounded-lg bg-surface-2 px-4 py-3"
          >
            <span className="text-ink-2">{check.label}</span>
            <span
              className={
                check.ok
                  ? 'font-semibold text-ink'
                  : 'rounded-pill bg-warn-tint px-3 py-1 text-sm font-semibold text-warn'
              }
            >
              {check.value}
            </span>
          </li>
        ))}
      </ul>
    </main>
  )
}
