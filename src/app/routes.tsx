import { lazy } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { LoginScreen } from '@/core/auth/LoginScreen'
import { RequireAuth } from '@/core/auth/RequireAuth'
import { HouseholdProvider } from '@/core/household/HouseholdProvider'
import { AppShell } from '@/core/layout/AppShell'
import { tools } from '@/tools/registry'
import { ActivityScreen } from './screens/ActivityScreen'
import { HomeScreen } from './screens/HomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'

// Chaque outil est chargé à la demande depuis le registre.
const toolRoutes: RouteObject[] = tools.map((tool) => {
  const Screen = lazy(tool.load)
  return { path: `${tool.path.slice(1)}/*`, element: <Screen /> }
})

export const routes: RouteObject[] = [
  { path: '/connexion', element: <LoginScreen /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <HouseholdProvider>
          <AppShell />
        </HouseholdProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'activite', element: <ActivityScreen /> },
      { path: 'reglages', element: <SettingsScreen /> },
      ...toolRoutes,
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
