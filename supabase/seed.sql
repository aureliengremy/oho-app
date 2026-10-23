-- =============================================================================
-- OhO · Seed (S13 : comptes créés à la main, pas d'inscription ouverte)
-- Rejouable : nettoie d'abord ce qu'il a créé (identifiants fixes).
--
-- ATTENTION : mots de passe de développement. Changez-les avant tout usage réel
-- (tableau de bord Supabase > Authentication, ou update auth.users avec un
-- nouveau crypt()) et ne réutilisez jamais ce seed tel quel en production.
-- =============================================================================

-- Nettoyage : le foyer emporte tout par cascade ; les comptes emportent profils
-- et adhésions.
delete from public.household where id = '0192f000-0000-7000-8000-000000000001';
delete from auth.users
where id in ('0192f000-0000-7000-8000-0000000000a1', '0192f000-0000-7000-8000-0000000000a2')
   or email in ('aurelien@example.com', 'auriane@example.com');

-- -----------------------------------------------------------------------------
-- Comptes (format attendu par Supabase Auth en local). handle_new_user crée
-- les profils à partir de raw_user_meta_data.
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '0192f000-0000-7000-8000-0000000000a1',
   'authenticated', 'authenticated', 'aurelien@example.com',
   extensions.crypt('oho-aurelien-dev', extensions.gen_salt('bf')), now(),
   '{"provider": "email", "providers": ["email"]}',
   '{"display_name": "Aurélien", "avatar_color": "#1f6f8b"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0192f000-0000-7000-8000-0000000000a2',
   'authenticated', 'authenticated', 'auriane@example.com',
   extensions.crypt('oho-auriane-dev', extensions.gen_salt('bf')), now(),
   '{"provider": "email", "providers": ["email"]}',
   '{"display_name": "Auriane", "avatar_color": "#c9a46a"}',
   '', '', '', '', now(), now());

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in ('0192f000-0000-7000-8000-0000000000a1', '0192f000-0000-7000-8000-0000000000a2');

-- Initiales d'avatar : les deux prénoms commencent par A.
update public.profile set initials = 'AL' where id = '0192f000-0000-7000-8000-0000000000a1';
update public.profile set initials = 'AN' where id = '0192f000-0000-7000-8000-0000000000a2';

-- -----------------------------------------------------------------------------
-- L'espace commun et ses deux propriétaires
-- -----------------------------------------------------------------------------
insert into public.household (id, name, timezone, created_by)
values ('0192f000-0000-7000-8000-000000000001', 'Aurélien & Auriane', 'America/Toronto',
        '0192f000-0000-7000-8000-0000000000a1');

insert into public.membership (household_id, user_id, role, created_by)
values
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000000a1', 'owner',
   '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000000a2', 'owner',
   '0192f000-0000-7000-8000-0000000000a1');

-- Outils : activés au fil des lots livrés ; les autres arrivent désactivés.
insert into public.tool_activation (household_id, tool_key, enabled, sort_order, created_by)
values
  ('0192f000-0000-7000-8000-000000000001', 'shopping',  true,  1, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', 'trips',     true,  2, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', 'watchlist', true,  3, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', 'expenses',  false, 4, '0192f000-0000-7000-8000-0000000000a1');

-- -----------------------------------------------------------------------------
-- Rayons, dans l'ordre du magasin
-- -----------------------------------------------------------------------------
insert into public.shopping_category (id, household_id, name, emoji, sort_order, created_by)
values
  ('0192f000-0000-7000-8000-0000000c0001', '0192f000-0000-7000-8000-000000000001', 'Fruits et légumes', '🥕', 1, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-0000000c0002', '0192f000-0000-7000-8000-000000000001', 'Boulangerie',       '🥖', 2, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-0000000c0003', '0192f000-0000-7000-8000-000000000001', 'Produits laitiers', '🧀', 3, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-0000000c0004', '0192f000-0000-7000-8000-000000000001', 'Viandes et poissons','🐟', 4, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-0000000c0005', '0192f000-0000-7000-8000-000000000001', 'Épicerie',          '🥫', 5, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-0000000c0006', '0192f000-0000-7000-8000-000000000001', 'Surgelés',          '🧊', 6, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-0000000c0007', '0192f000-0000-7000-8000-000000000001', 'Maison et hygiène', '🧴', 7, '0192f000-0000-7000-8000-0000000000a1');

-- -----------------------------------------------------------------------------
-- La liste Épicerie par défaut et quelques items (catalog_learn remplit le
-- catalogue au passage).
-- -----------------------------------------------------------------------------
insert into public.checklist (id, household_id, kind, name, is_default, sort_order, created_by)
values ('0192f000-0000-7000-8000-0000000d0001', '0192f000-0000-7000-8000-000000000001',
        'shopping', 'Épicerie', true, 1, '0192f000-0000-7000-8000-0000000000a1');

insert into public.checklist_item (household_id, checklist_id, label, quantity, note, category_id, checked, sort_order, created_by)
values
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0001', 'Pommes',        '6',    null,             '0192f000-0000-7000-8000-0000000c0001', false, 1, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0001', 'Bananes',       null,   null,             '0192f000-0000-7000-8000-0000000c0001', false, 2, '0192f000-0000-7000-8000-0000000000a2'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0001', 'Baguette',      '1',    null,             '0192f000-0000-7000-8000-0000000c0002', false, 3, '0192f000-0000-7000-8000-0000000000a2'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0001', 'Lait',          '2 L',  'sans lactose',   '0192f000-0000-7000-8000-0000000c0003', false, 4, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0001', 'Œufs',          '12',   null,             '0192f000-0000-7000-8000-0000000c0003', false, 5, '0192f000-0000-7000-8000-0000000000a2'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0001', 'Café',          null,   null,             '0192f000-0000-7000-8000-0000000c0005', false, 6, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0001', 'Papier toilette', null, null,             '0192f000-0000-7000-8000-0000000c0007', true,  7, '0192f000-0000-7000-8000-0000000000a2');

-- -----------------------------------------------------------------------------
-- Voyages (lot 6) : un voyage planifié, ses idées, une réservation et sa valise.
-- -----------------------------------------------------------------------------
insert into public.trip (id, household_id, title, destination, start_date, end_date, status, cover_emoji, created_by)
values ('0192f000-0000-7000-8000-0000000e0001', '0192f000-0000-7000-8000-000000000001',
        'Lisbonne & Porto', 'Portugal', '2026-11-06', '2026-11-16', 'planned', '🇵🇹',
        '0192f000-0000-7000-8000-0000000000a1');

insert into public.trip_activity (household_id, trip_id, title, note, sort_order, created_by)
values
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000e0001', 'Pastéis de Belém', 'aller tôt, file courte avant 9 h', 1, '0192f000-0000-7000-8000-0000000000a2'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000e0001', 'Tram 28 jusqu’à Graça', 'coucher de soleil au miradouro', 2, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000e0001', 'Journée à Sintra', 'Pena et Quinta da Regaleira', 3, '0192f000-0000-7000-8000-0000000000a2');

insert into public.booking (household_id, trip_id, kind, title, starts_at, tz, reference, amount, currency, created_by)
values ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000e0001', 'flight',
        'Vol YUL → LIS', '2026-11-07 02:35+00', 'America/Toronto', 'QX7P2M', 1486.00, 'CAD',
        '0192f000-0000-7000-8000-0000000000a1');

insert into public.checklist (id, household_id, kind, name, is_default, sort_order, trip_id, created_by)
values ('0192f000-0000-7000-8000-0000000d0002', '0192f000-0000-7000-8000-000000000001',
        'trip_prep', 'Préparation', false, 2, '0192f000-0000-7000-8000-0000000e0001',
        '0192f000-0000-7000-8000-0000000000a1');

insert into public.checklist_item (household_id, checklist_id, label, quantity, checked, sort_order, created_by)
values
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0002', 'Passeports valides', null, true,  1, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0002', 'Assurance voyage',   null, false, 2, '0192f000-0000-7000-8000-0000000000a2'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-0000000d0002', 'Adaptateur prise européenne', '2', false, 3, '0192f000-0000-7000-8000-0000000000a1');

-- -----------------------------------------------------------------------------
-- À regarder (lot 7) : nos plateformes, deux fiches TMDB en cache, trois titres.
-- Le cache est global (hors foyer) : on ne le vide pas, on le complète.
-- -----------------------------------------------------------------------------
insert into public.external_media (id, media_type, external_id, title, original_title, year, overview, runtime_min, number_of_seasons, genres)
values
  ('0192f000-0000-7000-8000-0000000f0001', 'movie', '666277', 'Past Lives', 'Past Lives', 2023,
   'Nora et Hae Sung, amis d’enfance, se retrouvent à New York vingt ans plus tard, le temps d’une semaine.', 106, null, '["Drame", "Romance"]'),
  ('0192f000-0000-7000-8000-0000000f0002', 'tv', '95396', 'Severance', 'Severance', 2022,
   'Mark dirige une équipe de bureau dont les employés ont subi une procédure de « dissociation » : leurs souvenirs du travail et de la vie privée sont séparés.', 50, 2, '["Drame", "Mystère"]')
on conflict (source, media_type, external_id) do nothing;

insert into public.watch_platform (id, household_id, name, is_subscribed, tmdb_provider_id, sort_order, created_by)
values
  ('0192f000-0000-7000-8000-000000100001', '0192f000-0000-7000-8000-000000000001', 'Netflix',     true,  8,   1, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000100002', '0192f000-0000-7000-8000-000000000001', 'Crave',       true,  230, 2, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000100003', '0192f000-0000-7000-8000-000000000001', 'Prime Video', true,  119, 3, '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000100004', '0192f000-0000-7000-8000-000000000001', 'Apple TV+',   false, 350, 4, '0192f000-0000-7000-8000-0000000000a1');

insert into public.watch_item (id, household_id, title, kind, status, platform_id, media_id, season_current, episode_current, runtime_min, suggested_by, created_by)
values
  ('0192f000-0000-7000-8000-000000110001', '0192f000-0000-7000-8000-000000000001', 'Past Lives', 'movie', 'to_watch',
   '0192f000-0000-7000-8000-000000100003', '0192f000-0000-7000-8000-0000000f0001', null, null, null,
   '0192f000-0000-7000-8000-0000000000a2', '0192f000-0000-7000-8000-0000000000a2'),
  ('0192f000-0000-7000-8000-000000110002', '0192f000-0000-7000-8000-000000000001', 'Severance', 'series', 'watching',
   '0192f000-0000-7000-8000-000000100004', '0192f000-0000-7000-8000-0000000f0002', 2, 6, null,
   '0192f000-0000-7000-8000-0000000000a1', '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000110003', '0192f000-0000-7000-8000-000000000001', 'Le règne animal', 'movie', 'to_watch',
   '0192f000-0000-7000-8000-000000100002', null, null, null, 128,
   '0192f000-0000-7000-8000-0000000000a1', '0192f000-0000-7000-8000-0000000000a1');

insert into public.watch_rating (household_id, watch_item_id, user_id, rating, comment, created_by)
values
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-000000110002', '0192f000-0000-7000-8000-0000000000a1', 5, null,
   '0192f000-0000-7000-8000-0000000000a1'),
  ('0192f000-0000-7000-8000-000000000001', '0192f000-0000-7000-8000-000000110002', '0192f000-0000-7000-8000-0000000000a2', 4,
   'Lent au début, puis impossible d’arrêter.', '0192f000-0000-7000-8000-0000000000a2');
