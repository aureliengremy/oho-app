import { House } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '../lib/cn'
import type { ToolDefinition } from '@/tools/registry'

/** Barre d'onglets du bas : Accueil puis les outils activés, quatre au plus (décision D1). */
export function TabBar({ tools }: { tools: readonly ToolDefinition[] }) {
  const items = [{ path: '/', label: 'Accueil', icon: House }, ...tools]
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ path, label, icon: Icon }) => (
          <li key={path} className="flex-1">
            <NavLink
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-xs',
                  isActive ? 'font-semibold text-accent-ink' : 'text-ink-3',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn('flex h-7 w-12 items-center justify-center rounded-pill', isActive && 'bg-accent-tint')}
                  >
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
