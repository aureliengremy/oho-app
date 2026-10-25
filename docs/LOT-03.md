# Lot 3 : authentification, espace et coquille d'app

> Entrée : lots 1 et 2, `docs/cadrage/maquettes-app.html` (connexion, accueil, réglages), `docs/DECISIONS.md` (S13–S15, D1, D2, D6).
> Acceptation : connexion → accueil → fermeture de l'app → réouverture sans reconnexion. **Atteint** (test « garde la session au rechargement » et vérification manuelle avec Playwright).

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| `src/core/client.tsx` | `ClientProvider` / `useClient` : le client Supabase est injecté, ce qui permet aux tests de passer un faux client. |
| `src/core/auth/` | `AuthProvider` (états `loading`, `signedOut`, `signedIn` ; mot de passe ; lien magique sans création de compte ; déconnexion ; messages d'erreur en français), `RequireAuth` (redirige vers `/connexion` et revient à la page demandée), `LoginScreen`. |
| `src/core/household/` | Chargement de l'espace avec react-query : première adhésion, foyer, membres (ordre d'arrivée → personne A océan, B sable), outils activés. Écrans d'attente, d'erreur et « aucun espace » avec Réessayer et Se déconnecter. `ActivityFeed` pour le journal. |
| `src/core/layout/` | `AppShell` (contenu + barre du bas), `TabBar` (Accueil + outils activés, au plus quatre, zone sûre iOS), `ScreenHeader`, `LoadingScreen`, `ToolPlaceholder`. |
| `src/core/theme/ThemeProvider.tsx` | Thème Système / Clair / Sombre, mémorisé dans `localStorage` (`oho.theme`) et appliqué par `data-theme`. |
| `src/core/hooks/useBackDismiss.ts` | Bouton retour Android : une feuille ou un panneau ouvert ajoute une entrée d'historique ; « retour » le ferme au lieu de quitter l'écran. |
| `src/core/ui/` | `Button` (primaire, secondaire, discret), `Field`, `Brand` (mot-symbole OhO), `Avatar` (initiales + contour de la personne). |
| `src/core/lib/time.ts` | `relativeTime` (« à l'instant », « il y a 2 min », « hier »…) et `greeting` (Bonjour / Bonsoir). |
| `src/tools/registry.ts` + `src/tools/*/index.tsx` | Le registre porte maintenant l'icône, le chemin et un `load` paresseux. Chaque outil a un écran d'attente qui annonce son lot. |
| `src/app/` | `routes.tsx` (`/connexion`, puis sous garde : `/`, `/activite`, `/reglages`, une route par outil), `App.tsx`, écrans Accueil, Activité, Réglages. |
| `supabase/migrations/20261023000500_profile_initials.sql` | Colonne `profile.initials` (1 à 3 lettres ou chiffres, en majuscules). Le seed pose AL et AN. |

## Décisions prises dans ce lot

- **Initiales stockées** : Aurélien et Auriane commencent par « A » et par « Au », donc les deux premières lettres ne suffisent pas. `profile.initials` porte AL et AN. Sans valeur, l'interface prend les deux premières lettres du prénom.
- **Activité sur l'accueil** (D1) : les cinq dernières actions sur l'accueil, la liste complète sur `/activite` via « Tout voir ». Réglages s'ouvrent depuis l'avatar.
- **Outils non livrés** : leur onglet existe déjà s'ils sont activés et montre un écran « arrive au lot n ». Au seed, seul Courses est activé.
- **Session** : supabase-js garde la session dans `localStorage` et rafraîchit le jeton seul. Les 60 jours glissants de S15 se règlent par `[auth.sessions] inactivity_timeout = "1440h"`, mais Supabase réserve ce réglage aux offres payantes. Sur le palier gratuit, la session ne tombe donc pas d'elle-même : seule la déconnexion la ferme.
- **Inscription** : l'écran de connexion n'offre pas de création de compte, et le lien magique utilise `shouldCreateUser: false` (S13).

## Tests

- `src/app/app.test.tsx` : redirection vers la connexion, mauvais mot de passe, connexion → accueil, session gardée au rechargement, lien magique, accueil (onglets, activité, AN), tuile → Courses, réglages (thème, déconnexion).
- `src/core/ui/avatar.test.ts`, `src/core/hooks/useBackDismiss.test.tsx`, `src/core/lib/time.test.ts`, `src/tools/registry.test.ts`.
- Base : `profile.initials` (seed AL/AN, majuscules imposées) dans `triggers.test.sql`.

## Démo manuelle

1. `npx supabase start`, `npx supabase db reset`, copier l'URL et la clé anon dans `.env.local`, puis `npm run dev`.
2. Ouvrir http://localhost:5173 : on arrive sur la connexion. Se connecter avec `aurelien@example.com` / `oho-aurelien-dev`.
3. L'accueil dit « Bonjour Aurélien » (ou « Bonsoir ») et montre la tuile Courses et l'onglet Courses.
4. Fermer l'onglet puis le rouvrir : l'accueil revient sans reconnexion.
5. Avatar → Réglages : passer en Sombre, voir Auriane (AN, sable), puis Se déconnecter.

## Ajout : changer de mot de passe (2026-10-25)

- **Réglages → Mot de passe** : « Recevoir le lien par courriel » appelle `resetPasswordForEmail` pour le courriel du compte connecté, avec `redirectTo` = `<origine>/mot-de-passe`.
- **Le lien connecte**, puis l'écran `/mot-de-passe` (`src/core/auth/PasswordScreen.tsx`) demande le nouveau mot de passe deux fois (10 caractères au moins, comme `minimum_password_length`) et l'enregistre avec `updateUser`. Le lien marche aussi ouvert dans un autre navigateur que celui de la demande (flux implicite de supabase-js).
- **Filet** : si Supabase refuse l'adresse de retour et renvoie à l'accueil, l'événement `PASSWORD_RECOVERY` suffit : `RequireAuth` mène quand même à `/mot-de-passe`.
- **Réglage Supabase** : l'adresse de retour doit figurer dans Auth → URL Configuration → Redirect URLs. En local, `supabase/config.toml` autorise `http://localhost:5173/**` et `http://localhost:4173/**` ; en production, ajouter `https://oho-app.vercel.app/**`.
- Tests : `src/app/screens/password.test.tsx` et `e2e/mot-de-passe.spec.ts` (lit le courriel dans Mailpit, ouvre le lien dans un second navigateur, change le mot de passe, vérifie la connexion, remet celui du seed). La CI garde donc Mailpit au démarrage de Supabase.

Démo : se connecter, Réglages → « Recevoir le lien par courriel », ouvrir le courriel (en local : http://127.0.0.1:54324), toucher le lien, choisir un nouveau mot de passe, se déconnecter puis se reconnecter avec.
