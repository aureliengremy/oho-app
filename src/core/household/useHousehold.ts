import { createContext, useContext } from 'react'
import type { HouseholdData, Member } from './queries'

export interface HouseholdValue extends HouseholdData {
  me: Member | undefined
  memberById: (id: string | null | undefined) => Member | undefined
}

export const HouseholdContext = createContext<HouseholdValue | null>(null)

export function useHousehold(): HouseholdValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold doit être appelé sous <HouseholdProvider>')
  return value
}
