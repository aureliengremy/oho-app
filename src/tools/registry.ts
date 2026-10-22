import type { ComponentType } from 'react'

/** Clé d'un outil, identique à `tool_activation.tool_key` en base. */
export type ToolKey = 'shopping' | 'trips' | 'watchlist' | 'expenses'

export interface ToolDefinition {
  key: ToolKey
  /** Libellé affiché sur l'accueil et dans la barre d'onglets. */
  label: string
  /** Chemin de la route racine de l'outil, ex. « /courses ». */
  path: string
  /** Ordre par défaut ; l'ordre réel vient de `tool_activation.sort_order`. */
  defaultOrder: number
  /** Écran racine de l'outil, chargé à la demande. */
  load: () => Promise<{ default: ComponentType }>
}

/**
 * Registre des outils. Ajouter un outil = ses migrations, un dossier `src/tools/<clé>/`
 * et une entrée ici. Rien d'autre à toucher (voir CLAUDE.md).
 * Vide au lot 1 : Courses arrive au lot 4.
 */
export const tools: readonly ToolDefinition[] = []

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
