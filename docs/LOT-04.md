# Lot 4 : outil Courses

> Entrée : lot 3, `docs/cadrage/PLAN.md` §1.2, `docs/cadrage/maquettes-app.html` (écrans 03 à 07), `docs/DECISIONS.md` (M6, M7, D3).
> Acceptation : scénario « courses du samedi » à deux sur deux téléphones. **À faire en vrai** avec Supabase (voir la démo plus bas). Le parcours complet est couvert par les tests d'écran sur un faux client. Sans le lot 5, l'autre téléphone ne voit les changements qu'au rechargement ou au retour sur l'app.

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| `supabase/migrations/20261023000600_clear_checked.sql` | RPC `clear_checked(liste)` : range d'un coup les items cochés (pierres tombales) et écrit **une** ligne `cleared` au journal au lieu d'un `deleted` par item. `log_activity` se tait quand `oho.bulk = on` (réglé par la RPC seulement). |
| `src/tools/shopping/parse.ts` | Ajout rapide : « lait, œufs, pain » (virgule, point-virgule ou retour), quantité devant ou derrière (« 3 avocats », « bananes x6 »), unités laissées dans le libellé (« 2 L de lait »), doublons écartés. |
| `src/tools/shopping/model.ts` | Regroupement par rayon dans l'ordre du magasin (« Sans rayon » à la fin), panier (dernier coché en premier), compteurs par liste, suggestions du catalogue (début de mot d'abord, puis fréquence), achats fréquents, ordre « entre deux voisins » pour réordonner. |
| `src/tools/shopping/ShoppingProvider.tsx` | Données (listes, items, rayons, catalogue) et toutes les écritures. Chaque écriture est **optimiste** : le cache change tout de suite, l'état d'avant revient si Supabase refuse, et un message en paire `bad` s'affiche. Les identifiants sont des UUID v7 générés côté client. |
| `src/tools/shopping/ListScreen.tsx` + `components/` | La liste (pastilles de listes avec compteur, rayons en étiquettes mono, cases de 48 px, quantité, initiales de qui a ajouté), le panier repliable et « Vider les cochés », l'ajout rapide collé en bas avec les suggestions du catalogue, la fiche article (nom, quantité, rayon, note, supprimer), l'état vide avec les achats fréquents, les options de liste (renommer, ordre des rayons, activité, supprimer). |
| `src/tools/shopping/CategoriesScreen.tsx` | Ordre des rayons, commun à l'espace (M6) : monter / descendre, renommer, supprimer, ajouter. |
| `src/core/ui/Sheet.tsx` | Feuille du bas réutilisable : Retour d'Android, Échap et toucher sur le voile la ferment ; le focus revient au déclencheur. Jeton `--scrim` pour le voile. |
| `src/core/lib/uuid.ts` | `uuidv7()` côté client. |
| Journal | « Auriane a vidé le panier d'Épicerie » ; écran Activité filtrable par outil (`/activite?outil=shopping`), ouvert depuis les options de la liste. |
| `src/test/fakeClient.ts` | Le faux client devient une petite base en mémoire (filtres, tri, insert, update, `clear_checked`, échec simulé). |

## Décisions prises dans ce lot

- **Vider les cochés** = pierres tombales via une RPC, avec une seule ligne de journal. Sinon, vider un panier de 20 articles inondait l'activité.
- **Ajouter un article déjà présent** : s'il est à acheter, rien ne change (« déjà dans la liste ») ; s'il est dans le panier, il en ressort au lieu d'être doublé.
- **Le rayon choisi sur un article devient celui du catalogue** : la prochaine fois, l'article arrivera directement dans ce rayon.
- **Réordonner les rayons** avec des boutons monter / descendre (accessibles au lecteur d'écran et au pouce) plutôt qu'un glisser-déposer. Le glisser de la maquette 05 pourra s'ajouter par-dessus au lot 8 (qualité mobile).
- **La liste par défaut ne se supprime pas.** Les autres se suppriment après confirmation, avec leurs articles.
- **Dernière liste ouverte mémorisée** sur l'appareil (`oho.courses.liste`).
- Le hors-ligne (bandeau, « En attente », outbox) et le temps réel viennent au lot 5.

## Tests

- `src/tools/shopping/shopping.test.tsx` (13 tests d'écran) : rayons et listes, cocher → panier → vider, décocher, retour arrière sur échec, ajout multiple avec rayon appris, ressortir du panier, suggestions, fiche article, suppression, création et suppression de liste, ordre des rayons.
- `parse.test.ts`, `model.test.ts`, `uuid.test.ts`, `src/core/household/activity.test.tsx`.
- Base : `supabase/tests/shopping.test.sql` (`clear_checked` : compte, pierres tombales, une seule ligne de journal, refus pour un non-membre et l'anonyme).

## Démo manuelle

1. `npx supabase db reset`, `npm run dev`, se connecter en Aurélien sur un téléphone et en Auriane sur un autre (ou deux navigateurs).
2. Aurélien tape « 3 avocats, lait, fr » puis choisit « Fraises » dans les suggestions : Avocats ×3 arrive dans Fruits et légumes, Lait est signalé déjà présent.
3. Auriane recharge, coche Lait et Œufs : ils descendent dans « Dans le panier ».
4. Auriane touche « Vider les cochés » : l'accueil d'Aurélien affiche « Auriane a vidé le panier d'Épicerie ».
5. Options ⋯ → Ordre des rayons : monter Produits laitiers, revenir à la liste, l'ordre a suivi.
