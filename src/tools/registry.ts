import type { ComponentType } from 'react'
import { BriefcaseBusiness, CalendarDays, ShoppingCart, Tv, Wallet, type LucideIcon } from 'lucide-react'

/** Clé d'un outil, identique à `tool_activation.tool_key` en base. */
export type ToolKey = 'shopping' | 'agenda' | 'trips' | 'watchlist' | 'expenses'

export interface ToolDefinition {
  key: ToolKey
  /** Libellé affiché sur l'accueil et dans la barre d'onglets. */
  label: string
  /** Chemin de la route racine de l'outil, ex. « /courses ». */
  path: string
  icon: LucideIcon
  /** Ordre par défaut ; l'ordre réel vient de `tool_activation.sort_order`. */
  defaultOrder: number
  /** Tables de l'outil suivies en temps réel (lot 5) : un changement recharge les écrans qui les lisent. */
  tables: readonly string[]
  /** Écran racine de l'outil, chargé à la demande. */
  load: () => Promise<{ default: ComponentType }>
  /** Carte facultative en tête de l'accueil (ex. « Prochain voyage »), chargée à la demande. */
  homeCard?: () => Promise<{ default: ComponentType }>
}

/**
 * Registre des outils. Ajouter un outil = ses migrations, un dossier `src/tools/<clé>/`
 * et une entrée ici. Rien d'autre à toucher (voir CLAUDE.md).
 */
export const tools: readonly ToolDefinition[] = [
  {
    key: 'shopping',
    label: 'Courses',
    path: '/courses',
    icon: ShoppingCart,
    defaultOrder: 1,
    tables: ['checklist', 'checklist_item', 'shopping_category', 'catalog_item'],
    load: () => import('./shopping'),
  },
  {
    key: 'agenda',
    label: 'Agenda',
    path: '/agenda',
    icon: CalendarDays,
    defaultOrder: 2,
    // Lu dans Google Agenda par la fonction « agenda » : aucune table, pas de temps réel.
    tables: [],
    load: () => import('./agenda'),
    homeCard: () => import('./agenda/HomeCard'),
  },
  {
    key: 'trips',
    label: 'Voyages',
    path: '/voyages',
    icon: BriefcaseBusiness,
    // Après les quatre onglets : Voyages vit dans la grille de l'accueil (lot 15).
    defaultOrder: 5,
    tables: ['trip', 'trip_activity', 'booking', 'trip_budget_line', 'attachment', 'checklist', 'checklist_item'],
    load: () => import('./trips'),
    homeCard: () => import('./trips/HomeCard'),
  },
  {
    key: 'watchlist',
    label: 'À regarder',
    path: '/a-regarder',
    icon: Tv,
    defaultOrder: 3,
    tables: ['watch_item', 'watch_rating', 'watch_platform'],
    load: () => import('./watchlist'),
  },
  {
    key: 'expenses',
    label: 'Dépenses',
    path: '/depenses',
    icon: Wallet,
    defaultOrder: 4,
    tables: ['expense_book', 'expense', 'expense_share', 'settlement'],
    load: () => import('./expenses'),
  },
]

/** Nombre d'outils dans la barre du bas, à côté d'Accueil (décision D1). */
export const MAX_TAB_TOOLS = 4

export function findTool(key: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.key === key)
}

/** Outils à afficher, dans l'ordre : ceux du registre qui sont activés pour l'espace. */
export function activeTools(
  activations: ReadonlyArray<{ tool_key: string; enabled: boolean; sort_order: number }>,
  registry: readonly ToolDefinition[] = tools,
): ToolDefinition[] {
  const order = new Map(activations.filter((a) => a.enabled).map((a) => [a.tool_key, a.sort_order]))
  return registry
    .filter((tool) => order.has(tool.key))
    .sort((a, b) => (order.get(a.key) ?? a.defaultOrder) - (order.get(b.key) ?? b.defaultOrder))
}
