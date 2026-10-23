# Lot 6 : outil Voyages

> Entrée : lot 5, PLAN §1.3, `docs/DECISIONS.md` (P3, M8, M10, M11), maquettes 08 et 09.
> Acceptation : créer un voyage, y attacher une checklist et deux réservations, pièce jointe consultable depuis l'autre compte. **Couvert par les tests** sur un faux client (création, checklist, réservation, envoi et ouverture d'une pièce jointe par URL signée). La policy du bucket n'est pas couverte par `npm run test:db` (le Postgres jetable n'a pas le schéma `storage`, la migration saute cette partie) : elle se vérifie avec `npx supabase start`. **À confirmer en vrai** avec Supabase sur deux téléphones (démo plus bas).

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| Migration `20261023000700_voyages.sql` | Tables `trip`, `trip_activity` (idées), `booking`, `trip_budget_line`, `attachment` ; énumérations `trip_status`, `booking_kind`, `expense_category` (reprise au lot 13) ; `checklist.trip_id` (une checklist de préparation par voyage, M8). Clés étrangères composites `(household_id, …)`, RLS par espace, journal d'activité côté Voyages, publication Realtime. Bucket privé `attachments` (20 Mo) et sa policy : le premier segment du chemin doit être un espace dont on est membre. |
| Seed | Lisbonne & Porto (planifié), trois idées, le vol YUL → LIS et une checklist « Préparation ». |
| `src/tools/trips/` | Liste groupée par moment (Maintenant, À venir, Un jour, Souvenirs) avec filtres par statut ; fiche voyage avec quatre onglets : Idées, Checklist, Réservations, Budget. |
| Réservations | Heures saisies et affichées **dans le fuseau du lieu** (`src/core/lib/zoned.ts`, sans bibliothèque), référence, montant et devise, lien, note. Pièces jointes : envoi direct au bucket (`{espace}/booking/{réservation}/{id}`), ouverture par **URL signée de 60 s**, jamais d'URL stockée. |
| Statut (M10) | Stocké ; la fiche propose « Passer en cours ? » ou « terminé » quand les dates le disent, sans rien changer seule. |
| Budget (P3) | Le prévu par poste et le total par devise. Le dépensé viendra du carnet lié (lot 13, `trip_budget_view`). |
| Accueil | Carte « Prochain voyage » (ou « Voyage en cours ») avec le compte à rebours et l'avancement de la préparation. Le registre accepte une `homeCard` par outil. |
| Réglages | « Outils de l'espace » : activer ou masquer un outil pour les deux (`tool_activation`). |
| Socle | `src/core/checklist/` (ligne de checklist et saisie rapide, partagées par Courses et Voyages) ; `useOptimisticWrites` (écritures optimistes et file hors ligne, extrait des Courses) ; `SelectField`, `TextAreaField` ; `npm run db:types` régénère `database.types.ts` depuis les migrations. |

## Décisions prises dans ce lot

- **Un fuseau par réservation.** Un vol Montréal → Lisbonne affiche départ et arrivée dans le fuseau choisi (l'heure du lieu est précisée quand il diffère de celui du téléphone). Un second fuseau pour l'arrivée viendra si le besoin se confirme.
- **Pièce jointe retirée = ligne marquée supprimée**, le fichier reste dans le bucket jusqu'à la purge (même règle de suppression douce que le reste). Si l'enregistrement de la ligne échoue après l'envoi, le fichier est retiré tout de suite.
- **Supprimer un voyage** le masque avec tout son contenu (les écrans ne lisent que les enfants des voyages vivants) ; ses pièces jointes de réservation sont marquées par trigger.
- **Les écritures Voyages ne passent pas par la file hors ligne** : hors réseau, elles échouent et le disent. La file reste réservée aux articles (T10).
- Un voyage créé avec des dates passe directement en « Planifié ».
- L'heure du vol de démonstration est corrigée à 21 h 35 (heure de l'Est en novembre).

## Tests

- `src/tools/trips/model.test.ts` : groupes, prochain voyage, suggestion de statut, dates et compte à rebours, avancement.
- `src/core/lib/zoned.test.ts` : conversions de fuseau, heure d'été, aller-retour du champ `datetime-local`.
- `src/tools/trips/trips.test.tsx` : liste et filtres, création (et dates refusées), idées, checklist (création unique, ajout groupé, avancement), réservation saisie à l'heure de Lisbonne, pièce jointe (URL signée, envoi, échec), budget, suggestion de statut, suppression, carte d'accueil, activation des outils.
- `supabase/tests/trips.test.sql` : contraintes, checklist de voyage, journal, pièces jointes (chemin, 20 Mo, cascade), isolation entre espaces.

## Démo manuelle (deux téléphones)

1. Aurélien : Voyages → « + Voyage », « Lisbonne & Porto » du 6 au 16 novembre ; la carte « Prochain voyage » apparaît sur l'accueil.
2. Onglet Checklist → « Créer la checklist », puis « passeports, adaptateur, assurance » ; Auriane coche « passeports » : l'avancement bouge chez Aurélien.
3. Onglet Réservations → ajouter le vol (fuseau Toronto) et l'appartement (fuseau Lisbonne), puis « Joindre un fichier » sur le vol.
4. Auriane ouvre la même réservation et touche le PDF : il s'ouvre (URL signée de 60 s).
