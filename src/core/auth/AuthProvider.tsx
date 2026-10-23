import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useClient } from '../client'
import { clearLocalData } from '../sync/localData'
import { AuthContext, authErrorMessage, type AuthStatus, type AuthValue } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const queryClient = useQueryClient()
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
        // Rien du compte ne reste sur l'appareil : cache des lectures et écritures en attente.
        queryClient.clear()
        clearLocalData()
      },
    }),
    [client, queryClient, session, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
