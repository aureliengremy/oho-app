-- =============================================================================
-- OhO · Lot 7 · À regarder
-- external_media (cache TMDB global), watch_platform, watch_item, watch_rating.
-- Source : docs/cadrage/modele-donnees.html (onglet VI), DECISIONS P4, M12.
-- =============================================================================

create type public.watch_kind as enum ('movie', 'series');
create type public.watch_status as enum ('to_watch', 'watching', 'watched', 'dropped');

-- -----------------------------------------------------------------------------
-- external_media : métadonnées publiques TMDB, une copie pour tous les foyers.
-- Exception documentée à la règle household_id : lisible par tout compte connecté,
-- écrite par la seule Edge Function « tmdb » (service_role), qui détient la clé.
-- -----------------------------------------------------------------------------
create table public.external_media (
  id uuid primary key default private.uuid_generate_v7(),
  source text not null default 'tmdb' check (source ~ '^[a-z]+$'),
  media_type text not null check (media_type in ('movie', 'tv')),
  external_id text not null check (char_length(external_id) between 1 and 40),
  title text not null check (char_length(title) between 1 and 300),
  original_title text,
  year smallint check (year between 1870 and 2200),
  overview text,
  poster_path text check (poster_path ~ '^/[A-Za-z0-9._-]+$'),
  runtime_min smallint check (runtime_min > 0),
  number_of_seasons smallint check (number_of_seasons >= 0),
  genres jsonb,
  providers jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_media_source_key unique (source, media_type, external_id)
);

-- -----------------------------------------------------------------------------
-- watch_platform : les plateformes du foyer, pour le filtre « ce soir ».
-- -----------------------------------------------------------------------------
create table public.watch_platform (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  is_subscribed boolean not null default true,
  tmdb_provider_id integer,
  sort_order double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint watch_platform_household_id_id_key unique (household_id, id)
);

create unique index watch_platform_household_id_name_key
  on public.watch_platform (household_id, lower(btrim(name))) where deleted_at is null;
create index watch_platform_household_id_updated_at_idx on public.watch_platform (household_id, updated_at);
create index watch_platform_created_by_idx on public.watch_platform (created_by);
create index watch_platform_updated_by_idx on public.watch_platform (updated_by);

-- -----------------------------------------------------------------------------
-- watch_item : un film ou une série du foyer. Progression partagée (M12).
-- -----------------------------------------------------------------------------
create table public.watch_item (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  kind public.watch_kind not null,
  status public.watch_status not null default 'to_watch',
  platform_id uuid,
  media_id uuid references public.external_media (id) on delete restrict,
  season_current smallint check (season_current > 0),
  episode_current smallint check (episode_current > 0),
  runtime_min smallint check (runtime_min > 0),
  suggested_by uuid default auth.uid() references public.profile (id) on delete set null,
  comment text check (char_length(comment) <= 2000),
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint watch_item_household_id_id_key unique (household_id, id),
  constraint watch_item_platform_fkey foreign key (household_id, platform_id)
    references public.watch_platform (household_id, id) on delete set null (platform_id),
  constraint watch_item_progress_check check (kind = 'series' or (season_current is null and episode_current is null))
);

create index watch_item_household_id_status_idx on public.watch_item (household_id, status) where deleted_at is null;
create unique index watch_item_household_id_media_id_key
  on public.watch_item (household_id, media_id) where media_id is not null and deleted_at is null;
create index watch_item_household_id_updated_at_idx on public.watch_item (household_id, updated_at);
create index watch_item_media_id_idx on public.watch_item (media_id);
create index watch_item_platform_id_idx on public.watch_item (household_id, platform_id);
create index watch_item_suggested_by_idx on public.watch_item (suggested_by);
create index watch_item_created_by_idx on public.watch_item (created_by);
create index watch_item_updated_by_idx on public.watch_item (updated_by);

-- -----------------------------------------------------------------------------
-- watch_rating : une note par personne et par titre.
-- -----------------------------------------------------------------------------
create table public.watch_rating (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  watch_item_id uuid not null,
  user_id uuid not null default auth.uid() references public.profile (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  foreign key (household_id, watch_item_id) references public.watch_item (household_id, id) on delete cascade
);

create unique index watch_rating_item_user_key
  on public.watch_rating (watch_item_id, user_id) where deleted_at is null;
create index watch_rating_household_id_updated_at_idx on public.watch_rating (household_id, updated_at);
create index watch_rating_user_id_idx on public.watch_rating (user_id);
create index watch_rating_created_by_idx on public.watch_rating (created_by);
create index watch_rating_updated_by_idx on public.watch_rating (updated_by);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Passer en « vu » date le visionnage ; en repartir l'efface.
create or replace function private.stamp_watched()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'watched' and (tg_op = 'INSERT' or old.status is distinct from 'watched') then
    new.watched_at := coalesce(new.watched_at, now());
  elsif new.status <> 'watched' then
    new.watched_at := null;
  end if;
  return new;
end;
$$;

-- updated_at du cache (pas de colonnes « qui » : écrit par le service).
create or replace function private.touch_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_media before update on public.external_media
  for each row execute function private.touch_media();

create trigger touch_row before insert or update on public.watch_platform
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.watch_item
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.watch_rating
  for each row execute function private.touch_row();

create trigger stamp_watched before insert or update of status on public.watch_item
  for each row execute function private.stamp_watched();

create trigger log_activity after insert or update or delete on public.watch_item
  for each row execute function private.log_activity('watchlist');

-- -----------------------------------------------------------------------------
-- RLS, policies, privilèges
-- -----------------------------------------------------------------------------
alter table public.external_media enable row level security;
alter table public.watch_platform enable row level security;
alter table public.watch_item enable row level security;
alter table public.watch_rating enable row level security;

create policy lecture_connectee on public.external_media
  for select to authenticated
  using (true);

create policy membres_du_foyer on public.watch_platform
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.watch_item
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

-- Une note se lit à deux mais ne s'écrit que pour soi.
create policy membres_lisent on public.watch_rating
  for select to authenticated
  using (private.is_member(household_id));
create policy chacun_sa_note on public.watch_rating
  for insert to authenticated
  with check (private.is_member(household_id) and user_id = (select auth.uid()));
create policy chacun_modifie_sa_note on public.watch_rating
  for update to authenticated
  using (private.is_member(household_id) and user_id = (select auth.uid()))
  with check (private.is_member(household_id) and user_id = (select auth.uid()));

revoke all on public.external_media, public.watch_platform, public.watch_item, public.watch_rating
  from public, anon, authenticated;
grant select on public.external_media to authenticated;
grant select, insert, update on public.watch_platform, public.watch_item, public.watch_rating to authenticated;
grant all on public.external_media, public.watch_platform, public.watch_item, public.watch_rating to service_role;

revoke execute on function private.stamp_watched(), private.touch_media() from public, anon;

-- -----------------------------------------------------------------------------
-- Realtime (le cache global n'est pas publié : il ne change que par la fonction serveur)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found, skipping';
    return;
  end if;
  foreach t in array array['watch_platform', 'watch_item', 'watch_rating'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
