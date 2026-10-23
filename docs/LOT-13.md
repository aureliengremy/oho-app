# Lot 13 : outil Dépenses

> Entrée : lots 5 et 6, PLAN §1.5, `docs/DECISIONS.md` (M14 à M22, D4, D5), maquettes 14 à 17.
> Acceptation : un carnet par voyage et un carnet Quotidien, une dépense en euros convertie en dollars, le solde en une phrase, « Marquer comme remboursé ». **Couvert par les tests** sur un faux client (la RPC et la fonction de taux simulées) et par `npm run test:db` (contraintes, RPC, vues, accès). **À confirmer en vrai** une fois la fonction `fx` déployée (voir plus bas).

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| Migration `20261023000900_depenses.sql` | Tables `expense_book`, `expense`, `expense_share` et `settlement`, plus l'énumération `expense_split_mode`. **Montants en centièmes** (`bigint`), jamais en flottant. `book_amount_cents` est calculé par la base (`round(amount_cents × fx_rate)`). Un carnet par voyage au plus (M18). Supprimer le voyage détache le carnet sans toucher à l'argent. Une réservation ne compte que pour une dépense. |
| Garde-fous | En devise du carnet, le taux est forcé à 1. Un trigger différé vérifie à la validation que **les parts totalisent la dépense convertie**. Le journal d'activité couvre carnets, dépenses et remboursements, ce qui garde la trace d'une dépense modifiée par l'autre (M22). |
| RPC `save_expense` | Écrit une dépense et ses parts **d'un bloc**, en une transaction (M19). Elle est `security invoker`, donc la RLS s'applique. Les anciennes parts sont marquées supprimées puis remplacées. |
| Vues | `expense_balance` donne le solde par membre et par carnet. `trip_budget_view` donne le dépensé par poste d'un voyage. Les deux sont en `security_invoker`. |
| `supabase/functions/fx/` | Edge Function qui propose le taux du jour (Frankfurter, BCE, sans clé). Elle exige un compte connecté. Le calcul est dans `rate.ts`, testé par Vitest. |
| `src/tools/expenses/` | **Carnet** : pastilles des carnets, solde en une phrase (« Tu dois 115,50 $ à Auriane ») avec sa pastille, total et ta part, dépenses par jour. Les dépenses d'avant le départ sont regroupées. **Saisie** : montant, devise, taux proposé puis modifiable, qui a payé, partage Égal, Montants ou Parts, catégorie, date et note. **Qui doit quoi** : une barre par personne autour du zéro, le virement suggéré, « Marquer comme remboursé » et les remboursements passés (annulables). **Statistiques** : total, moyenne par jour, dépensé par catégorie et qui a payé. |
| Avec Voyages | L'onglet Budget montre le dépensé par poste et un lien « Ouvrir le carnet ». Sans carnet, il propose d'en ouvrir un (pas de carnet automatique, M20). Chaque réservation porte « Créer la dépense », qui pré-remplit la saisie (titre, montant, devise, catégorie) et la relie. Les deux outils ne s'importent pas : de simples liens, et des lectures en base. |
| Socle | `src/core/lib/money.ts` regroupe catégories, devises, mise en forme, saisie en centièmes et conversion exacte au centime, identique à Postgres. `src/core/lib/day.ts` monte de Voyages. Le faux client simule `save_expense`. |

## Décisions prises dans ce lot

- **Le centime d'arrondi** va par le plus fort reste (M16), à égalité dans l'ordre d'arrivée des membres. Il n'est jamais recalculé ensuite.
- **Les parts sont en devise du carnet.** En « Montants », on saisit dans la devise de la dépense, puis la conversion se fait au prorata, exacte au centime en même devise.
- **Le taux est figé** à l'enregistrement. Rouvrir une dépense ne le redemande pas, sauf si l'on change de devise. Si la fonction ne répond pas, l'écran le dit et l'on saisit le taux.
- **Un remboursement** porte le montant suggéré, daté du jour. On l'annule depuis l'historique, ce qui le marque supprimé.
- **La devise d'un carnet** ne change plus une fois des dépenses saisies. Supprimer un carnet demande une confirmation et emporte ses dépenses (suppression douce).
- **Les écritures Dépenses ne passent pas par la file hors ligne**, comme pour Voyages : hors réseau, elles échouent et le disent. Une entrée d'outbox pour la RPC (T10) viendra avec le lot 8 si le besoin se confirme.
- **`/depenses` ouvre le carnet du voyage en cours**, sinon le premier carnet.

## Pour brancher le taux du jour (à faire une fois)

`npx supabase functions deploy fx`. Il n'y a pas de clé à poser. Sans la fonction, la saisie reste possible avec un taux tapé à la main.

## Tests

- `src/core/lib/money.test.ts` : saisie en centièmes, mise en forme, conversion arrondie comme Postgres.
- `src/tools/expenses/model.test.ts` : partage au centime, soldes, virements suggérés, regroupement par jour, parts selon le mode, solde vu par chacun, carnet par défaut.
- `src/tools/expenses/expenses.test.tsx` : carnet et phrase de solde, remboursement pris en compte, création de carnet, saisie en euros avec taux proposé, taux saisi à la main, « Montants » à répartir, modification puis suppression, échec du serveur, qui doit quoi et « Marquer comme remboursé », statistiques, carnet ouvert depuis un voyage, dépense créée depuis une réservation, dépensé dans l'onglet Budget.
- `supabase/functions/fx/rate.test.ts` : lecture de la réponse et devises refusées.
- `supabase/tests/expenses.test.sql` : contraintes, taux forcé en même devise, somme des parts, RPC (création, modification, autre espace refusé), vues, journal, isolation entre espaces.

## Démo manuelle (deux téléphones)

1. Aurélien : Voyages → Lisbonne → Budget → « Ouvrir un carnet ». Puis Réservations → « Créer la dépense » sur le vol : montant et titre sont déjà remplis, « Enregistrer ».
2. Auriane : Dépenses → « + Dépense », 64 en EUR, le taux du jour s'affiche. « Dîner », payé par Auriane, Égal.
3. Aurélien lit « Tu dois … à Auriane » ; il touche la phrase, puis « Marquer comme remboursé ».
4. Statistiques : le total, la moyenne par jour, les catégories et qui a payé.
