# Lot 9 : installation Android et distribution

> Entrée : lot 8, PLAN lot 9, `docs/DECISIONS.md` (T11 : PWA d'abord, APK via PWABuilder si l'on veut une « vraie app » ; T12 : sous-domaine perso et Vercel ou Netlify).
> Acceptation : l'app est installée sur les deux téléphones, s'ouvre en plein écran et a son icône dans le tiroir d'applications.
> - **Préparé et vérifié ici :** le manifeste est complet, et Chrome juge l'app installable sans aucune erreur. Le test `e2e/installation.spec.ts` le vérifie en CI : manifeste, images aux bonnes tailles, service worker actif, aucune erreur d'installabilité.
> - **À faire par Aurélien :** mettre en ligne, puis installer sur les deux téléphones (voie A). Si tu veux un APK, le générer et le signer (voie B). Ces étapes demandent ton compte Vercel, ton domaine et ta clé de signature.

## Ce qui a été fait

| Zone | Contenu |
|---|---|
| Manifeste (`vite.config.ts`) | Il contient désormais :<br>- `id` stable ;<br>- catégories et `launch_handler`, pour rouvrir la fenêtre existante plutôt que d'en empiler une ;<br>- icônes `any`, `maskable` et **`monochrome`** (`pwa-monochrome-512.png`), pour les icônes teintées d'Android 13 et plus ;<br>- **raccourcis** à l'appui long sur l'icône : Courses, Voyages, À regarder, Dépenses ;<br>- **quatre captures** au format téléphone, montrées par Android dans la fenêtre d'installation. |
| Captures (`public/screenshots/`) | Générées par `npm run screenshots` sur les données du seed : Supabase local, base fraîche, `vite preview`. Elles sont exclues du précache du service worker, qui n'a pas à les télécharger. |
| Hébergement (`vercel.json`) | - Toute adresse de l'app renvoie à `index.html`, sauf `/assets`, `/.well-known` et `/screenshots`.<br>- `sw.js`, les scripts Workbox et le manifeste ne sont jamais mis en cache, pour que les mises à jour arrivent.<br>- Les fichiers de `/assets`, nommés par leur contenu, sont mis en cache un an. |
| Test | `e2e/installation.spec.ts` :<br>- le manifeste, ses icônes et captures, chacune à la taille annoncée ;<br>- le service worker actif ;<br>- `Page.getInstallabilityErrors` de Chrome à vide ;<br>- un raccourci qui mène à son outil après la connexion. |

## Décisions prises dans ce lot

- **Voie A recommandée : installer depuis Chrome.** Sur Android, Chrome fabrique lui-même un vrai paquet (WebAPK) : icône dans le tiroir, plein écran, notifications, mises à jour automatiques, sans clé à garder. L'APK de PWABuilder (voie B) n'apporte que l'indépendance vis-à-vis de Chrome.
- **Pas de Play Store** : deux utilisateurs, aucun besoin de publication. PWABuilder produit aussi le `.aab` si un jour il en faut un.
- `assetlinks.json` n'est pas dans le dépôt : il contient l'empreinte de **ta** clé de signature. Il n'est utile qu'en voie B.

## Mise en ligne (une fois)

1. **Supabase hébergé** : créer le projet, puis `npx supabase link` et `npx supabase db push` (les migrations). Créer les deux comptes sans le seed de développement : *Authentication → Users → Add user*, puis l'espace et les adhésions, comme dans `supabase/seed.sql` sans les données d'exemple. Les fonctions et secrets sont dans `docs/LOT-07.md`, `LOT-10.md`, `LOT-11.md` et `LOT-13.md`.
2. **Supabase → Authentication → URL Configuration** : *Site URL* = `https://oho.<ton-domaine>`. L'ajouter aussi aux *Redirect URLs*, sinon le lien magique ne revient pas.
3. **Vercel** : importer le dépôt GitHub. `vercel.json` règle le build. Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` et `VITE_VAPID_PUBLIC_KEY`, et rien de secret.
4. **Domaine** : dans Vercel, *Settings → Domains*, ajouter `oho.<ton-domaine>`, puis créer chez ton registraire le CNAME indiqué. Le HTTPS est automatique et obligatoire : sans lui, pas d'installation ni de service worker.

## Voie A : installer depuis Chrome (recommandé)

Sur chaque téléphone :

1. Ouvrir `https://oho.<ton-domaine>` dans Chrome et se connecter.
2. Chrome propose « Installer l'application ». Sinon, passer par le menu ⋮ puis « Ajouter à l'écran d'accueil » et « Installer ».
3. L'icône OhO arrive dans le tiroir d'applications. L'app s'ouvre en plein écran, et l'appui long sur l'icône montre les quatre raccourcis.

Mises à jour : rien à faire. Chaque déploiement Vercel arrive au lancement suivant. Si le nom, les icônes ou les raccourcis changent, Chrome met l'icône à jour de lui-même dans la journée.

## Voie B : APK signé avec PWABuilder (facultatif)

1. Sur https://www.pwabuilder.com, entrer `https://oho.<ton-domaine>`. Le rapport doit être vert sur le manifeste et le service worker.
2. *Package for stores → Android → Generate package*. Options :
   - **Package ID** : un identifiant à toi, qui ne changera plus, par exemple `ca.<ton-domaine>.oho` ;
   - **App name** : `OhO`, et **Launcher name** : `OhO` ;
   - **Display mode** : `standalone` ;
   - **Notification delegation** : activé ;
   - **Signing key** : *Create new*. Ton nom suffit ; choisis un mot de passe solide.
3. L'archive contient l'APK (`*.apk`), le `.aab`, **`signing.keystore`**, `signing-key-info.txt` et **`assetlinks.json`**.
   - **Range le keystore et son mot de passe dans ton gestionnaire de mots de passe.** Sans eux, aucune mise à jour de l'APK n'est possible : il faudrait désinstaller et réinstaller.
4. Copier `assetlinks.json` dans `public/.well-known/assetlinks.json`, committer et déployer. Sans ce fichier, l'APK s'ouvre avec une barre d'adresse.
   - Vérification : `https://oho.<ton-domaine>/.well-known/assetlinks.json` répond du JSON.
5. Installer l'APK sur chaque téléphone :
   - l'envoyer, par exemple par Drive ou par câble, et l'ouvrir ;
   - autoriser une fois « Installer des applis inconnues » pour l'appli qui l'ouvre.

Mises à jour de l'APK : le contenu de l'app se met à jour comme en voie A. Il faut regénérer l'APK seulement si le nom, l'icône, les raccourcis ou le domaine changent. Dans ce cas, reprendre l'étape 2 avec **le même keystore** (*Use mine*) et un *version code* plus grand, puis réinstaller par-dessus.

## Démo manuelle (deux téléphones)

1. Sur chaque téléphone, installer OhO (voie A) : l'icône OhO apparaît dans le tiroir d'applications.
2. Ouvrir l'app depuis l'icône : plein écran, sans barre d'adresse, couleur de barre d'état bleu nuit.
3. Appui long sur l'icône → « Voyages » : l'app s'ouvre sur les voyages.
4. Mode avion, ouvrir l'app : la coquille et les dernières données s'affichent, avec « Hors ligne ».
