import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { passwordPath, useAuth } from './useAuth'
import { LoadingScreen } from '../layout/LoadingScreen'

/**
 * Garde de routes : renvoie vers /connexion tant qu'aucune session n'est ouverte, et vers l'écran
 * « nouveau mot de passe » quand la session vient d'un lien de réinitialisation.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, recovering } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <LoadingScreen />
  if (status === 'signedOut') return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  if (recovering && location.pathname !== passwordPath) return <Navigate to={passwordPath} replace />
  return children
}
