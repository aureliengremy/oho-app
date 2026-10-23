import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { activeTools, MAX_TAB_TOOLS } from '@/tools/registry'
import { useHousehold } from '../household/HouseholdProvider'
import { LoadingScreen } from './LoadingScreen'
import { TabBar } from './TabBar'

/** Coquille mobile : l'écran courant au-dessus, la barre d'onglets fixée en bas. */
export function AppShell() {
  const { activations } = useHousehold()
  const tabs = activeTools(activations).slice(0, MAX_TAB_TOOLS)
  return (
    <div className="min-h-full bg-surface pb-[calc(56px+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </div>
      <TabBar tools={tabs} />
    </div>
  )
}
