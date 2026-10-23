# Lot 8 : qualité et accessibilité mobile

> Entrée : lots 4 à 7, 10, 11 et 13, PLAN lot 8.
> Acceptation : rapport d'audit (ci-dessous) et tests de bout en bout verts en CI. Les 14 tests Playwright passent sur un Pixel 7 simulé contre un vrai Supabase local, avec migrations et seed. Ils couvrent la connexion, deux téléphones synchronisés en direct, le hors-ligne, et les quatre outils. Chaque écran est contrôlé en clair et en sombre.

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| Tests de bout en bout (`e2e/`) | **Playwright**, sur un téléphone Pixel 7 simulé. L'app est construite puis servie comme en production, service worker compris, contre `npx supabase start`. Les tests portent sur les parcours critiques :<br>- connexion, refus du mauvais mot de passe, session gardée au rechargement, déconnexion ;<br>- **Courses à deux téléphones** : Aurélien ajoute, l'article apparaît chez Auriane sans recharger, elle le coche et il passe dans le panier d'Aurélien ;<br>- **hors ligne** : l'ajout s'affiche, « 1 modification en attente », puis l'envoi au retour du réseau, vérifié sur l'autre compte ;<br>- Voyages : création datée, une idée qui survit au rechargement ;<br>- Dépenses : une dépense partagée qui change le solde, « Marquer comme remboursé » puis l'annulation ;<br>- À regarder : ajout sans fiche TMDB ;<br>- État du système : export JSON téléchargé et relu. |
| Contrôle de chaque écran | `expectUsable` lance **axe** (WCAG 2.1 A et AA) et mesure **chaque cible tactile** (44 × 44 px minimum). Il passe sur 11 écrans en clair et en sombre, sur les fiches ouvertes (article, nouveau voyage) et sur une liste vide. Une régression d'accessibilité fait donc échouer la CI. |
| CI | Nouveau job « Parcours sur téléphone (Playwright) ». Il démarre Supabase avec Docker, écrit `.env.local` depuis `supabase status`, puis lance `npx playwright test`. En cas d'échec, le rapport et les traces sont joints au run pendant 7 jours. |
| Tests d'écran (Vitest) | Délai des `findBy` porté à 4 s. Les échecs au hasard sous charge, signalés au lot 11, venaient de là : l'app complète se monte avec des routes chargées à la demande. |

## Rapport d'audit

Méthode :
- les 18 écrans ouverts à la main (script Playwright) sur Pixel 7, en clair et en sombre ;
- axe WCAG 2.1 AA ;
- mesure des cibles tactiles ;
- relecture des états de chargement, d'erreur et vides, et des claviers proposés.

### Corrigé dans ce lot

| Constat | Gravité | Correction |
|---|---|---|
| **La connexion par mot de passe ne marchait pas en local.** `[auth.email] enable_signup = false` coupe tout le fournisseur e-mail dans la CLI, connexion comprise (« Email logins are disabled »). | Bloquant (dév. et CI) | `enable_signup = true` sous `[auth.email]`. L'inscription reste fermée par `[auth] enable_signup = false` : vérifié, `/signup` répond « Signups not allowed ». |
| **Rouvrir un voyage, un carnet, une dépense ou un titre absent du cache de l'appareil renvoyait à la liste.** Exemple : recharger juste après avoir créé un voyage. L'écran concluait « introuvable » sur les données restaurées, avant de relire le serveur. | Majeur | `isSettled` (dans `core/sync`) : un écran ne conclut « introuvable » qu'après une relecture depuis son ouverture, ou hors ligne. `useLiveQuery` relit à chaque ouverture ; le cache reste affiché pendant ce temps. |
| **Étiquettes écrites en capitales dans le texte** (« MONTANT », « CHARGEMENT DES LISTES… », environ 60 endroits). Les lecteurs d'écran les épellent ou les crient. | Moyen | Le texte est écrit normalement, et les capitales viennent du CSS (`uppercase`). Le rendu ne change pas. |
| Écran de connexion sans titre de niveau 1. | Faible | Le logo OhO est le `h1`. |
| « OU » de l'écran de connexion à 3,6:1 en clair et 4,2:1 en sombre (`ink-4`). | Faible | `ink-3` (AA). |
| « Tout voir » de l'accueil : cible de 59 × 20 px. | Faible | Cible portée à 44 px de haut, sans changer le rendu. |
| Devise saisie au clavier sans majuscules automatiques. | Faible | `autoCapitalize="characters"`, sans correcteur. |

### Vérifié, rien à corriger

- **Contraste** : aucun autre écart AA, ni en clair ni en sombre. Les pastilles ok, warn et bad vont toujours par paire et portent un mot.
- **Cibles tactiles** : toutes les autres font au moins 44 px. Les cases de liste font 48 px. Le champ d'ajout rapide est porté par une étiquette de 48 px.
- **Clavier virtuel** :
  - `interactive-widget=resizes-content` garde la barre d'ajout au-dessus du clavier ;
  - les montants ouvrent le pavé décimal, les liens le clavier d'URL ;
  - l'ajout rapide affiche « OK » (`enterKeyHint="done"`) ;
  - le courriel n'a pas de majuscule automatique.
- **États** : chaque outil a un état de chargement (« Chargement… », annoncé par `role="status"`) et un état d'erreur avec « Réessayer ». Chaque liste a son état vide rédigé, par exemple « Rien à acheter », « Pas encore de voyage », « Aucune dépense pour l'instant », « Rien en « Abandonné » ».
- **Erreurs d'écriture** : le retour arrière et le message (« « Avocats » n'a pas été coché. Réessaie. ») étaient déjà couverts par les tests d'écran.

### Laissé de côté, et pourquoi

- La règle axe `label-content-name-mismatch` (WCAG 2.5.3) est **expérimentale**. Elle refuse « Modifier Lait » sur une ligne qui affiche aussi la quantité et l'auteur, et « Réglages » sur l'avatar AL. Le nom accessible contient le titre affiché, ce qui suffit à la commande vocale. La règle est désactivée dans `e2e/helpers.ts`, avec ce motif.
- **Lecteur d'écran réel** (TalkBack, VoiceOver) : non testé ici. Une passe de cinq minutes sur chaque téléphone reste utile, voir la démo.

## Décisions prises dans ce lot

- **Les E2E tournent contre un vrai Supabase local** (Docker, en CI aussi), pas contre un faux client. Ils exercent donc vraiment la RLS, le temps réel et l'authentification. La fonction TMDB n'est pas lancée : le parcours À regarder passe par l'ajout sans fiche.
- **Les tests ne remettent pas la base à zéro** : chaque passage écrit des noms uniques, et le remboursement est annulé à la fin. On peut les relancer sur un Supabase local déjà utilisé.
- `playwright-core` est épinglé en 1.56.1 (`overrides`), pour qu'axe et Playwright partagent le même navigateur.

## Lancer les tests en local

1. `npx supabase start` (Docker), puis copier l'URL et la clé anon dans `.env.local`.
2. `npx playwright install chromium` (une fois).
3. `npm run test:e2e`. Le rapport s'ouvre avec `npx playwright show-report`.

## Démo manuelle (deux téléphones)

1. Ouvrir les Courses sur les deux téléphones. Aurélien ajoute « kiwis » : l'article apparaît chez Auriane sans rien toucher.
2. Passer un téléphone en mode avion et ajouter un article : « Hors ligne · 1 modification en attente ». Couper le mode avion : l'article part et apparaît sur l'autre téléphone.
3. Créer un voyage, puis fermer et rouvrir l'app tout de suite : le voyage s'ouvre, sans retour à la liste.
4. TalkBack ou VoiceOver activé, parcourir Réglages et une dépense : les étiquettes sont lues normalement (« Montant », plus « M-O-N-T-A-N-T »).
