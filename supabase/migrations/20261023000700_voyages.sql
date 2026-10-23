-- =============================================================================
-- OhO · Lot 6 · Voyages
-- trip, trip_activity, booking, trip_budget_line, attachment ; checklist.trip_id ;
-- bucket privé « attachments ».
-- Source : docs/cadrage/modele-donnees.html (onglet V), DECISIONS P3, M8–M11.
-- =============================================================================

create type public.trip_status as enum ('idea', 'planned', 'ongoing', 'done');
create type public.booking_kind as enum ('flight', 'train', 'lodging', 'car', 'activity', 'other');
-- Partagé avec les dépenses (lot 13).
create type public.expense_category as enum ('transport', 'lodging', 'food', 'activity', 'shopping', 'other');

-- Cast sans erreur, pour lire un identifiant dans un chemin de fichier.
create or replace function private.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- trip
-- -----------------------------------------------------------------------------
create table public.trip (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  destination text check (char_length(destination) <= 120),
  start_date date,
  end_date date,
  status public.trip_status not null default 'idea',
  cover_emoji text check (char_length(cover_emoji) <= 16),
  notes text check (char_length(notes) <= 4000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint trip_household_id_id_key unique (household_id, id),
  constraint trip_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

create index trip_household_id_updated_at_idx on public.trip (household_id, updated_at);
create index trip_household_id_start_date_idx on public.trip (household_id, start_date);
create index trip_created_by_idx on public.trip (created_by);
create index trip_updated_by_idx on public.trip (updated_by);

-- -----------------------------------------------------------------------------
-- checklist.trip_id : la checklist connaît son voyage, pas l'inverse (M8).
-- -----------------------------------------------------------------------------
alter table public.checklist
  add column trip_id uuid,
  add constraint checklist_trip_fkey foreign key (household_id, trip_id)
    references public.trip (household_id, id) on delete cascade,
  add constraint checklist_trip_kind_check check (trip_id is null or kind = 'trip_prep');

create unique index checklist_trip_id_key on public.checklist (trip_id)
  where trip_id is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- trip_activity : idées et choses à faire sur place.
-- -----------------------------------------------------------------------------
create table public.trip_activity (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  trip_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  url text check (url ~ '^https?://'),
  note text check (char_length(note) <= 2000),
  done boolean not null default false,
  planned_date date,
  sort_order double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  foreign key (household_id, trip_id) references public.trip (household_id, id) on delete cascade
);

create index trip_activity_trip_idx on public.trip_activity (household_id, trip_id, sort_order);
create index trip_activity_household_id_updated_at_idx on public.trip_activity (household_id, updated_at);
create index trip_activity_created_by_idx on public.trip_activity (created_by);
create index trip_activity_updated_by_idx on public.trip_activity (updated_by);

-- -----------------------------------------------------------------------------
-- booking : réservations (vols, logements…).
-- -----------------------------------------------------------------------------
create table public.booking (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  trip_id uuid not null,
  kind public.booking_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  starts_at timestamptz,
  ends_at timestamptz,
  tz text check (tz is null or private.is_valid_timezone(tz)),
  reference text check (char_length(reference) <= 60),
  url text check (url ~ '^https?://'),
  note text check (char_length(note) <= 2000),
  amount numeric(12, 2) check (amount >= 0),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint booking_household_id_id_key unique (household_id, id),
  constraint booking_times_check check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint booking_amount_currency_check check (amount is null or currency is not null),
  foreign key (household_id, trip_id) references public.trip (household_id, id) on delete cascade
);

create index booking_trip_id_starts_at_idx on public.booking (trip_id, starts_at);
create index booking_household_id_trip_id_idx on public.booking (household_id, trip_id);
create index booking_household_id_updated_at_idx on public.booking (household_id, updated_at);
create index booking_created_by_idx on public.booking (created_by);
create index booking_updated_by_idx on public.booking (updated_by);

-- -----------------------------------------------------------------------------
-- trip_budget_line : budget prévu par poste (P3, M11). Le dépensé vient du carnet lié (lot 13).
-- -----------------------------------------------------------------------------
create table public.trip_budget_line (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  trip_id uuid not null,
  category public.expense_category not null,
  planned_amount numeric(12, 2) check (planned_amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  sort_order double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  foreign key (household_id, trip_id) references public.trip (household_id, id) on delete cascade
);

create unique index trip_budget_line_trip_id_category_key
  on public.trip_budget_line (trip_id, category) where deleted_at is null;
create index trip_budget_line_household_id_trip_id_idx on public.trip_budget_line (household_id, trip_id);
create index trip_budget_line_household_id_updated_at_idx on public.trip_budget_line (household_id, updated_at);
create index trip_budget_line_created_by_idx on public.trip_budget_line (created_by);
create index trip_budget_line_updated_by_idx on public.trip_budget_line (updated_by);

-- -----------------------------------------------------------------------------
-- attachment : pièces jointes génériques, fichier dans le bucket privé « attachments ».
-- Aucune URL stockée : le client demande une URL signée de 60 s à l'ouverture.
-- -----------------------------------------------------------------------------
create table public.attachment (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  entity_type text not null check (entity_type ~ '^[a-z_]+$'),
  entity_id uuid not null,
  storage_path text not null,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 200),
  mime_type text not null check (char_length(mime_type) <= 120),
  size_bytes integer not null check (size_bytes between 0 and 20 * 1024 * 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  -- {household_id}/{entity_type}/{entity_id}/{id} : la policy de storage lit le premier segment.
  constraint attachment_path_check check (
    storage_path = household_id::text || '/' || entity_type || '/' || entity_id::text || '/' || id::text
  )
);

create unique index attachment_storage_path_key on public.attachment (storage_path);
create index attachment_entity_idx on public.attachment (household_id, entity_type, entity_id);
create index attachment_household_id_updated_at_idx on public.attachment (household_id, updated_at);
create index attachment_created_by_idx on public.attachment (created_by);
create index attachment_updated_by_idx on public.attachment (updated_by);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- attachment_cascade : supprimer une réservation (ou un voyage) marque ses pièces jointes.
create or replace function private.attachment_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is not null or new.deleted_at is null then
    return null;
  end if;
  if tg_table_name = 'booking' then
    update public.attachment a set deleted_at = new.deleted_at
     where a.household_id = new.household_id and a.entity_type = 'booking'
       and a.entity_id = new.id and a.deleted_at is null;
  elsif tg_table_name = 'trip' then
    update public.attachment a set deleted_at = new.deleted_at
     where a.household_id = new.household_id and a.entity_type = 'booking' and a.deleted_at is null
       and a.entity_id in (select b.id from public.booking b where b.trip_id = new.id);
  end if;
  return null;
end;
$$;

create trigger touch_row before insert or update on public.trip
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.trip_activity
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.booking
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.trip_budget_line
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.attachment
  for each row execute function private.touch_row();

create trigger attachment_cascade after update of deleted_at on public.booking
  for each row execute function private.attachment_cascade();
create trigger attachment_cascade after update of deleted_at on public.trip
  for each row execute function private.attachment_cascade();

create trigger log_activity after insert or update or delete on public.trip
  for each row execute function private.log_activity('trips');
create trigger log_activity after insert or update or delete on public.trip_activity
  for each row execute function private.log_activity('trips');
create trigger log_activity after insert or update or delete on public.booking
  for each row execute function private.log_activity('trips');

-- -----------------------------------------------------------------------------
-- RLS, policies, privilèges
-- -----------------------------------------------------------------------------
alter table public.trip enable row level security;
alter table public.trip_activity enable row level security;
alter table public.booking enable row level security;
alter table public.trip_budget_line enable row level security;
alter table public.attachment enable row level security;

create policy membres_du_foyer on public.trip
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.trip_activity
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.booking
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.trip_budget_line
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.attachment
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

revoke all on public.trip, public.trip_activity, public.booking, public.trip_budget_line, public.attachment
  from public, anon, authenticated;
grant select, insert, update on public.trip, public.trip_activity, public.booking,
                               public.trip_budget_line, public.attachment
  to authenticated;
grant all on public.trip, public.trip_activity, public.booking, public.trip_budget_line, public.attachment
  to service_role;

revoke execute on function private.attachment_cascade(), private.try_uuid(text) from public, anon;
grant execute on function private.try_uuid(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage : bucket privé, accessible aux membres du foyer du premier segment du chemin.
-- Sans effet hors Supabase (le schéma storage n'existe pas dans les tests).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    raise notice 'storage schema not found, skipping attachments bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('attachments', 'attachments', false, 20 * 1024 * 1024)
  on conflict (id) do nothing;

  execute $p$
    create policy attachments_membres_du_foyer on storage.objects
      for all to authenticated
      using (bucket_id = 'attachments'
             and private.is_member(private.try_uuid(split_part(name, '/', 1))))
      with check (bucket_id = 'attachments'
                  and private.is_member(private.try_uuid(split_part(name, '/', 1))))
  $p$;
end $$;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found, skipping';
    return;
  end if;
  foreach t in array array['trip', 'trip_activity', 'booking', 'trip_budget_line', 'attachment'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
