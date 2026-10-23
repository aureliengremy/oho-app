import type { ActivityEntry } from './queries'

const verbs: Record<string, string> = {
  created: 'a ajouté',
  updated: 'a modifié',
  deleted: 'a supprimé',
  restored: 'a restauré',
  archived: 'a archivé',
  unarchived: 'a désarchivé',
  checked: 'a coché',
  unchecked: 'a décoché',
}

/** « de Costco », « d’Épicerie » : élision devant une voyelle ou un h. */
function ofName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûüœæ]/i.test(name) ? `d’${name}` : `de ${name}`
}

export function describeActivity(entry: Pick<ActivityEntry, 'action' | 'entity_label'>): string {
  if (entry.action === 'imported') return entry.entity_label ? `a restauré la sauvegarde du ${entry.entity_label}` : 'a restauré une sauvegarde'
  if (entry.action === 'cleared') return entry.entity_label ? `a vidé le panier ${ofName(entry.entity_label)}` : 'a vidé le panier'
  const verb = verbs[entry.action] ?? 'a modifié'
  return entry.entity_label ? `${verb} ${entry.entity_label}` : verb
}
