import { describe, expect, it } from 'vitest'
import { backupFileName, readBackup } from './backup'

const backup = {
  format: 'oho-export',
  version: 1,
  exported_at: '2026-10-20T12:00:00Z',
  household_id: 'hh-1',
  household: { name: 'Aurélien & Auriane' },
  tables: { trip: [{}, {}], checklist_item: [{}], activity_log: [{}, {}, {}], external_media: [{}] },
}

describe('lire une sauvegarde', () => {
  it('résume un export de cet espace, sans compter journal ni cache', () => {
    expect(readBackup(JSON.stringify(backup), 'hh-1')).toMatchObject({
      summary: { exportedAt: '2026-10-20T12:00:00Z', householdName: 'Aurélien & Auriane', rows: 3 },
    })
  })

  it('refuse avec un message clair', () => {
    expect(readBackup('pas du json', 'hh-1')).toEqual({ error: 'Ce fichier n’est pas un export OhO (JSON illisible).' })
    expect(readBackup(JSON.stringify({ hello: 1 }), 'hh-1')).toEqual({ error: 'Ce fichier n’est pas un export OhO.' })
    expect(readBackup(JSON.stringify({ ...backup, version: 2 }), 'hh-1')).toMatchObject({ error: expect.stringContaining('version') })
    expect(readBackup(JSON.stringify(backup), 'hh-2')).toMatchObject({ error: expect.stringContaining('autre espace') })
  })

  it('nomme le fichier par la date', () => {
    expect(backupFileName(new Date('2026-10-23T08:00:00Z'))).toBe('oho-export-2026-10-23.json')
  })
})
