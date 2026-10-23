# Lot 7 : outil À regarder

> Entrée : lot 5, PLAN §1.4, `docs/DECISIONS.md` (P4, M12), maquettes 10 à 13.
> Acceptation : ajouter une série depuis TMDB, l'autre compte la note, filtre et tirage fonctionnent. **Couvert par les tests** sur un faux client, avec la fonction serveur simulée. **À confirmer en vrai** une fois la clé TMDB posée et la fonction déployée (voir plus bas).

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| Migration `20261023000800_a_regarder.sql` | Ajoute `external_media` (cache TMDB global, sans foyer), `watch_platform`, `watch_item` et `watch_rating`, plus les énumérations `watch_kind` et `watch_status`. Un même titre TMDB ne peut pas être ajouté deux fois par foyer. Un film n'a ni saison ni épisode. `watched_at` est posé au passage en « Vu » et effacé si on en ressort. |
| Accès | Le cache est **lisible par tout compte connecté** et écrit seulement par le service (exception à la règle `household_id`, documentée dans la migration). Une note se lit à deux, mais **chacun n'écrit que la sienne** (policy sur `user_id = auth.uid()`). |
| `supabase/functions/tmdb/` | Edge Function qui détient seule la clé (`TMDB_API_KEY`). Elle exige un compte connecté. `search` interroge `/search/multi` (films et séries, en fr-CA). `import` lit les détails et les plateformes au Canada, puis écrit le cache, rafraîchi après 30 jours. La mise en forme est dans `map.ts`, testée par Vitest. |
| `src/tools/watchlist/` | **Liste** : statuts, grille d'affiches de deux colonnes, qui a proposé chaque titre. **Filtre « Ce soir »** : durée max réglable pour l'espace (`tool_activation.settings`), plateformes où l'on est abonnés. **Tirage au sort** : une réponse, deux relances, et « On regarde ça » passe le titre en cours. **Fiche** : synopsis TMDB, statut, saison et épisode avec des boutons de 44 px, « Épisode suivant », nos deux notes face à face (étoiles et chiffre), un mot chacun, la plateforme. |
| Ajout | Recherche TMDB pendant la frappe. Un titre déjà dans la liste porte la mention « Dans la liste ». Si TMDB n'est pas branché ou ne répond pas, l'écran le dit et propose « Ajoutez « … » sans fiche » (film ou série). |
| Socle | `AddBar` monte dans `src/core/ui/` (partagé par Voyages et À regarder). Le faux client simule maintenant `functions.invoke`. |

## Décisions prises dans ce lot

- **Le filtre « ce soir » se calcule sur l'appareil**, à partir des données en cache, plutôt que dans la vue `watch_item_view` du modèle. Le résultat est le même, il marche hors ligne, et le tirage se fait de toute façon côté client.
- Le filtre retient les titres **à voir et en cours**. Un titre **sans durée ou sans plateforme connue reste dans la liste** : on ne l'écarte que si l'on sait qu'il ne tient pas dans la soirée.
- **Durée max par défaut : 2 h.** Les choix sont 1 h 30, 2 h, 2 h 30 et 3 h, partagés par l'espace.
- Commencer une série la place en saison 1, épisode 1. Changer de saison remet l'épisode à 1.
- Retirer une plateforme détache tout de suite ses titres. La clé étrangère ne joue qu'à la purge.
- Les affiches viennent de `image.tmdb.org`, en taille w342 dans la grille.

## Pour brancher TMDB (à faire une fois)

1. Créer une clé sur themoviedb.org (Paramètres → API). Le « jeton d'accès en lecture » v4 ou la clé v3 conviennent tous les deux.
2. `npx supabase secrets set TMDB_API_KEY=…` puis `npx supabase functions deploy tmdb`.
3. Sans clé, l'app reste utilisable : les titres s'ajoutent sans fiche.

## Tests

- `src/tools/watchlist/model.test.ts` : filtre « ce soir », tirage sans répétition, ordre, durées.
- `src/tools/watchlist/watchlist.test.tsx` : liste et compteurs, « ce soir » et durée réglée pour l'espace, tirage et relances, ajout par TMDB (recherche puis import), ajout sans fiche quand TMDB n'est pas branché, notes personnelles et mot, progression de série, passage en « Vu » et retrait, plateformes.
- `supabase/functions/tmdb/map.test.ts` : recherche, détails et plateformes au Canada, péremption du cache, clé v3 ou jeton v4.
- `supabase/tests/watchlist.test.sql` : contraintes, `watched_at`, journal, une note par personne et pour soi, cache en lecture seule, isolation entre espaces.

## Démo manuelle (deux téléphones)

1. Aurélien : À regarder → « + Titre », taper « severance », puis « Ajouter » ; la fiche s'ouvre avec affiche et synopsis.
2. Statut « En cours », puis « Épisode suivant » deux fois. Auriane voit S1 · É3 sur sa grille.
3. Auriane met 4 étoiles et un mot ; Aurélien voit les deux notes face à face.
4. « Ce soir » avec ≤ 2 h, puis « Tirer au sort », « Relancer » et « On regarde ça ».
