# DECISIONS — OhO

> Sortie du **lot 0 (cadrage)** du plan `plan-app-couple_1.md`.
> Toutes les propositions par défaut ont été retenues par Aurélien le 22 octobre 2026.
> Références : `modele-donnees.html` (modèle de données, onglet IX) et `maquettes-app.html` (section « Décisions de design »).
> Critère d'acceptation du lot 0 : aucune question ❓ non tranchée. **Atteint.**

## 1. Produit (plan §5.1)

| # | Question | Décision |
|---|---|---|
| P1 | Nom et identité visuelle | **OhO**. Mot-symbole en serif, second O en bleu océan ; icône maskable « O » blanc sur fond marine. Style : design system mhosaic, thème Océan (sans le logo mhosaic). |
| P2 | Ordre de livraison des outils | v1 = socle + Courses. v1.1 = Voyages. v1.2 = À regarder. v1.3 = Dépenses (façon Tricount). |
| P3 | Budget voyage en v1 | Non. `trip_budget_line` arrive en v1.1, et le « dépensé » est calculé depuis le carnet de dépenses lié. |
| P4 | Enrichissement TMDB | Oui, dès la sortie de l'outil À regarder. La clé reste côté serveur (Edge Function) et le cache `external_media` est global. |
| P5 | Notifications push | v1.1, après validation de l'usage réel. |
| P6 | Un ou plusieurs espaces | Un seul espace en v1, mais le modèle en permet plusieurs. |

## 2. Technique (plan §5.2)

| # | Question | Décision |
|---|---|---|
| T7 | Hébergement des données | Supabase managé (Auth, Postgres + RLS, Realtime, Storage, Edge Functions). Palier gratuit, avec un ping planifié (GitHub Actions, tous les 3 jours) pour éviter la mise en pause après 7 jours d'inactivité ; à mettre en place au lot 1 (ajouté le 22 octobre 2026). |
| T8 | Framework front | React + Vite + TypeScript, Tailwind + shadcn/ui, PWA. |
| T9 | Temps réel | Supabase Realtime, avec un repli en polling et un refetch au retour au premier plan. |
| T10 | Hors-ligne | Lecture en cache et outbox simple pour les cases à cocher. Une dépense passe par une seule entrée d'outbox (voir M19). |
| T11 | Distribution Android | PWA d'abord, APK via PWABuilder si l'on veut l'icône « vraie app ». |
| T12 | Domaine et hébergement du front | Sous-domaine perso + Vercel ou Netlify. |

## 3. Données et sécurité (plan §5.3)

| # | Question | Décision |
|---|---|---|
| S13 | Création des comptes | Seed manuel, sans inscription ouverte. |
| S14 | Méthode de connexion | Mot de passe, avec un lien magique par courriel en option. |
| S15 | Durée de session | 60 jours glissants. |
| S16 | Sauvegardes | Export JSON hebdomadaire automatique vers un stockage à soi. |
| S17 | Supprimer ce que l'autre a ajouté | Oui, tout est commun, et chaque action est journalisée dans `activity_log`. |

## 4. Modèle de données (onglet IX de `modele-donnees.html`)

| # | Question | Décision | Lot |
|---|---|---|---|
| M1 | Suppression | Pierres tombales (`deleted_at`) sur toutes les tables synchronisées, purgées par `pg_cron` après 30 jours. | 2 |
| M2 | Types | Enum Postgres pour les listes fermées ; `text` + `CHECK` pour `tool_key`, `entity_type` et `action`. | 2 |
| M3 | UUID v7 | Généré côté client pour l'outbox. Défaut serveur : `uuidv7()` si Postgres 18, sinon une fonction SQL. | 2 |
| M4 | Dernier écrit gagne | Selon l'heure du serveur (`updated_at` posé par trigger), champ par champ. | 5 |
| M5 | Colonnes « qui » | Elles pointent vers `profile`, pas vers `auth.users`. | 2 |
| M6 | Ordre des rayons | Commun au foyer. Une table de surcharge par liste viendra si Costco l'exige. | 4 |
| M7 | Catalogue et accents | Pas d'insensibilité aux accents en v1 (`lower` + `btrim`). On passera à `unaccent` si des doublons apparaissent. | 4 |
| M8 | Checklists de préparation | Une par voyage. | 6 |
| M9 | Pièces jointes | Table `attachment` polymorphe, avec un trigger de nettoyage. | 6 |
| M10 | Statut du voyage | Stocké ; l'interface fait des suggestions d'après les dates. | 6 |
| M11 | Budget « dépensé » | Calculé par `trip_budget_view` depuis le carnet lié. | v1.1 |
| M12 | Progression des séries | Partagée, sur `watch_item`. | 7 |
| M13 | Conservation du journal | 12 mois, purge mensuelle. | 11 |
| M14 | Participants sans compte | Non en v1.3 : les participants sont les membres du foyer. | 13 |
| M15 | Taux de change | Proposé par une Edge Function (taux du jour), modifiable, puis figé dans `fx_rate`. | 13 |
| M16 | Centime d'arrondi | Attribué par la méthode du plus fort reste. Il n'est jamais recalculé après la saisie. | 13 |
| M17 | Montants négatifs | Interdits. Un remboursement d'un commerçant se saisit comme une dépense payée par celui qui reçoit l'argent. | 13 |
| M18 | Carnets par voyage | Au plus un ; les carnets hors voyage sont libres. | 13 |
| M19 | Modifier une dépense | D'un bloc, par la RPC `save_expense`, en une transaction. | 13 |
| M20 | Carnet automatique par voyage | Non : la fiche voyage propose d'en ouvrir un. | 13 |
| M21 | Remboursement | Un simple marquage « Remboursé » ; le virement (Interac, comptant) se fait hors de l'app. | 13 |
| M22 | Modifier la dépense de l'autre | Oui, avec une trace dans `activity_log`. | 13 |

## 5. Design (section « Décisions de design » de `maquettes-app.html`)

| # | Question | Décision |
|---|---|---|
| D1 | Navigation | Barre du bas : Accueil + quatre outils (Courses, Voyages, À regarder, Dépenses). Activité est sur l'accueil, Réglages derrière l'avatar. À partir d'un cinquième outil, les quatre plus utilisés restent en onglets (ordre réglable) et les suivants passent dans la grille de l'accueil. |
| D2 | Couleur par personne | Océan pour Aurélien, sable pour Auriane : en contour d'avatar et dans les graphiques, toujours avec les initiales (AL, AN) ou le prénom. |
| D3 | Densité | Lignes de 52 px. Un réglage « compact » à 44 px pour Courses seulement, si l'usage le demande. |
| D4 | Devise des dépenses | Soldes en $ CA. Taux du jour figé à la saisie, modifiable sur la dépense. |
| D5 | Partage par défaut | Égal ; « Montants » et « Parts » au cas par cas. Une répartition par défaut réglable par carnet viendra plus tard. |
| D6 | Serif dans l'app | Seulement pour les titres d'écran et de fiche ; tout ce qui se touche reste en sans. |

## 6. Ajouts après la v1

| # | Question | Décision |
|---|---|---|
| A1 | Agenda Google commun (lot 15, 26 octobre 2026) | Lecture seule par l'adresse secrète iCal, gardée côté serveur (Edge Function `agenda`, secret `AGENDA_ICAL_URL`). On saisit dans Google Agenda ; OAuth écarté (reconnexion tous les 7 jours tant que l'app n'est pas vérifiée par Google). Pas de table d'événements : lecture à la demande, cache serveur d'une minute, relecture toutes les 2 minutes à l'écran. Un seul agenda commun. Vue liste et vue mois, carte « Cette semaine » sur l'accueil. Agenda prend l'onglet de Voyages (D1) ; Voyages passe dans la grille de l'accueil. Voyages et agenda restent séparés. |

## Prochaine étape

Lot 1 (squelette du dépôt et socle technique), puis lot 2 (migrations du socle d'après `modele-donnees.html`). Il faut d'abord un dépôt GitHub pour OhO, connecté à ce projet.
