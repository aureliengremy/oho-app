# Icône nazar et avatars emoji (2026-10-26)

## Ce qui a été fait
- **Icône de l'app** : un œil de nazar dessiné en plein cadre (verre bleu, iris blanc et turquoise, pupille bleu nuit), proposition B validée par Aurélien. Les dessins sources sont dans `design/icone/` ; `npm run icons` regénère `public/pwa-*.png` et `public/apple-touch-icon.png`. Le favicon reprend le même dessin avec des coins arrondis.
- **Avatars** : dans Réglages, section « Mon avatar », chacun choisit un animal parmi 33 emojis (`src/core/ui/avatarEmojis.ts`) ou revient à ses initiales. L'emoji s'affiche partout où l'avatar apparaît.

## Décisions
- L'œil tient dans la zone sûre de 40 % : la même image sert d'icône normale et « maskable » (rond, goutte, carré arrondi selon le téléphone). L'icône monochrome (Android 13+) est une silhouette en anneaux.
- `profile.avatar_emoji` est vide par défaut (initiales). La base borne seulement la longueur et refuse lettres et chiffres ; la liste des animaux vit dans l'app, l'enrichir ne demande pas de migration.
- D2 mis à jour : le contour garde la couleur de la personne (océan, sable) avec l'emoji comme avec les initiales.
- Les emojis s'affichent avec la police du téléphone (emojis Google sur Android), sans rien télécharger.

## Démo manuelle
1. `npx supabase db reset` (applique la migration), `npm run dev`, se connecter en Aurélien.
2. Réglages → Mon avatar → toucher 🦦 : l'avatar de l'accueil et de la liste des membres devient la loutre, cerclé d'océan.
3. Toucher « AL » : retour aux initiales.
4. Installer l'app depuis Chrome Android : l'icône est le nazar. Sur une app déjà installée, Android peut garder l'ancienne icône un moment ; la désinstaller puis la réinstaller force la mise à jour.
