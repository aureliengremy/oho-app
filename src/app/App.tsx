import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '@/core/auth/AuthProvider'
import { ClientProvider } from '@/core/ClientProvider'
import type { OhoClient } from '@/core/client'
import { supabase } from '@/core/supabase'
import { CACHE_KEY } from '@/core/sync/localData'
import { ThemeProvider } from '@/core/theme/ThemeProvider'
import { Brand } from '@/core/ui/Brand'
import { routes } from './routes'

const router = createBrowserRouter(routes)

/** Écran affiché tant que .env.local ne contient pas l'URL et la clé Supabase. */
export function NotConfigured() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6">
      <Brand className="text-6xl" />
      <h1 className="font-display text-2xl font-semibold text-ink">Supabase n’est pas configuré</h1>
      <p className="text-ink-2">
        Copie <code className="rounded-sm bg-surface-2 px-1">.env.example</code> vers{' '}
        <code className="rounded-sm bg-surface-2 px-1">.env.local</code> avec l’URL et la clé anon du projet, puis
        relance <code className="rounded-sm bg-surface-2 px-1">npm run dev</code>.
      </p>
    </main>
  )
}

/** Les lectures gardées pour l'ouverture hors ligne vivent une semaine au plus. */
const CACHE_MAX_AGE = 7 * 24 * 3600_000

export function Providers({
  client,
  persist = true,
  children,
}: {
  client: OhoClient
  /** Garde le cache des lectures dans localStorage pour rouvrir l'app hors ligne (désactivé en test). */
  persist?: boolean
  children: ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, gcTime: CACHE_MAX_AGE } },
      }),
  )
  const [persister] = useState(() =>
    persist ? createSyncStoragePersister({ storage: window.localStorage, key: CACHE_KEY }) : null,
  )
  const inner = <AuthProvider>{children}</AuthProvider>
  return (
    <ThemeProvider>
      <ClientProvider client={client}>
        {persister ? (
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: 'oho-1' }}
          >
            {inner}
          </PersistQueryClientProvider>
        ) : (
          <QueryClientProvider client={queryClient}>{inner}</QueryClientProvider>
        )}
      </ClientProvider>
    </ThemeProvider>
  )
}

export default function App() {
  if (!supabase) {
    return (
      <ThemeProvider>
        <NotConfigured />
      </ThemeProvider>
    )
  }
  return (
    <Providers client={supabase}>
      <RouterProvider router={router} />
    </Providers>
  )
}
