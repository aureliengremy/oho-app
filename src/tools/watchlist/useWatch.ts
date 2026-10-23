import { createContext, useContext } from 'react'
import type { TablesUpdate } from '@/core/db/database.types'
import type { Media, Platform, SearchResult, WatchData, WatchItem, WatchKind } from './model'

export interface NewItem {
  title: string
  kind: WatchKind
  platform_id: string | null
  runtime_min?: number | null
}

export interface WatchValue {
  data: WatchData | undefined
  updatedAt: number
  isPending: boolean
  /** Les données ont été relues depuis l'ouverture (et pas seulement restaurées du cache de l'appareil). */
  settled: boolean
  isError: boolean
  refetch: () => void
  error: string | null
  dismissError: () => void
  /** Durée max du filtre « ce soir » pour l'espace, en minutes. */
  tonightMax: number
  setTonightMax: (minutes: number) => Promise<void>
  addItem: (fields: NewItem, media?: Media) => string
  /** Importe la fiche TMDB (fonction serveur) puis ajoute le titre ; rejette avec un message lisible. */
  addFromTmdb: (result: SearchResult, platformId: string | null) => Promise<string>
  search: (query: string) => Promise<SearchResult[]>
  updateItem: (item: WatchItem, patch: TablesUpdate<'watch_item'>) => void
  removeItem: (item: WatchItem) => void
  rate: (item: WatchItem, rating: number, comment: string | null) => void
  addPlatform: (name: string) => void
  updatePlatform: (platform: Platform, patch: TablesUpdate<'watch_platform'>) => void
  removePlatform: (platform: Platform) => void
}

export const WatchContext = createContext<WatchValue | null>(null)

export function useWatch(): WatchValue {
  const value = useContext(WatchContext)
  if (!value) throw new Error('useWatch doit être appelé sous <WatchProvider>')
  return value
}
