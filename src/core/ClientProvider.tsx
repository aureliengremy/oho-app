import type { ReactNode } from 'react'
import { ClientContext, type OhoClient } from './client'

/** Fournit le client Supabase aux écrans ; les tests y passent un faux client. */
export function ClientProvider({ client, children }: { client: OhoClient; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
}
