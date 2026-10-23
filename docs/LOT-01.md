# Lot 1 — Squelette du dépôt et socle technique

## Ce qui est fait
- Front React 19 + Vite 8 + TypeScript, Tailwind CSS 4 branché sur les jetons Océan (`src/core/theme/tokens.css`), clair et sombre.
- shadcn/ui prêt à l'emploi (`components.json`, alias `@/`, utilitaire `cn`) ; aucun composant posé pour l'instant.
- PWA : manifest (nom, couleurs, icônes 192/512 et maskable), service worker qui met la coquille en cache (`vite-plugin-pwa`, mise à jour automatique), viewport `interactive-widget=resizes-content` pour le clavier Android.
- Structure `src/core/` et `src/tools/registry.ts` (vide, avec la fonction qui croise le registre et `tool_activation`).
- Client Supabase (`src/core/supabase.ts`) qui lit `.env.local` ; l'app démarre aussi sans configuration et l'affiche.
- Supabase local initialisé (`supabase/config.toml`) : inscription fermée (décision S13), mots de passe de 10 caractères au moins.
- Qualité : oxlint, TypeScript strict, Vitest + Testing Library, CI GitHub Actions (lint, typecheck, tests, build).
- `CLAUDE.md` décrit les conventions pour les lots suivants.

## Décisions prises en cours de lot
- **oxlint** plutôt qu'ESLint : c'est ce que propose le gabarit Vite actuel, et il est bien plus rapide.
- **Durée de session (S15)** : Supabase garde la session tant que le jeton de rafraîchissement sert, sans limite. Selon la doc Supabase, limiter la durée (« 60 jours glissants ») passe par les réglages de session de l'offre Pro ; en offre gratuite la session reste ouverte sans limite, avec la déconnexion depuis l'app (lot 3). À revoir si la limite compte vraiment pour toi.
- **Déploiement en préversion** : il dépend de ton compte Vercel ou Netlify. Il suffit d'importer le dépôt : la commande de build est `npm run build`, le dossier `dist`, et il faut ajouter les deux variables `VITE_SUPABASE_…`.

## Démo manuelle
1. `npm install`, puis `npm run dev` et ouvrir http://localhost:5173 : l'écran « OhO, socle · lot 1 » s'affiche, avec Supabase « à configurer ».
2. Copier `.env.example` vers `.env.local` avec l'URL et la clé anon : l'état passe à « Configuré ».
3. `npm run build && npm run preview`, puis sur Android (Chrome, même réseau ou déploiement HTTPS) : menu → « Installer l'application ». L'icône OhO apparaît et l'app s'ouvre en plein écran, « Mode : Application installée ».

## Complément : ping anti-pause Supabase
- En palier gratuit, Supabase met en pause un projet inactif depuis 7 jours. Le workflow `.github/workflows/keepalive.yml` appelle la RPC `public.ping()` tous les 3 jours (et à la demande depuis l'onglet Actions).
- `public.ping()` (migration `20261023000400_keepalive.sql`) ne lit aucune donnée ; elle est appelable avec la clé anon.
- À faire une fois le projet Supabase créé : ajouter les secrets `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans Settings → Secrets and variables → Actions. Sans eux, le workflow passe sans rien faire.
- GitHub désactive les workflows planifiés d'un dépôt sans activité depuis 60 jours ; un courriel prévient avant, et un clic sur « Enable workflow » le relance.
