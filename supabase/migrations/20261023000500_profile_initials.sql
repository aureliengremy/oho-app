-- =============================================================================
-- Initiales d'avatar choisies par la personne. Aurélien et Auriane commencent
-- tous deux par A : la première lettre seule ne les distingue pas (AL / AN).
-- Vide : l'app prend les deux premières lettres du prénom.
-- =============================================================================

alter table public.profile
  add column initials text
    check (initials ~ '^[[:alnum:]]{1,3}$' and initials = upper(initials));

comment on column public.profile.initials is 'Initiales affichées dans l''avatar (1 à 3 caractères, majuscules).';
