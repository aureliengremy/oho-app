import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthValue {
  status: AuthStatus
  session: Session | null
  userId: string | null
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  /** Le compte vient d'ouvrir un lien « nouveau mot de passe » : l'app mène à l'écran de saisie. */
  recovering: boolean
  /** Envoie au courriel du compte connecté un lien qui ouvre l'écran « nouveau mot de passe ». */
  sendPasswordLink: () => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
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

/** Chemin de l'écran « nouveau mot de passe », cible du lien envoyé par courriel. */
export const passwordPath = '/mot-de-passe'

/** Longueur minimale imposée par Supabase Auth (`minimum_password_length`). */
export const minPasswordLength = 10

/** Traduit les refus de Supabase Auth à l'envoi du lien et au changement de mot de passe. */
export function passwordErrorMessage(message: string): string {
  if (/different from the old/i.test(message)) return 'Choisis un mot de passe différent de l’ancien.'
  if (/at least|too short|weak/i.test(message)) return `Le mot de passe doit faire au moins ${minPasswordLength} caractères.`
  if (/reauthenticat|session|jwt/i.test(message)) return 'Le lien a expiré. Demande-en un nouveau depuis les réglages.'
  if (/security purposes|only request this after/i.test(message)) return 'Un lien vient de partir. Attends une minute avant d’en redemander un.'
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  if (/fetch|network/i.test(message)) return 'Pas de connexion. Vérifie le réseau et réessaie.'
  return 'Le mot de passe n’a pas changé. Réessaie.'
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth doit être appelé sous <AuthProvider>')
  return value
}
