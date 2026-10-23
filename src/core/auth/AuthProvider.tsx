import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useClient } from '../client'

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

interface AuthValue {
  status: AuthStatus
  session: Session | null
  userId: string | null
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/** Traduit les erreurs Supabase Auth les plus courantes pour l'écran de connexion. */
export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Courriel ou mot de passe incorrect.'
  if (/email not confirmed/i.test(message)) return 'Ce courriel n’est pas encore confirmé.'
  if (/signups? not allowed|user not found/i.test(message)) return 'Aucun compte OhO n’existe pour ce courriel.'
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  if (/fetch|network/i.test(message)) return 'Pas de connexion. Vérifie le réseau et réessaie.'
  return 'La connexion a échoué. Réessaie.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let active = true
    // La session persistée (localStorage) est relue au démarrage : pas de reconnexion à la réouverture.
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signedIn' : 'signedOut')
    })
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setStatus(next ? 'signedIn' : 'signedOut')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      userId: session?.user.id ?? null,
      async signInWithPassword(email, password) {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        return { error: error ? authErrorMessage(error.message) : null }
      },
      async sendMagicLink(email) {
        const { error } = await client.auth.signInWithOtp({
          email: email.trim(),
          // Inscription fermée (décision S13) : le lien ne part que pour un compte existant.
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
        })
        return { error: error ? authErrorMessage(error.message) : null }
      },
      async signOut() {
        await client.auth.signOut()
      },
    }),
    [client, session, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth doit être appelé sous <AuthProvider>')
  return value
}
