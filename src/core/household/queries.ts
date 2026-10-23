import type { OhoClient } from '../client'
import type { Tables } from '../db/database.types'

export type Profile = Tables<'profile'>
export type Household = Tables<'household'>
export type ToolActivation = Tables<'tool_activation'>
export type ActivityEntry = Tables<'activity_log'>

/** Un membre de l'espace, avec sa place (A = océan, B = sable) dans l'ordre d'arrivée. */
export interface Member {
  profile: Profile
  role: Tables<'membership'>['role']
  slot: 'a' | 'b' | 'other'
}

export interface HouseholdData {
  household: Household
  members: Member[]
  activations: ToolActivation[]
}

/** Charge le premier espace actif du compte (un seul en v1, décision P6). Null si aucun. */
export async function fetchHousehold(client: OhoClient, userId: string): Promise<HouseholdData | null> {
  const { data: mine, error: mineError } = await client
    .from('membership')
    .select('household_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (mineError) throw mineError
  if (!mine) return null
  const householdId = mine.household_id

  const [household, memberships, activations] = await Promise.all([
    client.from('household').select('*').eq('id', householdId).single(),
    client
      .from('membership')
      .select('role, joined_at, profile:profile!membership_user_id_fkey(*)')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .order('joined_at', { ascending: true }),
    client
      .from('tool_activation')
      .select('*')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
  ])
  if (household.error) throw household.error
  if (memberships.error) throw memberships.error
  if (activations.error) throw activations.error

  const members: Member[] = (memberships.data ?? [])
    .filter((m) => m.profile)
    .map((m, index) => ({
      profile: m.profile as Profile,
      role: m.role,
      slot: index === 0 ? 'a' : index === 1 ? 'b' : 'other',
    }))

  return { household: household.data, members, activations: activations.data ?? [] }
}

/** Les dernières entrées du journal d'activité de l'espace. */
export async function fetchRecentActivity(client: OhoClient, householdId: string, limit = 5): Promise<ActivityEntry[]> {
  const { data, error } = await client
    .from('activity_log')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
