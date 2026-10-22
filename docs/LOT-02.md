# Lot 2 : modèle de données socle et migrations

> Entrée : `docs/cadrage/modele-donnees.html` (onglets II, III, IV), `docs/DECISIONS.md` (M1 à M7), `PLAN.md` §6.
> Acceptation : des tests d'accès prouvent qu'un compte hors espace ne voit rien. **Atteint** (`scripts/db-test.sh`, 26 tests).

## Ce qui a été fait

| Fichier | Contenu |
|---|---|
| `supabase/migrations/20261023000100_socle.sql` | Schéma `private`, enum `membership_role`, `private.uuid_generate_v7()`, fonctions `touch_row`, `is_member`, `is_owner`, `shares_household`, `log_activity`, `handle_new_user`, `purge_tombstones`, RPC `public.create_household`. Tables `profile`, `household`, `membership`, `tool_activation`, `activity_log`, avec RLS, policies, GRANT et Realtime. |
| `supabase/migrations/20261023000200_courses.sql` | Enum `checklist_kind`, tables `shopping_category`, `catalog_item`, `checklist`, `checklist_item` ; FK composites `(household_id, id)` ; triggers `catalog_learn`, `stamp_checked`, `touch_row`, `log_activity` ; RLS, GRANT et Realtime. |
| `supabase/migrations/20261023000300_purge_schedule.sql` | Planifie la purge chaque jour à 3 h 30 UTC avec `pg_cron`. Ne fait rien si l'extension est absente. |
| `supabase/seed.sql` | Deux comptes, l'espace « Aurélien & Auriane », deux adhésions, quatre outils (seul `shopping` est activé), sept rayons, la liste « Épicerie » par défaut et sept items. Le catalogue se remplit par trigger. Le seed est rejouable. |
| `supabase/tests/supabase-stub.sql` | Le minimum que fournit Supabase : rôles `anon`, `authenticated` et `service_role`, schéma `auth` (`users`, `identities`, `uid()`, `role()`, `jwt()`), `pgcrypto` dans `extensions`, publication `supabase_realtime`. |
| `supabase/tests/helpers.sql` | Schéma `tests` : `login(email)`, `login_anon()`, `logout()`, `assert`, `throws(sql, sqlstate)`, `affected(sql)`, `create_user`. |
| `supabase/tests/rls.test.sql` | Les tests d'accès. |
| `supabase/tests/triggers.test.sql` | Les tests des triggers et des conventions. |
| `scripts/db-test.sh` | Le cluster Postgres 16 jetable et l'enchaînement de tous les fichiers. |
| `src/core/db/database.types.ts` | Les types au format `supabase gen types typescript`. |

### Conventions appliquées

- **Colonnes communes** sur les tables de foyer : `id` (UUID v7 par défaut), `household_id` (FK `household` en cascade), `created_at`, `updated_at`, `created_by`, `updated_by` (FK `profile` en `SET NULL`) et `deleted_at`. `archived_at` existe sur `checklist` et `shopping_category`.
- **`touch_row`** (BEFORE INSERT OR UPDATE) :
  - à l'insertion, `created_by = auth.uid()` dès qu'un compte écrit, ce qui empêche d'écrire au nom de l'autre ;
  - à chaque écriture, `updated_at` prend l'heure du serveur et `updated_by` prend `auth.uid()` ;
  - `id`, `household_id`, `created_at` et `created_by` ne changent plus après l'insertion. Un changement de `household_id` lève une erreur.
- **RLS** : la règle unique est `private.is_member(household_id)`, en `security definer`, avec `(select auth.uid())`. `activity_log` n'a qu'une policy SELECT. Le profil est lisible par son titulaire et par les membres d'un foyer commun, et modifiable par son titulaire seul.
- **FK composites** : `checklist`, `shopping_category` et `catalog_item` exposent `unique (household_id, id)`. Les enfants y pointent avec `on delete set null (col)` (Postgres 15 ou plus) ou en cascade.
- **Index** :
  - `(household_id, updated_at)` sur chaque table de foyer ;
  - un index sur chaque colonne de FK, y compris les `*_by` ;
  - les index d'écran prévus par le document ;
  - toute contrainte d'unicité sur une table à `deleted_at` est un index partiel `where deleted_at is null`.
- **Journal** : `log_activity` (security definer) écrit les actions `created`, `updated`, `deleted`, `restored`, `archived`, `unarchived`, `checked` et `unchecked`. Le payload contient le diff `{champ: {old, new}}` et `entity_label` garde un instantané du libellé. Une mise à jour qui ne touche que `sort_order` n'est pas journalisée. Pour une checklist de type `trip_prep`, `tool_key` vaut `trips` : la clé d'outil est calculée par une fonction passée en argument du trigger.
- **Catalogue** : `label_key = lower(btrim(label))`, unique par foyer (M7). `catalog_learn` fait l'upsert à chaque ajout dans une liste `shopping`, renseigne `catalog_item_id` et **propose le rayon appris** quand l'item n'en a pas.
- **Purge** : `private.purge_tombstones(interval '30 days')` parcourt toutes les tables `public` qui ont une colonne `deleted_at`. Une table ajoutée plus tard sera donc purgée sans rien changer. Les cascades nettoient les enfants, et la purge n'écrit pas au journal.

## Décisions prises en cours de route

1. **Aucun DELETE pour `authenticated`.** La suppression passe par `update … set deleted_at = now()` (M1). La suppression physique est réservée à la purge et à `service_role`. La policy du document reste en `for all`, mais c'est le GRANT qui ferme la porte.
2. **Une pierre tombale reste lisible.** La RLS ne masque pas les lignes où `deleted_at` est rempli : la synchronisation doit voir passer la suppression (`updated_at > curseur`). C'est **le client qui filtre** `deleted_at is null`, comme le prévoit le document (« le client filtre sur le parent »).
3. **`is_member()` ignore les adhésions supprimées** (`and m.deleted_at is null`), sinon un membre retiré garderait l'accès. Le document ne le précisait pas.
4. **`membership` : `unique (household_id, user_id)` est une contrainte pleine**, et non un index partiel. Les futures FK composites de `notification_pref`, `expense` et `expense_share` en ont besoin comme cible. Un membre qui revient voit donc sa ligne restaurée, au lieu d'en recevoir une nouvelle.
5. **Seuls les propriétaires gèrent les adhésions** (policies insert et update sur `is_owner`). Les deux comptes du seed sont `owner`.
6. **`public.create_household(name, timezone)`** : un INSERT direct dans `household` ne peut pas passer la RLS, parce qu'on n'est pas encore membre du nouveau foyer. Cette RPC crée le foyer et l'adhésion `owner` d'un seul coup. Il n'y a pas de policy INSERT sur `household`.
7. **`uuid_generate_v7()` vit dans `private`** : le client génère ses propres id, il est donc inutile d'exposer la fonction en RPC. Elle n'a pas besoin de `pgcrypto` (elle s'appuie sur `gen_random_uuid()` du cœur de Postgres).
8. **`household.timezone`** est contrôlé par `private.is_valid_timezone()`, utilisé dans un CHECK. Il n'y a pas de valeur par défaut ; le seed utilise `America/Toronto`.
9. **`activity_log` est immuable même pour `service_role`**, grâce à un trigger BEFORE UPDATE. DELETE reste possible pour les cascades et la purge du journal (M13, lot 11). Une suppression physique d'une ligne vivante est journalisée, mais pas celles de la purge ni de la suppression du foyer entier.
10. **`catalog_item` n'est pas journalisé** : c'est `catalog_learn` qui le tient à jour, et le journaliser doublerait chaque ajout. Les tables journalisées sont `checklist`, `checklist_item` et `shopping_category`. Les tables du socle ne le sont pas.
11. **`stamp_checked`** fonctionne aussi à l'insertion : un item créé déjà coché reçoit `checked_by` et `checked_at`. L'heure posée est celle du serveur.
12. **Contraintes ajoutées** :
    - longueurs : `shopping_category.name` de 1 à 60 caractères, `catalog_item.label` de 1 à 120 ;
    - `household.name` ne peut pas être vide ;
    - `settings` et `payload` doivent être des objets JSON ;
    - `usage_count` doit être positif ou nul ;
    - `activity_log.tool_key` et `entity_type` sont validés par une expression régulière (M2).

## Écarts avec `modele-donnees.html`

- `household` reçoit aussi `updated_by`, qui n'est pas listé dans le document. Il est nécessaire au `touch_row` commun.
- `checklist.trip_id`, son CHECK et son index unique sont **reportés à la migration Voyages** (lot 6), comme l'indique l'onglet IV.
- Sont hors périmètre : `push_subscription`, `notification_pref`, `attachment` (et `attachment_cascade`), ainsi que les tables Voyages, À regarder et Dépenses.
- La policy `for all` existe bien, mais sans GRANT DELETE (voir la décision 1).
- `membership (household_id, user_id)` est une contrainte unique pleine, pas un index partiel (voir la décision 4).

## Lancer les tests

```bash
scripts/db-test.sh          # bientôt : npm run test:db
KEEP_DB=1 scripts/db-test.sh  # garde le dossier du cluster pour l'inspecter
PG_BIN=/chemin/bin scripts/db-test.sh
```

Le script :

1. lance un Postgres 16 temporaire sur un socket Unix privé (aucun port TCP n'est ouvert). En root, il passe par `runuser -u postgres` ;
2. charge le stub, les trois migrations, puis le seed deux fois pour prouver qu'il est rejouable ;
3. exécute `helpers.sql`, puis chaque `*.test.sql`.

Il s'arrête au premier échec avec un code différent de 0. Chaque test affiche `ok - …`. `pg_cron` est absent en local nu : la migration 0300 l'annonce et passe son chemin.

Les tests sont écrits en PL/pgSQL (blocs `DO`), sans pgTAP. **`supabase test db` ne les reconnaît pas comme des tests pgTAP** : c'est ce script qui les lance.

## Démo manuelle

1. `supabase db reset` (CLI). Cette commande applique les migrations et `seed.sql`.
2. Ouvrez le Studio local, puis l'éditeur SQL, et lancez :
   ```sql
   set request.jwt.claims = '{"sub":"0192f000-0000-7000-8000-0000000000a2"}';
   set role authenticated;
   ```
   puis `select label, checked from checklist_item;`. Vous voyez les 7 items d'Auriane.
3. Lancez `insert into checklist_item (household_id, checklist_id, label, sort_order) values ('0192f000-0000-7000-8000-000000000001','0192f000-0000-7000-8000-0000000d0001','  lait ',20);`. Ensuite, `select label, usage_count from catalog_item where label_key='lait'` renvoie 2, et `activity_log` contient une nouvelle ligne `created` signée Auriane.
4. Remplacez le `sub` par un UUID inconnu et relancez les mêmes `select` : vous obtenez 0 ligne partout.
5. Connexion à l'app (lot 3) : `aurelien@example.com` / `oho-aurelien-dev` et `auriane@example.com` / `oho-auriane-dev`. **Changez ces mots de passe avant tout usage réel.**
