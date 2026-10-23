import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { LoadingScreen } from '../layout/LoadingScreen'

/** Garde de routes : renvoie vers /connexion tant qu'aucune session n'est ouverte. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <LoadingScreen />
  if (status === 'signedOut') return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  return children
}
