# Lot 15 : outil Agenda (agenda Google commun)

> Entrée : demande d'Aurélien du 26 octobre 2026, décision A1 de `docs/DECISIONS.md`.
> Acceptation : l'agenda Google commun s'affiche en liste et en mois, se met à jour sans relancer l'app, et l'adresse secrète ne quitte jamais le serveur. **Couvert par les tests** sur un faux client, avec la fonction serveur simulée, et par les tests de la lecture iCal. **À confirmer en local** avec la vraie adresse de l'agenda (voir plus bas).
> **Rien n'est en production** : ni la migration, ni la fonction, ni le secret. La branche est faite pour un test en local.

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| `supabase/functions/agenda/` | Edge Function, seule à connaître l'adresse secrète iCal (`AGENDA_ICAL_URL`). Elle exige un compte connecté **et membre d'un espace**, lit le flux (gardé une minute en mémoire, `fresh` force la relecture) et renvoie les événements d'une période en JSON. Elle n'accepte qu'une adresse `https://calendar.google.com/calendar/ical/…` et ne la journalise jamais. |
| `expand.ts` | Lecture du flux avec `ical.js` : récurrences déroulées, occurrences déplacées ou supprimées (RECURRENCE-ID, EXDATE), événements annulés écartés, journées entières, fuseaux convertis par `Intl` (changements d'heure compris), HTML de la description nettoyé. Une récurrence ancienne s'arrête à la fin de la période demandée. |
| `src/tools/agenda/` | **Liste** des 60 prochains jours, groupée par jour (« Aujourd'hui », « Demain », « Vendredi 30 octobre »), journées entières d'abord. **Mois** : grille du lundi au dimanche, points sous les jours chargés, les événements du jour choisi en dessous, mois précédent et suivant. **Fiche** d'un événement en lecture : quand, lieu (ouvre Google Maps), description. |
| Mise à jour | Relecture à l'ouverture de l'écran, au retour de l'app au premier plan, au retour du réseau et toutes les 2 minutes tant que l'écran est ouvert. Le bouton « Actualiser » et le geste « tirer vers le bas » demandent au serveur de relire le flux tout de suite. Hors ligne, le dernier état reste affiché (cache de l'appareil). |
| Accueil | Carte « Cette semaine » : les sept prochains jours, six événements au plus, « Voir l'agenda (+n) ». Elle ne s'affiche pas si l'agenda n'est pas relié. |
| Barre du bas | Migration `20261026000200_agenda.sql` : active Agenda (ordre 2) pour chaque espace et passe Voyages en 5. La barre devient Accueil, Courses, Agenda, À regarder, Dépenses ; Voyages reste dans la grille de l'accueil (D1). Le seed suit. |
| PWA | Raccourci « Agenda » sur l'icône (appui long). |

## Décisions prises dans ce lot

- **Pas de table d'événements** : rien à synchroniser ni à purger, et l'agenda ne passe pas par la base. Le fichier iCal complet ne descend jamais sur le téléphone, seulement la période affichée.
- La semaine commence le **lundi**.
- Les jours se comptent dans le **fuseau de l'espace** (Toronto), pas celui du téléphone, comme Voyages.
- Une heure « flottante » (sans fuseau) prend le fuseau annoncé par l'agenda (`X-WR-TIMEZONE`), sinon celui de l'espace.
- Le délai entre une modification dans Google Agenda et son arrivée dans OhO dépend surtout de Google, qui met à jour le flux iCal de son côté. Il n'a pas été mesuré.

## Tester en local

1. Dans Google Agenda (sur ordinateur) : Paramètres de l'agenda commun › « Intégrer l'agenda » › **Adresse secrète au format iCal**. La copier (elle donne accès à tout l'agenda : ne pas la partager).
2. Créer `supabase/functions/.env` (ignoré par git) avec `AGENDA_ICAL_URL=https://calendar.google.com/calendar/ical/…/basic.ics`.
3. `npx supabase start`, puis `npx supabase db reset` (applique la migration et le seed), puis `npx supabase functions serve --env-file supabase/functions/.env`.
4. `npm run dev` avec `.env.local` sur le Supabase local, puis se connecter.

## Démo manuelle

1. La barre du bas montre Agenda à la place de Voyages ; Voyages est dans la grille de l'accueil.
2. L'accueil montre « Cette semaine » avec les événements de l'agenda commun.
3. Ajouter un événement dans Google Agenda sur le téléphone, revenir dans OhO et tirer vers le bas : il apparaît après la mise à jour du flux par Google.
4. Agenda › Mois : changer de mois, toucher un jour, ouvrir un événement et son lieu.

## Pour la production (plus tard, sur accord d'Aurélien)

1. `npx supabase secrets set AGENDA_ICAL_URL=…` puis `npx supabase functions deploy agenda`.
2. `npx supabase db push` pour la migration (active Agenda et déplace Voyages).
3. Fusionner la PR : Vercel publie le front.

## Tests

- `supabase/functions/agenda/expand.test.ts` : événement simple, journée entière, heure UTC, récurrence hebdomadaire avec occurrence déplacée et supprimée à travers le changement d'heure, événements annulés et hors période, récurrence quotidienne ancienne.
- `src/tools/agenda/model.test.ts` : jours locaux, événements sur plusieurs jours ou finissant à minuit, libellés d'heure, grille du mois.
- `src/tools/agenda/agenda.test.tsx` : barre du bas, carte d'accueil, liste et fiche, vue mois et navigation, bouton Actualiser, agenda pas encore relié.
- `supabase/tests/rls.test.sql` : les cinq outils activés, Agenda à la place de Voyages.
- `e2e/ecrans.spec.ts` : Agenda (liste et mois) en clair et en sombre, WCAG AA et cibles de 44 px.
