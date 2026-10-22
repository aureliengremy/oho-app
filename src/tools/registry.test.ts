import { describe, expect, it } from 'vitest'
import { activeTools, type ToolDefinition } from './registry'

const Empty = () => null
const tool = (key: ToolDefinition['key'], defaultOrder: number): ToolDefinition => ({
  key,
  label: key,
  path: `/${key}`,
  defaultOrder,
  load: async () => ({ default: Empty }),
})

describe('activeTools', () => {
  const registry = [tool('shopping', 1), tool('trips', 2), tool('watchlist', 3)]

  it("garde seulement les outils activés pour l'espace, dans l'ordre de l'espace", () => {
    const result = activeTools(
      [
        { tool_key: 'watchlist', enabled: true, sort_order: 1 },
        { tool_key: 'shopping', enabled: true, sort_order: 2 },
        { tool_key: 'trips', enabled: false, sort_order: 3 },
      ],
      registry,
    )
    expect(result.map((t) => t.key)).toEqual(['watchlist', 'shopping'])
  })

  it("ignore une activation dont l'outil n'existe pas encore dans le registre", () => {
    const result = activeTools([{ tool_key: 'expenses', enabled: true, sort_order: 1 }], registry)
    expect(result).toEqual([])
  })
})
