-- =============================================================================
-- OhO · Lot 2 · Socle
-- profile, household, membership, tool_activation, activity_log
-- Source : docs/cadrage/modele-donnees.html (onglets II et III), DECISIONS M1–M5.
-- =============================================================================

-- Schéma privé : fonctions d'accès et triggers, jamais exposé par PostgREST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Types énumérés (listes fermées, M2)
-- -----------------------------------------------------------------------------
create type public.membership_role as enum ('owner', 'member');

-- -----------------------------------------------------------------------------
-- UUID v7 (M3) : Postgres < 18 n'a pas uuidv7(). Le client génère ses id pour
-- l'outbox ; ce défaut ne sert qu'aux insertions qui n'en fournissent pas.
-- 48 bits de millisecondes Unix, puis l'aléa de gen_random_uuid(), version 7.
-- -----------------------------------------------------------------------------
create or replace function private.uuid_generate_v7()
returns uuid
language sql
volatile
parallel safe
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid
$$;

-- -----------------------------------------------------------------------------
-- Fuseau IANA valide (household.timezone). Marquée immutable pour servir dans
-- un CHECK : la liste des fuseaux ne change qu'avec une mise à jour de Postgres.
-- -----------------------------------------------------------------------------
create or replace function private.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if tz is null or tz = '' then
    return false;
  end if;
  perform now() at time zone tz;
  return true;
exception when invalid_parameter_value then
  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- touch_row : BEFORE INSERT OR UPDATE sur toutes les tables à colonnes communes.
-- Insertion : created_by = auth.uid() quand un compte écrit (pas d'usurpation),
--             updated_at = heure serveur.
-- Mise à jour : updated_at = now(), updated_by = auth.uid() ; id, household_id,
--             created_at et created_by sont figés.
-- -----------------------------------------------------------------------------
create or replace function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_uid, new.created_by);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    new.updated_by := new.created_by;
    return new;
  end if;

  if new.id is distinct from old.id
     or (to_jsonb(new) ->> 'household_id') is distinct from (to_jsonb(old) ->> 'household_id') then
    raise exception 'id and household_id are immutable on %', tg_table_name
      using errcode = '42501';
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(v_uid, new.updated_by);
  return new;
end;
$$;

-- Variante pour profile (ni created_by ni updated_by).
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'id is immutable on %', tg_table_name using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profile : adossé à auth.users (même id). Pas de household_id.
-- -----------------------------------------------------------------------------
create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_color text check (avatar_color ~ '^#[0-9a-f]{6}$'),
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_row
  before update on public.profile
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- household : racine de toutes les données.
-- -----------------------------------------------------------------------------
create table public.household (
  id uuid primary key default private.uuid_generate_v7(),
  name text not null check (btrim(name) <> ''),
  timezone text not null check (private.is_valid_timezone(timezone)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz
);

create index household_updated_at_idx on public.household (updated_at);
create index household_created_by_idx on public.household (created_by);
create index household_updated_by_idx on public.household (updated_by);

create trigger touch_row
  before insert or update on public.household
  for each row execute function private.touch_row();

-- -----------------------------------------------------------------------------
-- membership : qui appartient à quel foyer.
-- L'unicité (household_id, user_id) est une contrainte pleine, pas un index
-- partiel : elle sert de cible aux FK composites (notification_pref, dépenses).
-- Un membre qui revient voit sa ligne restaurée (deleted_at = null).
-- -----------------------------------------------------------------------------
create table public.membership (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid not null references public.profile (id) on delete cascade,
  role public.membership_role not null default 'member',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint membership_household_id_user_id_key unique (household_id, user_id)
);

create index membership_user_id_idx on public.membership (user_id);
create index membership_household_id_updated_at_idx on public.membership (household_id, updated_at);
create index membership_created_by_idx on public.membership (created_by);
create index membership_updated_by_idx on public.membership (updated_by);

create trigger touch_row
  before insert or update on public.membership
  for each row execute function private.touch_row();

-- -----------------------------------------------------------------------------
-- La règle d'accès unique. security definer : lit membership sans repasser par
-- sa RLS (pas de récursion) ; (select auth.uid()) est évalué une fois.
-- Une adhésion en pierre tombale ne donne plus accès.
-- -----------------------------------------------------------------------------
create or replace function private.is_member(hh uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membership m
    where m.household_id = hh
      and m.user_id = (select auth.uid())
      and m.deleted_at is null
  );
$$;

create or replace function private.is_owner(hh uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membership m
    where m.household_id = hh
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.deleted_at is null
  );
$$;

-- Un profil est visible de son titulaire et des membres d'un foyer commun.
create or replace function private.shares_household(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membership me
    join public.membership other on other.household_id = me.household_id
    where me.user_id = (select auth.uid())
      and other.user_id = target
      and me.deleted_at is null
      and other.deleted_at is null
  );
$$;

-- -----------------------------------------------------------------------------
-- tool_activation : registre des outils du foyer.
-- -----------------------------------------------------------------------------
create table public.tool_activation (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  tool_key text not null check (tool_key ~ '^[a-z][a-z0-9_]{1,30}$'),
  enabled boolean not null default true,
  sort_order smallint not null default 0,
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz
);

create unique index tool_activation_household_id_tool_key_key
  on public.tool_activation (household_id, tool_key) where deleted_at is null;
create index tool_activation_household_id_updated_at_idx on public.tool_activation (household_id, updated_at);
create index tool_activation_created_by_idx on public.tool_activation (created_by);
create index tool_activation_updated_by_idx on public.tool_activation (updated_by);

create trigger touch_row
  before insert or update on public.tool_activation
  for each row execute function private.touch_row();

-- -----------------------------------------------------------------------------
-- activity_log : journal immuable, écrit seulement par log_activity.
-- -----------------------------------------------------------------------------
create table public.activity_log (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  actor_id uuid references public.profile (id) on delete set null,
  tool_key text not null check (tool_key ~ '^[a-z][a-z0-9_]{1,30}$'),
  action text not null check (action ~ '^[a-z_]+$'),
  entity_type text not null check (entity_type ~ '^[a-z_]+$'),
  entity_id uuid not null,
  entity_label text,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index activity_log_household_id_created_at_idx on public.activity_log (household_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_actor_id_idx on public.activity_log (actor_id);

-- Immuable pour tout le monde, service_role compris. DELETE reste possible
-- (cascades, purge du journal prévue au lot 11).
create or replace function private.forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is immutable', tg_table_name using errcode = '42501';
end;
$$;

create trigger forbid_update
  before update on public.activity_log
  for each row execute function private.forbid_update();

-- -----------------------------------------------------------------------------
-- log_activity : AFTER INSERT / UPDATE / DELETE sur les tables d'outils.
--   tg_argv[0] : tool_key par défaut ;
--   tg_argv[1] : facultatif, fonction private.xxx(jsonb) returns text qui
--                calcule tool_key depuis la ligne (ex. checklist de voyage).
-- Ignore une mise à jour qui ne touche que sort_order. Une suppression physique
-- (réservée à service_role) n'est journalisée que pour une ligne vivante, hors
-- purge et hors suppression du foyer entier.
-- -----------------------------------------------------------------------------
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_tool text := tg_argv[0];
  v_action text;
  v_payload jsonb := '{}';
  v_actor uuid;
  v_key text;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_actor := coalesce(auth.uid(), (v_new ->> 'created_by')::uuid);

  elsif tg_op = 'UPDATE' then
    -- Diff champ par champ, hors colonnes techniques.
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'updated_by')
         and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_payload := v_payload || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
      end if;
    end loop;

    if v_payload = '{}' or (select array_agg(k) from jsonb_object_keys(v_payload) k) = array['sort_order'] then
      return null;
    end if;

    v_action := case
      when v_payload ? 'deleted_at' and v_new ->> 'deleted_at' is not null then 'deleted'
      when v_payload ? 'deleted_at' then 'restored'
      when v_payload ? 'archived_at' and v_new ->> 'archived_at' is not null then 'archived'
      when v_payload ? 'archived_at' then 'unarchived'
      when v_payload ? 'checked' and (v_new ->> 'checked')::boolean then 'checked'
      when v_payload ? 'checked' then 'unchecked'
      else 'updated'
    end;
    v_actor := coalesce(auth.uid(), (v_new ->> 'updated_by')::uuid);

  else -- DELETE
    if v_old ->> 'deleted_at' is not null
       or current_setting('oho.purging', true) = 'on'
       or not exists (select 1 from public.household h where h.id = (v_old ->> 'household_id')::uuid) then
      return null;
    end if;
    v_action := 'deleted';
    v_actor := auth.uid();
  end if;

  if tg_nargs > 1 then
    execute format('select %s($1)', tg_argv[1]) using v_row into v_tool;
  end if;

  insert into public.activity_log
    (household_id, actor_id, tool_key, action, entity_type, entity_id, entity_label, payload)
  values (
    (v_row ->> 'household_id')::uuid,
    v_actor,
    coalesce(v_tool, tg_argv[0]),
    v_action,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    coalesce(v_row ->> 'label', v_row ->> 'name', v_row ->> 'title'),
    v_payload
  );
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- handle_new_user : un compte Supabase crée son profil.
-- display_name / avatar_color peuvent venir de raw_user_meta_data.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Membre'));
  v_color text := new.raw_user_meta_data ->> 'avatar_color';
begin
  insert into public.profile (id, display_name, avatar_color)
  values (
    new.id,
    left(v_name, 40),
    case when v_color ~ '^#[0-9a-f]{6}$' then v_color end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- create_household : créer un foyer et en devenir propriétaire en une fois
-- (un INSERT direct échouerait : on n'est pas encore membre).
-- -----------------------------------------------------------------------------
create or replace function public.create_household(p_name text, p_timezone text default 'America/Toronto')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.household (name, timezone, created_by)
  values (p_name, p_timezone, v_uid)
  returning id into v_id;

  insert into public.membership (household_id, user_id, role, created_by)
  values (v_id, v_uid, 'owner', v_uid);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Purge des pierres tombales (M1) : supprime pour de bon les lignes mortes
-- depuis p_older_than dans toute table public qui porte deleted_at. Les FK en
-- cascade font le ménage des enfants. Planifiée par pg_cron (migration 0300).
-- -----------------------------------------------------------------------------
create or replace function private.purge_tombstones(p_older_than interval default interval '30 days')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_count bigint;
  v_total bigint := 0;
begin
  -- Les cascades de la purge n'écrivent pas au journal (voir log_activity).
  perform set_config('oho.purging', 'on', true);
  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'deleted_at'
      and t.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    execute format(
      'delete from public.%I where deleted_at is not null and deleted_at < now() - $1',
      v_table)
    using p_older_than;
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
  end loop;
  perform set_config('oho.purging', 'off', true);
  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS et policies
-- -----------------------------------------------------------------------------
alter table public.profile enable row level security;
alter table public.household enable row level security;
alter table public.membership enable row level security;
alter table public.tool_activation enable row level security;
alter table public.activity_log enable row level security;

create policy profil_visible on public.profile
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_household(id));

create policy profil_modifiable_par_soi on public.profile
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Insertion par create_household() seulement.
create policy membres_du_foyer on public.household
  for select to authenticated
  using (private.is_member(id));

create policy membres_du_foyer_modif on public.household
  for update to authenticated
  using (private.is_member(id))
  with check (private.is_member(id));

-- Les membres voient les adhésions ; seuls les propriétaires les gèrent.
create policy membres_du_foyer on public.membership
  for select to authenticated
  using (private.is_member(household_id));

create policy proprietaires_ajout on public.membership
  for insert to authenticated
  with check (private.is_owner(household_id));

create policy proprietaires_modif on public.membership
  for update to authenticated
  using (private.is_owner(household_id))
  with check (private.is_owner(household_id));

create policy membres_du_foyer on public.tool_activation
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

-- Journal : lecture seule.
create policy membres_du_foyer on public.activity_log
  for select to authenticated
  using (private.is_member(household_id));

-- -----------------------------------------------------------------------------
-- Privilèges. Pas de DELETE pour authenticated : la suppression est un UPDATE
-- de deleted_at (M1), la suppression physique est réservée à la purge.
-- -----------------------------------------------------------------------------
revoke all on public.profile, public.household, public.membership,
              public.tool_activation, public.activity_log
  from public, anon, authenticated;

grant select, update on public.profile to authenticated;
grant select, update on public.household to authenticated;
grant select, insert, update on public.membership to authenticated;
grant select, insert, update on public.tool_activation to authenticated;
grant select on public.activity_log to authenticated;

grant all on public.profile, public.household, public.membership,
             public.tool_activation, public.activity_log
  to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.uuid_generate_v7(),
  private.is_valid_timezone(text),
  private.is_member(uuid),
  private.is_owner(uuid),
  private.shares_household(uuid)
  to authenticated, service_role;
grant execute on function private.purge_tombstones(interval) to service_role;

revoke execute on function public.create_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Realtime (sans effet si la publication n'existe pas)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found, skipping';
    return;
  end if;
  foreach t in array array['household', 'membership', 'tool_activation', 'activity_log'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
