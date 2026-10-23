import type { OhoClient } from '@/core/client'
import type { TablesInsert, TablesUpdate } from '@/core/db/database.types'
import type { TripsData } from './model'

export const tripsKey = (householdId: string) => ['trips', householdId] as const

/** Tables lues par l'outil, pour le rechargement en temps réel. */
export const TRIP_TABLES = ['trip', 'trip_activity', 'booking', 'trip_budget_line', 'attachment', 'checklist', 'checklist_item'] as const

export const BUCKET = 'attachments'

async function rows<T>(request: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await request
  if (error) throw error
  return data ?? []
}

/** Les voyages vivants de l'espace et tout ce qui leur est rattaché. */
export async function fetchTrips(client: OhoClient, householdId: string): Promise<TripsData> {
  const [trips, ideas, bookings, budget, attachments, prepLists] = await Promise.all([
    rows(
      client
        .from('trip')
        .select('*')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .order('start_date', { ascending: true }),
    ),
    rows(client.from('trip_activity').select('*').eq('household_id', householdId).is('deleted_at', null).order('sort_order', { ascending: true })),
    rows(client.from('booking').select('*').eq('household_id', householdId).is('deleted_at', null).order('starts_at', { ascending: true })),
    rows(client.from('trip_budget_line').select('*').eq('household_id', householdId).is('deleted_at', null).order('sort_order', { ascending: true })),
    rows(
      client
        .from('attachment')
        .select('*')
        .eq('household_id', householdId)
        .eq('entity_type', 'booking')
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
    ),
    rows(
      client.from('checklist').select('*').eq('household_id', householdId).eq('kind', 'trip_prep').is('deleted_at', null),
    ),
  ])
  const tripIds = new Set(trips.map((t) => t.id))
  const lists = prepLists.filter((l) => l.trip_id && tripIds.has(l.trip_id))
  const prepItems =
    lists.length === 0
      ? []
      : await rows(
          client
            .from('checklist_item')
            .select('*')
            .eq('household_id', householdId)
            .in('checklist_id', lists.map((l) => l.id))
            .is('deleted_at', null)
            .order('sort_order', { ascending: true }),
        )
  const ofLiveTrip = <R extends { trip_id: string }>(list: R[]) => list.filter((r) => tripIds.has(r.trip_id))
  const liveBookings = ofLiveTrip(bookings)
  const bookingIds = new Set(liveBookings.map((b) => b.id))
  return {
    trips,
    ideas: ofLiveTrip(ideas),
    bookings: liveBookings,
    budget: ofLiveTrip(budget),
    attachments: attachments.filter((a) => bookingIds.has(a.entity_id)),
    prepLists: lists,
    prepItems,
  }
}

async function check<T extends { error: unknown }>(request: PromiseLike<T>): Promise<T> {
  const result = await request
  if (result.error) throw result.error
  return result
}

type Writable = 'trip' | 'trip_activity' | 'booking' | 'trip_budget_line' | 'attachment' | 'checklist' | 'checklist_item'

export const writes = {
  insert: <T extends Writable>(client: OhoClient, table: T, row: TablesInsert<T>) =>
    check(client.from(table).insert(row as never)),
  // Toutes ces tables ont une colonne id : on passe par 'trip' pour le typage du filtre.
  update: <T extends Writable>(client: OhoClient, table: T, id: string, patch: TablesUpdate<T>) =>
    check(client.from(table as 'trip').update(patch as never).eq('id', id)),
}
