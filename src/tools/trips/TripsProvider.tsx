import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/core/client'
import { parseQuickAdd } from '@/core/checklist/parse'
import type { TablesInsert, TablesUpdate } from '@/core/db/database.types'
import { useHousehold } from '@/core/household/HouseholdProvider'
import { uuidv7 } from '@/core/lib/uuid'
import { isSettled, useLiveQuery } from '@/core/sync/SyncProvider'
import { useOptimisticWrites } from '@/core/sync/useOptimisticWrites'
import { nextSortOrder, type Attachment, type Booking, type BudgetLine, type PrepItem, type Trip, type TripIdea, type TripsData } from './model'
import { BUCKET, fetchTrips, TRIP_TABLES, tripsKey, writes } from './queries'

export type TripFields = Pick<TablesInsert<'trip'>, 'title' | 'destination' | 'start_date' | 'end_date' | 'status' | 'cover_emoji' | 'notes'>
export type IdeaFields = Pick<TablesInsert<'trip_activity'>, 'title' | 'note' | 'url' | 'planned_date'>
export type BookingFields = Pick<
  TablesInsert<'booking'>,
  'kind' | 'title' | 'starts_at' | 'ends_at' | 'tz' | 'reference' | 'url' | 'note' | 'amount' | 'currency'
>
export type BudgetFields = Pick<TablesInsert<'trip_budget_line'>, 'category' | 'planned_amount' | 'currency'>

/** 20 Mo, la limite du bucket et de `attachment.size_bytes`. */
export const MAX_ATTACHMENT = 20 * 1024 * 1024

interface TripsValue {
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

const TripsContext = createContext<TripsValue | null>(null)

const now = () => new Date().toISOString()

const stamps = (myId: string | null) => {
  const stamp = now()
  return { created_at: stamp, updated_at: stamp, created_by: myId, updated_by: myId, deleted_at: null }
}

/** Données et écritures de l'outil Voyages, optimistes comme les Courses (voir `useOptimisticWrites`). */
export function TripsProvider({ children }: { children: ReactNode }) {
  const client = useClient()
  const queryClient = useQueryClient()
  const { household, me } = useHousehold()
  const myId = me?.profile.id ?? null
  const key = tripsKey(household.id)
  const query = useLiveQuery({ tables: TRIP_TABLES, queryKey: key, queryFn: () => fetchTrips(client, household.id) })
  const { write, error, dismissError } = useOptimisticWrites<TripsData>(key)

  const value = useMemo<TripsValue>(() => {
    const current = () => queryClient.getQueryData<TripsData>(key)
    const replace = <R extends { id: string }>(list: R[], id: string, patch: Partial<R>) =>
      list.map((r) => (r.id === id ? { ...r, ...patch } : r))
    const without = <R extends { id: string }>(list: R[], id: string) => list.filter((r) => r.id !== id)

    return {
      data: query.data,
      updatedAt: query.dataUpdatedAt,
      isPending: query.isPending,
      settled: isSettled(query),
      isError: query.isError,
      refetch: () => void query.refetch(),
      error,
      dismissError,

      createTrip(fields) {
        const trip: Trip = {
          id: uuidv7(),
          household_id: household.id,
          title: fields.title,
          destination: fields.destination ?? null,
          start_date: fields.start_date ?? null,
          end_date: fields.end_date ?? null,
          status: fields.status ?? 'idea',
          cover_emoji: fields.cover_emoji ?? null,
          notes: fields.notes ?? null,
          archived_at: null,
          ...stamps(myId),
        }
        write(
          (d) => ({ ...d, trips: [...d.trips, trip] }),
          () => writes.insert(client, 'trip', { id: trip.id, household_id: household.id, ...fields }),
          'Le voyage n’a pas été créé. Réessaie.',
        )
        return trip.id
      },

      updateTrip(trip, patch) {
        write(
          (d) => ({ ...d, trips: replace(d.trips, trip.id, patch as Partial<Trip>) }),
          () => writes.update(client, 'trip', trip.id, patch),
          'Le voyage n’a pas été modifié. Réessaie.',
        )
      },

      removeTrip(trip) {
        write(
          (d) => ({ ...d, trips: without(d.trips, trip.id) }),
          () => writes.update(client, 'trip', trip.id, { deleted_at: now() }),
          'Le voyage n’a pas été supprimé. Réessaie.',
        )
      },

      addIdea(tripId, title) {
        const ideas = current()?.ideas.filter((i) => i.trip_id === tripId) ?? []
        const idea: TripIdea = {
          id: uuidv7(),
          household_id: household.id,
          trip_id: tripId,
          title,
          url: null,
          note: null,
          done: false,
          planned_date: null,
          sort_order: nextSortOrder(ideas),
          ...stamps(myId),
        }
        write(
          (d) => ({ ...d, ideas: [...d.ideas, idea] }),
          () =>
            writes.insert(client, 'trip_activity', {
              id: idea.id,
              household_id: household.id,
              trip_id: tripId,
              title,
              sort_order: idea.sort_order,
            }),
          'L’idée n’a pas été ajoutée. Réessaie.',
        )
      },

      updateIdea(idea, patch) {
        write(
          (d) => ({ ...d, ideas: replace(d.ideas, idea.id, patch as Partial<TripIdea>) }),
          () => writes.update(client, 'trip_activity', idea.id, patch),
          'L’idée n’a pas été modifiée. Réessaie.',
        )
      },

      removeIdea(idea) {
        write(
          (d) => ({ ...d, ideas: without(d.ideas, idea.id) }),
          () => writes.update(client, 'trip_activity', idea.id, { deleted_at: now() }),
          'L’idée n’a pas été supprimée. Réessaie.',
        )
      },

      createPrepList(trip) {
        const list = {
          id: uuidv7(),
          household_id: household.id,
          kind: 'trip_prep' as const,
          name: 'Préparation',
          is_default: false,
          sort_order: 1,
          trip_id: trip.id,
          archived_at: null,
          ...stamps(myId),
        }
        write(
          (d) => ({ ...d, prepLists: [...d.prepLists, list] }),
          () =>
            writes.insert(client, 'checklist', {
              id: list.id,
              household_id: household.id,
              kind: 'trip_prep',
              name: list.name,
              trip_id: trip.id,
              sort_order: 1,
            }),
          'La checklist n’a pas été créée. Réessaie.',
        )
      },

      addPrepItems(listId, input) {
        const inList = current()?.prepItems.filter((i) => i.checklist_id === listId) ?? []
        const known = new Set(inList.map((i) => i.label.trim().toLowerCase()))
        let order = nextSortOrder(inList)
        const items: PrepItem[] = parseQuickAdd(input)
          .filter((e) => !known.has(e.label.trim().toLowerCase()))
          .map((e) => ({
            id: uuidv7(),
            household_id: household.id,
            checklist_id: listId,
            label: e.label,
            quantity: e.quantity,
            note: null,
            category_id: null,
            catalog_item_id: null,
            checked: false,
            checked_by: null,
            checked_at: null,
            sort_order: order++,
            ...stamps(myId),
          }))
        if (items.length === 0) return 0
        write(
          (d) => ({ ...d, prepItems: [...d.prepItems, ...items] }),
          () =>
            writes.insert(
              client,
              'checklist_item',
              items.map((i) => ({
                id: i.id,
                household_id: i.household_id,
                checklist_id: i.checklist_id,
                label: i.label,
                quantity: i.quantity,
                sort_order: i.sort_order,
              })) as never,
            ),
          items.length > 1 ? 'Les éléments n’ont pas été ajoutés. Réessaie.' : 'L’élément n’a pas été ajouté. Réessaie.',
        )
        return items.length
      },

      togglePrepItem(item) {
        const checked = !item.checked
        write(
          (d) => ({
            ...d,
            prepItems: replace(d.prepItems, item.id, { checked, checked_by: checked ? myId : null, checked_at: checked ? now() : null }),
          }),
          () => writes.update(client, 'checklist_item', item.id, { checked }),
          `« ${item.label} » n’a pas été ${checked ? 'coché' : 'décoché'}. Réessaie.`,
        )
      },

      updatePrepItem(item, patch) {
        write(
          (d) => ({ ...d, prepItems: replace(d.prepItems, item.id, patch as Partial<PrepItem>) }),
          () => writes.update(client, 'checklist_item', item.id, patch),
          'La modification n’a pas été enregistrée. Réessaie.',
        )
      },

      removePrepItem(item) {
        write(
          (d) => ({ ...d, prepItems: without(d.prepItems, item.id) }),
          () => writes.update(client, 'checklist_item', item.id, { deleted_at: now() }),
          `« ${item.label} » n’a pas été supprimé. Réessaie.`,
        )
      },

      saveBooking(tripId, fields, existing) {
        if (existing) {
          write(
            (d) => ({ ...d, bookings: replace(d.bookings, existing.id, fields as Partial<Booking>) }),
            () => writes.update(client, 'booking', existing.id, fields),
            'La réservation n’a pas été modifiée. Réessaie.',
          )
          return existing.id
        }
        const booking: Booking = {
          id: uuidv7(),
          household_id: household.id,
          trip_id: tripId,
          kind: fields.kind,
          title: fields.title,
          starts_at: fields.starts_at ?? null,
          ends_at: fields.ends_at ?? null,
          tz: fields.tz ?? null,
          reference: fields.reference ?? null,
          url: fields.url ?? null,
          note: fields.note ?? null,
          amount: fields.amount ?? null,
          currency: fields.currency ?? null,
          ...stamps(myId),
        }
        write(
          (d) => ({ ...d, bookings: [...d.bookings, booking] }),
          () => writes.insert(client, 'booking', { id: booking.id, household_id: household.id, trip_id: tripId, ...fields }),
          'La réservation n’a pas été ajoutée. Réessaie.',
        )
        return booking.id
      },

      removeBooking(booking) {
        write(
          (d) => ({
            ...d,
            bookings: without(d.bookings, booking.id),
            attachments: d.attachments.filter((a) => a.entity_id !== booking.id),
          }),
          () => writes.update(client, 'booking', booking.id, { deleted_at: now() }),
          'La réservation n’a pas été supprimée. Réessaie.',
        )
      },

      saveBudgetLine(tripId, fields, existing) {
        if (existing) {
          write(
            (d) => ({ ...d, budget: replace(d.budget, existing.id, fields as Partial<BudgetLine>) }),
            () => writes.update(client, 'trip_budget_line', existing.id, fields),
            'Le poste de budget n’a pas été modifié. Réessaie.',
          )
          return
        }
        const lines = current()?.budget.filter((b) => b.trip_id === tripId) ?? []
        const line: BudgetLine = {
          id: uuidv7(),
          household_id: household.id,
          trip_id: tripId,
          category: fields.category,
          planned_amount: fields.planned_amount ?? null,
          currency: fields.currency,
          sort_order: nextSortOrder(lines),
          ...stamps(myId),
        }
        write(
          (d) => ({ ...d, budget: [...d.budget, line] }),
          () =>
            writes.insert(client, 'trip_budget_line', {
              id: line.id,
              household_id: household.id,
              trip_id: tripId,
              sort_order: line.sort_order,
              ...fields,
            }),
          'Le poste de budget n’a pas été ajouté. Ce poste existe peut-être déjà.',
        )
      },

      removeBudgetLine(line) {
        write(
          (d) => ({ ...d, budget: without(d.budget, line.id) }),
          () => writes.update(client, 'trip_budget_line', line.id, { deleted_at: now() }),
          'Le poste de budget n’a pas été supprimé. Réessaie.',
        )
      },

      async attach(booking, file) {
        if (file.size > MAX_ATTACHMENT) throw new Error('Ce fichier dépasse 20 Mo.')
        const id = uuidv7()
        const path = `${household.id}/booking/${booking.id}/${id}`
        const upload = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' })
        if (upload.error) throw new Error('Le fichier n’a pas été envoyé. Vérifie la connexion puis réessaie.')
        const row = await client.from('attachment').insert({
          id,
          household_id: household.id,
          entity_type: 'booking',
          entity_id: booking.id,
          storage_path: path,
          file_name: file.name.slice(0, 200) || 'fichier',
          mime_type: (file.type || 'application/octet-stream').slice(0, 120),
          size_bytes: file.size,
        })
        if (row.error) {
          // Sans sa ligne, le fichier serait introuvable : on le retire du bucket.
          await client.storage.from(BUCKET).remove([path])
          throw new Error('La pièce jointe n’a pas été enregistrée. Réessaie.')
        }
        await queryClient.invalidateQueries({ queryKey: key })
      },

      removeAttachment(attachment) {
        write(
          (d) => ({ ...d, attachments: without(d.attachments, attachment.id) }),
          () => writes.update(client, 'attachment', attachment.id, { deleted_at: now() }),
          'La pièce jointe n’a pas été retirée. Réessaie.',
        )
      },

      async signedUrl(attachment) {
        const { data, error } = await client.storage.from(BUCKET).createSignedUrl(attachment.storage_path, 60)
        if (error || !data) throw new Error('La pièce jointe ne s’ouvre pas. Vérifie la connexion puis réessaie.')
        return data.signedUrl
      },
    }
    // key est dérivée de household.id ; query change quand ses données changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queryClient, household.id, myId, query.data, query.dataUpdatedAt, query.isPending, query.isError, query.isFetchedAfterMount, query.fetchStatus, error, dismissError, write])

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
}

export function useTrips(): TripsValue {
  const value = useContext(TripsContext)
  if (!value) throw new Error('useTrips doit être appelé sous <TripsProvider>')
  return value
}
