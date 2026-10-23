# Lot 11 : sauvegardes, export et état du système

> Entrée : lot 5, PLAN lot 11, `docs/DECISIONS.md` (S16).
> Acceptation : export, puis suppression, puis import restaure l'état à l'identique. **Vérifié en base** par `npm run test:db`. Après des suppressions douces et physiques, des modifications et un renommage de l'espace, chaque table réexportée est identique octet pour octet à l'export de départ (horodatages compris). Le parcours de l'écran est couvert sur un faux client. **À confirmer en vrai :** la sauvegarde du dimanche, une fois la fonction `backup` déployée.

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| Migration `20261023001100_sauvegardes.sql` | **`export_household`** rend tout l'espace en JSON, format `oho-export` version 1. Il contient :<br>- les 18 tables de l'espace ;<br>- le journal d'activité ;<br>- les fiches TMDB citées ;<br>- les membres nommés, pour lire le fichier à la main.<br><br>Réservé aux membres et au service.<br><br>**`import_household`** restaure par upsert sur la clé, dans l'ordre des clés étrangères. Le temps de l'écriture, les triggers de chaque table sont coupés : rien n'est réhorodaté, il n'y a pas de journal ligne à ligne (donc pas de notification), et le catalogue et les coches ne sont pas recalculés. Les clés étrangères et les contraintes restent actives. La somme des parts des dépenses est revérifiée à la fin. Tout ou rien. Une seule ligne de journal, « a restauré la sauvegarde du … ». |
| Garde-fous de l'import | - Seul un membre de l'espace exporté peut restaurer.<br>- Toute ligne d'un autre espace fait refuser le fichier.<br>- Une ligne existante d'un autre espace n'est jamais réécrite.<br>- **Le cache TMDB partagé n'est jamais écrit depuis un fichier**. Un titre dont la fiche a disparu revient sans fiche. |
| Sauvegarde du dimanche (S16) | Edge Function **`backup`**, appelée le dimanche à 4 h UTC par `pg_cron` et `pg_net` :<br>- elle écrit `{espace}/{AAAA-MM-JJ}.json` dans le bucket privé **`backups`**, lisible par les membres ;<br>- elle garde les 8 plus récentes ;<br>- les chemins et la rotation sont dans `plan.ts`, testé. |
| Journal d'erreurs | Table **`client_error`** (à la place de Sentry) :<br>- chacun signale pour soi et les membres lisent ;<br>- purge après 30 jours.<br><br>Dans l'app :<br>- `ErrorReporter` envoie les erreurs non rattrapées et les promesses rejetées. Une même erreur ne part qu'une fois par session, et au plus 20 erreurs par session. On garde le chemin sans paramètres, le navigateur et la version.<br>- Une erreur de rendu affiche « Quelque chose s'est cassé » avec « Recharger », dans la coquille de l'app. |
| « État du système » (`/etat`, depuis Réglages) | **État :** réseau, serveur (ping et temps de réponse), temps réel, modifications en attente, version (commit et date de construction).<br>**Sauvegardes :** « Exporter l'espace » (téléchargement JSON), « Restaurer depuis un fichier » (le fichier est vérifié, puis une confirmation avec la date et le nombre de lignes), sauvegardes du dimanche à télécharger.<br>**Erreurs récentes :** qui, où, quelle version, quand. |

## Décisions prises dans ce lot

- **Restaurer ne supprime rien.** Les lignes de la sauvegarde reviennent telles quelles, y compris les suppressions et les modifications. Ce qui a été ajouté après la sauvegarde reste en place. Si l'un de ces ajouts entre en conflit, par exemple une liste recréée sous le même nom, la restauration est refusée sans rien changer, et l'écran le dit.
- **Le journal d'activité est exporté mais jamais réimporté** : il est immuable. Les comptes ne sont jamais réimportés non plus.
- **Un membre peut restaurer**, pas seulement le propriétaire : vous êtes deux et vous vous faites confiance. Restaurer reprend les auteurs et les horodatages du fichier.
- **La sauvegarde du dimanche reste chez Supabase**, dans un bucket privé. Pour une copie hors de Supabase, « Exporter l'espace » donne le même fichier à garder ailleurs.
- Le secret partagé des tâches planifiées (`PUSH_CRON_SECRET`, Vault `push_cron_secret`) sert aussi à la sauvegarde.

## Pour brancher la sauvegarde du dimanche (à faire une fois)

1. Avoir fait les étapes 3 et 5 de `docs/LOT-10.md` : `PUSH_CRON_SECRET` et les secrets Vault `project_url` et `push_cron_secret`.
2. `npx supabase functions deploy backup`. La fonction n'exige pas de JWT, voir `supabase/config.toml`.
3. Pour tester sans attendre dimanche :
   `curl -X POST https://<ref>.supabase.co/functions/v1/backup -H "x-cron-secret: <secret>"`
   La sauvegarde apparaît dans « État du système ».

## Tests

- `supabase/tests/backup.test.sql` couvre :
  - l'export, les dégâts puis l'import, avec une identité exacte table par table, une seule ligne de journal et aucune notification ;
  - les fichiers refusés : autre format, ligne d'un autre espace ;
  - le cache TMDB, qui reste intact ;
  - l'intrus refusé, et l'export par le service ;
  - le journal d'erreurs : signaler pour soi, lecture, longueur, purge.
- `src/core/backup/backup.test.ts` couvre la lecture d'un fichier (résumé, refus clairs) et le nom du fichier.
- `supabase/functions/backup/plan.test.ts` couvre les chemins et la rotation sur 8.
- `src/app/screens/status.test.tsx` couvre :
  - les lignes d'état ;
  - l'export téléchargé ;
  - l'export, la suppression, la restauration puis le voyage revenu ;
  - un fichier d'un autre espace refusé ;
  - les sauvegardes du dimanche ;
  - une erreur non rattrapée envoyée une seule fois.

## Démo manuelle

1. Réglages → « État du système et sauvegardes » : tout est vert, la version est affichée.
2. « Exporter l'espace » : le fichier `oho-export-AAAA-MM-JJ.json` se télécharge.
3. Supprimer un voyage et vider le panier des Courses.
4. « Restaurer depuis un fichier », choisir l'export, puis « Restaurer » : le voyage et les articles reviennent. L'activité affiche « a restauré la sauvegarde du … ».
