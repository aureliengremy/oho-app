import type { ComponentType } from 'react'
import { BriefcaseBusiness, ShoppingCart, Tv, Wallet, type LucideIcon } from 'lucide-react'

/** Clé d'un outil, identique à `tool_activation.tool_key` en base. */
export type ToolKey = 'shopping' | 'trips' | 'watchlist' | 'expenses'

export interface ToolDefinition {
  key: ToolKey
  /** Libellé affiché sur l'accueil et dans la barre d'onglets. */
  label: string
  /** Chemin de la route racine de l'outil, ex. « /courses ». */
  path: string
  icon: LucideIcon
  /** Ordre par défaut ; l'ordre réel vient de `tool_activation.sort_order`. */
  defaultOrder: number
  /** Écran racine de l'outil, chargé à la demande. */
  load: () => Promise<{ default: ComponentType }>
}

/**
 * Registre des outils. Ajouter un outil = ses migrations, un dossier `src/tools/<clé>/`
 * et une entrée ici. Rien d'autre à toucher (voir CLAUDE.md).
 */
export const tools: readonly ToolDefinition[] = [
  { key: 'shopping', label: 'Courses', path: '/courses', icon: ShoppingCart, defaultOrder: 1, load: () => import('./shopping') },
  { key: 'trips', label: 'Voyages', path: '/voyages', icon: BriefcaseBusiness, defaultOrder: 2, load: () => import('./trips') },
  { key: 'watchlist', label: 'À regarder', path: '/a-regarder', icon: Tv, defaultOrder: 3, load: () => import('./watchlist') },
  { key: 'expenses', label: 'Dépenses', path: '/depenses', icon: Wallet, defaultOrder: 4, load: () => import('./expenses') },
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
