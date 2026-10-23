import type { OhoClient } from '../client'
import type { Json } from '../db/database.types'

/** Sauvegardes de l'espace (lot 11) : export JSON, lecture d'un fichier, restauration. */

export interface Backup {
  format: 'oho-export'
  version: 1
  exported_at: string
  household_id: string
  household: { name: string }
  tables: Record<string, unknown[]>
}

export interface BackupSummary {
  exportedAt: string
  householdName: string
  /** Lignes restaurables (hors journal et cache TMDB). */
  rows: number
}

export const BACKUP_BUCKET = 'backups'

/** Tables qui ne reviennent pas à la restauration : le journal est immuable, le cache est partagé. */
const notRestored = new Set(['activity_log', 'external_media'])

export async function exportHousehold(client: OhoClient, householdId: string): Promise<Backup> {
  const { data, error } = await client.rpc('export_household', { p_household: householdId })
  if (error || !data) throw new Error('L’export a échoué. Vérifie la connexion puis réessaie.')
  return data as unknown as Backup
}

/** Lit un fichier choisi : refuse ce qui n'est pas un export OhO de cet espace, avec un message clair. */
export function readBackup(text: string, householdId: string): { backup: Backup; summary: BackupSummary } | { error: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'Ce fichier n’est pas un export OhO (JSON illisible).' }
  }
  const backup = data as Partial<Backup>
  if (backup?.format !== 'oho-export' || !backup.tables || typeof backup.tables !== 'object') return { error: 'Ce fichier n’est pas un export OhO.' }
  if (backup.version !== 1) return { error: 'Cet export vient d’une version d’OhO que cette app ne sait pas lire.' }
  if (backup.household_id !== householdId) return { error: 'Cet export vient d’un autre espace : il ne peut pas être restauré ici.' }
  const rows = Object.entries(backup.tables)
    .filter(([table]) => !notRestored.has(table))
    .reduce((n, [, list]) => n + (Array.isArray(list) ? list.length : 0), 0)
  return {
    backup: backup as Backup,
    summary: { exportedAt: backup.exported_at ?? '', householdName: backup.household?.name ?? '', rows },
  }
}

/** Restaure d'un bloc ; rend le nombre de lignes réécrites. */
export async function restoreBackup(client: OhoClient, backup: Backup): Promise<number> {
  const { data, error } = await client.rpc('import_household', { p_data: backup as unknown as Json })
  if (error) {
    throw new Error(
      error.code === '23505' || error.code === '23514'
        ? 'La restauration a été refusée : une donnée ajoutée depuis entre en conflit avec la sauvegarde. Rien n’a changé.'
        : 'La restauration a échoué. Rien n’a changé ; vérifie la connexion puis réessaie.',
    )
  }
  return Object.values((data ?? {}) as Record<string, number>).reduce((n, c) => n + c, 0)
}

/** « oho-export-2026-10-23.json » */
export const backupFileName = (date = new Date()) => `oho-export-${date.toISOString().slice(0, 10)}.json`

/** Fait télécharger un objet en JSON par le navigateur. */
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
