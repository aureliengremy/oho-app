import { createContext, useContext } from 'react'
import type { TablesInsert, TablesUpdate } from '@/core/db/database.types'
import type { Attachment, Booking, BudgetLine, PrepItem, Trip, TripIdea, TripsData } from './model'

export type TripFields = Pick<TablesInsert<'trip'>, 'title' | 'destination' | 'start_date' | 'end_date' | 'status' | 'cover_emoji' | 'notes'>
export type IdeaFields = Pick<TablesInsert<'trip_activity'>, 'title' | 'note' | 'url' | 'planned_date'>
export type BookingFields = Pick<
  TablesInsert<'booking'>,
  'kind' | 'title' | 'starts_at' | 'ends_at' | 'tz' | 'reference' | 'url' | 'note' | 'amount' | 'currency'
>
export type BudgetFields = Pick<TablesInsert<'trip_budget_line'>, 'category' | 'planned_amount' | 'currency'>

/** 20 Mo, la limite du bucket et de `attachment.size_bytes`. */
export const MAX_ATTACHMENT = 20 * 1024 * 1024

export interface TripsValue {
  data: TripsData | undefined
  updatedAt: number
  isPending: boolean
  /** Les données ont été relues depuis l'ouverture (et pas seulement restaurées du cache de l'appareil). */
  settled: boolean
  isError: boolean
  refetch: () => void
  error: string | null
  dismissError: () => void
  createTrip: (fields: TripFields) => string
  updateTrip: (trip: Trip, patch: TablesUpdate<'trip'>) => void
  removeTrip: (trip: Trip) => void
  addIdea: (tripId: string, title: string) => void
  updateIdea: (idea: TripIdea, patch: TablesUpdate<'trip_activity'>) => void
  removeIdea: (idea: TripIdea) => void
  createPrepList: (trip: Trip) => void
  addPrepItems: (listId: string, input: string) => number
  togglePrepItem: (item: PrepItem) => void
  updatePrepItem: (item: PrepItem, patch: Pick<TablesUpdate<'checklist_item'>, 'label' | 'quantity' | 'note'>) => void
  removePrepItem: (item: PrepItem) => void
  saveBooking: (tripId: string, fields: BookingFields, booking?: Booking) => string
  removeBooking: (booking: Booking) => void
  saveBudgetLine: (tripId: string, fields: BudgetFields, line?: BudgetLine) => void
  removeBudgetLine: (line: BudgetLine) => void
  /** Envoie un fichier au bucket privé puis l'enregistre ; rejette avec un message lisible. */
  attach: (booking: Booking, file: File) => Promise<void>
  removeAttachment: (attachment: Attachment) => void
  /** URL signée de 60 s pour ouvrir une pièce jointe. */
  signedUrl: (attachment: Attachment) => Promise<string>
}

export const TripsContext = createContext<TripsValue | null>(null)

export function useTrips(): TripsValue {
  const value = useContext(TripsContext)
  if (!value) throw new Error('useTrips doit être appelé sous <TripsProvider>')
  return value
}
