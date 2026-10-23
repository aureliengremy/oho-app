# Lot 5 : synchronisation temps réel et résilience mobile

> Entrée : lot 4, `docs/DECISIONS.md` (T9, T10), maquette 06 (hors ligne).
> Acceptation : cocher sur un téléphone apparaît sur l'autre en moins de 2 s ; cocher en mode avion puis reconnecter se rejoue correctement. **Couvert par les tests** sur un faux client (un événement Realtime met l'écran à jour en ~150 ms ; le mode avion est rejoué au retour du réseau). **À confirmer en vrai** sur deux téléphones avec Supabase (démo plus bas).

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| `src/core/sync/SyncProvider.tsx` | Un canal Realtime par espace (`postgres_changes` filtré sur `household_id`) sur les tables du socle et celles que chaque outil déclare dans le registre (`tables`). Un changement invalide, par paquets de 150 ms, les requêtes qui lisent la table, sauf celles dont une écriture est en vol. Au retour au premier plan ou du réseau : réabonnement si le canal est tombé, puis rechargement de tout ce qui a pu changer pendant la coupure. |
| `useLiveQuery` (même fichier) | Le hook que chaque outil utilise pour lire : `useQuery` + `tables` suivies, rechargement au premier plan et au retour du réseau, et **repli en polling toutes les 30 s** tant que le temps réel ne répond pas. |
| `src/core/sync/outbox.ts` | File d'attente hors ligne, persistée par espace dans `localStorage` (`oho.outbox.<espace>`). Elle ne prend que des écritures rejouables : insertion à UUID client, mise à jour de colonnes. Deux écritures sur la même ligne fusionnent. Le rejeu se fait dans l'ordre et s'arrête à la première coupure ; une écriture refusée par le serveur est retirée et signalée ; une insertion déjà faite compte comme envoyée. |
| Rejeu | Au démarrage, au retour du réseau, au retour au premier plan, et toutes les 30 s tant qu'il reste quelque chose. Les écritures restent affichées jusqu'à ce que l'état du serveur les contienne : pas de clignotement. |
| Courses | Cocher, ajouter, modifier et supprimer un article passent par la file hors ligne, ou quand la requête se perd en route. « Vider les cochés », les listes et les rayons demandent le réseau et le disent (« Hors ligne : cette action attendra le réseau »). |
| `src/core/sync/ConnectionStatus.tsx` | « En direct » (paire `ok`) dans la barre de titre ; bandeau « Hors ligne · 2 modifications en attente / Dernière synchro à 16 h 51 » (paire `warn`) ; « Envoi de… » pendant le rejeu ; écritures refusées (paire `bad`). Sur la ligne, « En attente » remplace les initiales. |
| Lecture hors ligne | Le cache des requêtes est persisté (`oho.cache`, 7 jours, `@tanstack/react-query-persist-client`) : l'app rouvre hors ligne sur le dernier état connu. |
| Déconnexion | Efface le cache et les files de l'appareil. |

## Décisions prises dans ce lot

- **Une file pour les articles seulement**, comme prévu par T10, élargie de la case à cocher à l'ajout, la modification et la suppression d'article : ce sont des écritures rejouables sans risque grâce aux UUID v7 côté client. Les actions groupées ou structurantes (vider, listes, rayons) attendent le réseau.
- **Dernier écrit gagne** (M4) : une écriture rejouée après coup écrase la valeur du moment. Pour une case à cocher, c'est le comportement attendu.
- **Les initiales et l'heure de la case cochée hors ligne** sont celles de l'appareil en attendant ; le serveur repose les siennes au rejeu (`stamp_checked`).
- `household`, `membership` et `tool_activation` sont suivies aussi : activer un outil chez l'un l'affiche chez l'autre.
- Le cache local contient les données de l'espace : c'est voulu pour la lecture hors ligne, et la déconnexion l'efface.

## Tests

- `src/core/sync/outbox.test.ts` : fusion, superposition, rejeu (ordre, coupure, refus, insertion déjà faite), polling.
- `src/core/sync/sync.test.tsx` : « En direct » et coche venue de l'autre téléphone, réabonnement au premier plan avec rattrapage, mode avion (coche + ajout en attente puis rejoués), action refusée hors ligne, requête perdue en route, rejeu au démarrage, déconnexion qui efface l'appareil.

## Démo manuelle

1. `npx supabase start` puis `npm run dev -- --host` ; ouvrir l'app sur deux téléphones (Aurélien, Auriane) sur le même réseau.
2. Les deux voient « En direct ». Auriane coche Lait : il descend dans le panier d'Aurélien en moins de 2 s.
3. Aurélien passe en mode avion, coche Avocats et ajoute « kiwis » : bandeau « Hors ligne · 2 modifications en attente », « En attente » sur les lignes.
4. Il ferme l'app, la rouvre toujours en mode avion : la liste et les écritures en attente sont là.
5. Il coupe le mode avion : le bandeau disparaît, Auriane voit Avocats coché et Kiwis.
