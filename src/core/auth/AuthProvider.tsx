import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useClient } from '../client'
import { clearLocalData } from '../sync/localData'
import { AuthContext, authErrorMessage, passwordErrorMessage, passwordPath, type AuthStatus, type AuthValue } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    let active = true
    // La session persistée (localStorage) est relue au démarrage : pas de reconnexion à la réouverture.
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signedIn' : 'signedOut')
    })
    const { data } = client.auth.onAuthStateChange((event, next) => {
      // Ouverture du lien « nouveau mot de passe » : vrai même si Supabase a redirigé vers l'accueil.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
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
      recovering,
      async sendPasswordLink() {
        const email = session?.user.email
        if (!email) return { error: 'Aucun courriel n’est associé à ce compte.' }
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${passwordPath}`,
        })
        return { error: error ? passwordErrorMessage(error.message) : null }
      },
      async updatePassword(password) {
        const { error } = await client.auth.updateUser({ password })
        if (error) return { error: passwordErrorMessage(error.message) }
        setRecovering(false)
        return { error: null }
      },
      async signOut() {
        await client.auth.signOut()
        // Rien du compte ne reste sur l'appareil : cache des lectures et écritures en attente.
        queryClient.clear()
        clearLocalData()
      },
    }),
    [client, queryClient, recovering, session, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
