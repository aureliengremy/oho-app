import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthValue {
  status: AuthStatus
  session: Session | null
  userId: string | null
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

/** Traduit les erreurs Supabase Auth les plus courantes pour l'écran de connexion. */
export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Courriel ou mot de passe incorrect.'
  if (/email not confirmed/i.test(message)) return 'Ce courriel n’est pas encore confirmé.'
  if (/signups? not allowed|user not found/i.test(message)) return 'Aucun compte OhO n’existe pour ce courriel.'
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  if (/fetch|network/i.test(message)) return 'Pas de connexion. Vérifie le réseau et réessaie.'
  return 'La connexion a échoué. Réessaie.'
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth doit être appelé sous <AuthProvider>')
  return value
}
