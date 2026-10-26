-- =============================================================================
-- Emoji d'avatar choisi par la personne (un animal de la grille des Réglages).
-- Vide : l'avatar affiche les initiales. Le contour garde la couleur de la
-- personne dans les deux cas (D2). La liste des emojis vit côté app ; la base
-- borne seulement la longueur (un emoji fait au plus quelques points de code).
-- =============================================================================

alter table public.profile
  add column avatar_emoji text
    check (char_length(avatar_emoji) between 1 and 8 and avatar_emoji !~ '[[:alnum:][:space:]]');

comment on column public.profile.avatar_emoji is 'Emoji affiché dans l''avatar à la place des initiales (vide : initiales).';
