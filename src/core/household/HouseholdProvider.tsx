import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { useClient } from '../client'
import { LoadingScreen } from '../layout/LoadingScreen'
import { Button } from '../ui/Button'
import { fetchHousehold, type HouseholdData, type Member } from './queries'

interface HouseholdValue extends HouseholdData {
  me: Member | undefined
  memberById: (id: string | null | undefined) => Member | undefined
}

const HouseholdContext = createContext<HouseholdValue | null>(null)

/** Charge l'espace du compte connecté avant d'afficher l'app. */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const { userId, signOut } = useAuth()
  const query = useQuery({
    queryKey: ['household', userId],
    queryFn: () => fetchHousehold(client, userId!),
    enabled: userId !== null,
    // Rechargé par le canal temps réel quand l'espace, ses membres ou ses outils changent.
    meta: { tables: ['household', 'membership', 'tool_activation'] },
  })

  if (query.isPending) return <LoadingScreen label="Chargement de l’espace…" />
  if (query.isError || !query.data) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="font-display text-3xl font-semibold text-ink">
          {query.isError ? 'L’espace ne s’est pas chargé' : 'Aucun espace pour ce compte'}
        </h1>
        <p className="text-ink-2">
          {query.isError
            ? 'Vérifie la connexion puis réessaie.'
            : 'Ce compte n’appartient à aucun espace partagé. Il doit être ajouté par le seed.'}
        </p>
        <div className="flex gap-3">
          {query.isError ? <Button onClick={() => query.refetch()}>Réessayer</Button> : null}
          <Button variant="secondary" onClick={() => signOut()}>
            Se déconnecter
          </Button>
        </div>
      </main>
    )
  }

  const data = query.data
  const value: HouseholdValue = {
    ...data,
    me: data.members.find((m) => m.profile.id === userId),
    memberById: (id) => data.members.find((m) => m.profile.id === id),
  }
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold(): HouseholdValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold doit être appelé sous <HouseholdProvider>')
  return value
}
