# OhO — conventions

PWA mobile d'abord pour deux personnes (Aurélien et Auriane) qui partagent des outils dans un espace commun. Toute la doc et l'interface sont en français ; les identifiants de code et de base sont en anglais.

## Avant de coder
- Les décisions sont dans `docs/DECISIONS.md` : elles sont tranchées, ne les rouvre pas sans le dire.
- Le modèle de données de référence est `docs/cadrage/modele-donnees.html`, les écrans cibles `docs/cadrage/maquettes-app.html`, le découpage en lots `docs/cadrage/PLAN.md` §6.
- Chaque lot livre une branche `lot-xx-…`, une PR, des tests qui passent et une note `docs/LOT-xx.md` (ce qui a été fait, décisions prises, démo manuelle en 3 à 5 lignes).

## Commandes
- `npm run dev` : serveur de dev (http://localhost:5173).
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` : la CI lance les quatre.
- `npm run test:db` : migrations, seed et tests d'accès (RLS) sur un Postgres 16 jetable, sans Docker.
- `npx supabase start` : Supabase local (Docker requis), puis copier l'URL et la clé anon dans `.env.local` (voir `.env.example`).
- `npm run test:e2e` : parcours Playwright sur téléphone simulé, contre ce Supabase local (voir `docs/LOT-08.md`). La CI les lance aussi.
- `npm run screenshots` : regénère les captures du manifeste (`public/screenshots/`), sur une base fraîche (`npx supabase db reset`).

## Architecture
- `src/core/` : le socle partagé (client Supabase, env, thème, utilitaires, plus tard auth, espace, sync, layout).
- `src/tools/<clé>/` : un dossier par outil (`shopping`, `trips`, `watchlist`, `expenses`), avec ses écrans, hooks et requêtes.
- `src/tools/registry.ts` : le registre. Ajouter un outil = ses migrations + un dossier + une entrée dans le registre, rien d'autre. Un outil n'importe jamais un autre outil ; ce qui est partagé monte dans `core/`.
- `supabase/migrations/` : migrations SQL horodatées. Une seule personne ou un seul agent touche aux migrations à la fois.

## Base de données
- Chaque table porte `household_id` et la RLS filtre par appartenance à l'espace. Pas d'exception sans la documenter.
- Les identifiants sont des UUID v7, générés côté client pour l'outbox hors ligne.
- Suppression douce (`deleted_at`) sur les tables synchronisées ; jamais de `delete` physique côté client.
- Les secrets (clé TMDB, clé service) restent côté serveur : jamais de variable `VITE_` pour eux.

## Interface
- Design system mhosaic, thème Océan : les jetons sont dans `src/core/theme/tokens.css` et exposés à Tailwind (`bg-surface`, `text-ink-2`, `text-accent-ink`…). Pas de couleur en dur.
- Un seul accent (bleu océan) pour ce qui se touche ; `ok`/`warn`/`bad` vont par paire fond + texte, toujours avec un mot.
- Serif (`font-display`) pour les titres d'écran, sans pour l'interface, mono capitales pour les étiquettes.
- Cibles tactiles d'au moins 44 px ; tout fonctionne en clair et en sombre.
- Composants shadcn/ui : `npx shadcn add <composant>` les pose dans `src/core/ui/`, puis on les recolore avec les jetons.
