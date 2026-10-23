import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '@/core/auth/AuthProvider'
import { ClientProvider, type OhoClient } from '@/core/client'
import { supabase } from '@/core/supabase'
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

export function Providers({ client, children }: { client: OhoClient; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  )
  return (
    <ThemeProvider>
      <ClientProvider client={client}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
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
