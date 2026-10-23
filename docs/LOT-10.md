# Lot 10 : notifications push

> Entrée : lot 5, PLAN lot 10, `docs/DECISIONS.md` (P5), modèle de données (socle : `push_subscription`, `notification_pref`).
> Acceptation : des articles ajoutés par un compte donnent une notification regroupée sur l'autre téléphone.
> - **Couvert par les tests :**
>   - `npm run test:db` couvre le regroupement, l'anti-spam, les préférences, la prise des résumés et le rapport d'envoi.
>   - Les tests d'écran couvrent la permission, l'abonnement et les préférences.
>   - Vitest couvre le texte des messages.
> - **À confirmer en vrai** une fois les clés posées (voir plus bas). L'envoi Web Push lui-même, par `web-push` dans Deno, n'a pas pu être exercé ici.

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| Migration `20261023001000_push.sql` | Trois tables :<br>- `push_subscription` : un navigateur abonné, qui appartient à une personne, avec un `endpoint` unique et un compteur d'échecs.<br>- `notification_pref` : par membre et par outil, avec `enabled` et `digest_minutes` de 0 à 120.<br>- `push_digest` : la file des résumés en attente. |
| Regroupement | Le journal d'activité est la seule source des push. Le trigger `queue_push` ouvre **un résumé par destinataire et par outil**. Il compte les ajouts et garde les cinq premiers libellés. L'échéance est fixée au premier ajout (5 minutes par défaut) : un flot continu ne retarde donc pas l'envoi indéfiniment. |
| Anti-spam | - Seules les **créations** notifient : cocher un article ne sonne pas.<br>- On n'est **jamais notifié de ses propres actions**.<br>- Rien n'est mis en file pour un outil désactivé ou coupé, ni pour qui n'a aucun appareil abonné.<br>- Une notification par outil (`tag`) : la suivante remplace la précédente au lieu de s'empiler. |
| RPC | - `register_push` abonne ce navigateur. Elle fait un upsert sur l'endpoint, et un navigateur qui change de compte change de propriétaire.<br>- `claim_push_digests` et `report_push` sont réservées au service. Une réponse 404 ou 410, ou trois échecs, retire l'appareil. |
| `supabase/functions/push-send/` | Appelée chaque minute par `pg_cron` et `pg_net` avec un secret partagé, sans JWT. Elle prend les résumés échus, les envoie en Web Push signé VAPID, puis rend compte des appareils livrés, disparus ou en échec. Le texte est dans `message.ts`, testé, par exemple « Auriane a ajouté 3 articles : « Lait », « Pain » et « Avocats ». ». |
| App | Réglages → **Notifications** :<br>- « Activer sur ce téléphone » ;<br>- un interrupteur par outil ;<br>- « Les ajouts arrivent » : tout de suite, ou regroupés sur 5 min, 15 min ou 1 h ;<br>- la liste de mes appareils, avec « Retirer » ;<br>- les cas sans push, expliqués : iPhone pas encore installé à l'écran d'accueil, navigateur sans push, permission bloquée, serveur pas encore branché.<br>Le service worker charge `public/push-sw.js` (réception et ouverture de l'outil au toucher). |

## Décisions prises dans ce lot

- **La permission n'est demandée que sur un geste**, le bouton « Activer sur ce téléphone », jamais à l'ouverture. Un refus ne crée rien et l'écran explique comment débloquer.
- **Sans préférence enregistrée, un outil notifie** et regroupe sur 5 minutes. Le réglage « Les ajouts arrivent » s'applique à tous les outils actifs d'un coup.
- **Les préférences sont par personne, pas par appareil.** Couper les Courses les coupe sur tous ses téléphones.
- **La file des push n'est lisible par personne depuis l'app.** C'est une exception documentée dans `rls.test.sql`. Chacun ne voit et ne retire que ses propres appareils.
- Les résumés envoyés sont effacés après une journée.

## Pour brancher les push (à faire une fois)

1. Générer les clés : `npx web-push generate-vapid-keys`.
2. Poser la clé publique dans `.env.local` et dans les variables du déploiement : `VITE_VAPID_PUBLIC_KEY=…`.
3. Poser les secrets de la fonction :
   `npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:aurelien@… PUSH_CRON_SECRET=<une longue chaîne au hasard>`
4. Déployer : `npx supabase functions deploy push-send`. La fonction n'exige pas de JWT, voir `supabase/config.toml`.
5. Dans l'éditeur SQL du projet, donner au cron l'URL et le même secret :
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<la même chaîne que PUSH_CRON_SECRET>', 'push_cron_secret');
   ```
   Tant que ces deux secrets manquent, le job `oho_push_send` tourne chaque minute sans rien faire.

## Tests

- `supabase/tests/push.test.sql` couvre :
  - un résumé par outil pour l'autre membre seulement, avec trois ajouts regroupés, sans compter les cases cochées ;
  - l'échéance à 5 minutes, la prise unique du résumé et le résumé suivant ;
  - un outil coupé, un réglage immédiat, un outil désactivé, l'absence d'appareil ;
  - l'appareil qui change de compte ;
  - les accès refusés : insertion directe, file, préférence d'un autre, intrus ;
  - le rapport d'envoi : échecs, retour à zéro, 410.
- `supabase/tests/rls.test.sql` documente les deux exceptions (file illisible, suppression de ses appareils).
- `supabase/functions/push-send/message.test.ts` couvre le texte (un ajout, plusieurs, deux auteurs, outil inconnu) et le sort d'un appareil selon le code HTTP.
- `src/core/push/push.test.ts` couvre la clé VAPID et le nom d'appareil.
- `src/app/screens/notifications.test.tsx` couvre la permission demandée seulement au toucher, l'abonnement, le refus, les préférences par outil et le regroupement, la coupure, et le cas iPhone.

## Démo manuelle (deux téléphones)

1. Sur chaque téléphone, OhO installé : Réglages → Notifications → « Activer sur ce téléphone », puis accepter.
2. Auriane ajoute « lait, pain, avocats » aux Courses. Environ 5 minutes plus tard, Aurélien reçoit « Auriane a ajouté 3 articles : … ».
3. Aurélien touche la notification : la liste de courses s'ouvre.
4. Aurélien coupe « Courses » ; Auriane ajoute un article : rien n'arrive.
