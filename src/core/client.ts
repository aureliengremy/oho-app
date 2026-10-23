import { createContext, useContext } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './db/database.types'

export type OhoClient = SupabaseClient<Database>

export const ClientContext = createContext<OhoClient | null>(null)

export function useClient(): OhoClient {
  const client = useContext(ClientContext)
  if (!client) throw new Error('useClient doit être appelé sous <ClientProvider>')
  return client
}
