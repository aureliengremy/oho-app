import { createContext, useContext, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './db/database.types'

export type OhoClient = SupabaseClient<Database>

const ClientContext = createContext<OhoClient | null>(null)

/** Fournit le client Supabase aux écrans ; les tests y passent un faux client. */
export function ClientProvider({ client, children }: { client: OhoClient; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
}

export function useClient(): OhoClient {
  const client = useContext(ClientContext)
  if (!client) throw new Error('useClient doit être appelé sous <ClientProvider>')
  return client
}
