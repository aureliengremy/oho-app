-- =============================================================================
-- OhO · Lot 2 · Courses et checklists
-- shopping_category, catalog_item, checklist, checklist_item
-- Source : docs/cadrage/modele-donnees.html (onglet IV), DECISIONS M6–M7.
-- checklist.trip_id est ajoutée par la migration Voyages (lot 6).
-- =============================================================================

create type public.checklist_kind as enum ('shopping', 'trip_prep', 'generic');

-- -----------------------------------------------------------------------------
-- shopping_category : les rayons, ordre global au foyer (M6).
-- -----------------------------------------------------------------------------
create table public.shopping_category (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  emoji text,
  sort_order double precision not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint shopping_category_household_id_id_key unique (household_id, id)
);

create unique index shopping_category_household_id_name_key
  on public.shopping_category (household_id, lower(name)) where deleted_at is null;
create index shopping_category_household_id_updated_at_idx on public.shopping_category (household_id, updated_at);
create index shopping_category_created_by_idx on public.shopping_category (created_by);
create index shopping_category_updated_by_idx on public.shopping_category (updated_by);

-- -----------------------------------------------------------------------------
-- catalog_item : le catalogue qui apprend. Clé lower + btrim, sans unaccent (M7).
-- -----------------------------------------------------------------------------
create table public.catalog_item (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  label_key text not null generated always as (lower(btrim(label))) stored,
  default_category_id uuid,
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint catalog_item_household_id_id_key unique (household_id, id),
  foreign key (household_id, default_category_id)
    references public.shopping_category (household_id, id)
    on delete set null (default_category_id)
);

create unique index catalog_item_household_id_label_key_key
  on public.catalog_item (household_id, label_key) where deleted_at is null;
create index catalog_item_household_id_updated_at_idx on public.catalog_item (household_id, updated_at);
create index catalog_item_default_category_idx on public.catalog_item (household_id, default_category_id);
create index catalog_item_created_by_idx on public.catalog_item (created_by);
create index catalog_item_updated_by_idx on public.catalog_item (updated_by);

-- -----------------------------------------------------------------------------
-- checklist : une liste (courses, valise, générique).
-- -----------------------------------------------------------------------------
create table public.checklist (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  kind public.checklist_kind not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_default boolean not null default false,
  sort_order double precision not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint checklist_household_id_id_key unique (household_id, id)
);

create unique index checklist_household_id_kind_default_key
  on public.checklist (household_id, kind) where is_default and deleted_at is null;
create index checklist_household_id_updated_at_idx on public.checklist (household_id, updated_at);
create index checklist_created_by_idx on public.checklist (created_by);
create index checklist_updated_by_idx on public.checklist (updated_by);

-- -----------------------------------------------------------------------------
-- checklist_item : les items. FK composites : impossible de viser la liste,
-- le rayon ou l'article de catalogue d'un autre foyer.
-- -----------------------------------------------------------------------------
create table public.checklist_item (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  checklist_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  quantity text,
  note text,
  category_id uuid,
  catalog_item_id uuid,
  checked boolean not null default false,
  checked_by uuid references public.profile (id) on delete set null,
  checked_at timestamptz,
  sort_order double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint checklist_item_checked_at_check check (checked = (checked_at is not null)),
  foreign key (household_id, checklist_id)
    references public.checklist (household_id, id)
    on delete cascade,
  foreign key (household_id, category_id)
    references public.shopping_category (household_id, id)
    on delete set null (category_id),
  foreign key (household_id, catalog_item_id)
    references public.catalog_item (household_id, id)
    on delete set null (catalog_item_id)
);

create index checklist_item_list_idx
  on public.checklist_item (checklist_id, checked, sort_order) where deleted_at is null;
create index checklist_item_household_id_checklist_id_idx on public.checklist_item (household_id, checklist_id);
create index checklist_item_household_id_updated_at_idx on public.checklist_item (household_id, updated_at);
create index checklist_item_category_idx on public.checklist_item (household_id, category_id);
create index checklist_item_catalog_item_idx on public.checklist_item (household_id, catalog_item_id);
create index checklist_item_checked_by_idx on public.checklist_item (checked_by);
create index checklist_item_created_by_idx on public.checklist_item (created_by);
create index checklist_item_updated_by_idx on public.checklist_item (updated_by);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Clé d'outil d'une checklist ou d'un de ses items, pour le journal.
create or replace function private.checklist_tool_key(r jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case coalesce(
      (r ->> 'kind')::public.checklist_kind,
      (select c.kind from public.checklist c where c.id = (r ->> 'checklist_id')::uuid))
    when 'trip_prep' then 'trips'
    else 'shopping'
  end
$$;

-- catalog_learn : à l'ajout d'un item dans une liste de courses, upsert du
-- catalogue, renseigne catalog_item_id et propose le rayon appris.
-- security invoker : la RLS du catalogue s'applique à l'auteur de l'item.
create or replace function private.catalog_learn()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind public.checklist_kind;
  v_default_category uuid;
begin
  select c.kind into v_kind
  from public.checklist c
  where c.id = new.checklist_id and c.household_id = new.household_id;

  if v_kind is distinct from 'shopping' then
    return new;
  end if;

  insert into public.catalog_item (household_id, label, default_category_id, usage_count, last_used_at)
  values (new.household_id, btrim(new.label), new.category_id, 1, now())
  on conflict (household_id, label_key) where deleted_at is null do update
    set usage_count = public.catalog_item.usage_count + 1,
        last_used_at = now(),
        default_category_id = coalesce(excluded.default_category_id,
                                       public.catalog_item.default_category_id)
  returning id, default_category_id into new.catalog_item_id, v_default_category;

  new.category_id := coalesce(new.category_id, v_default_category);
  return new;
end;
$$;

-- stamp_checked : pose ou vide checked_by / checked_at (heure serveur).
create or replace function private.stamp_checked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.checked is not distinct from old.checked then
    new.checked_by := old.checked_by;
    new.checked_at := old.checked_at;
  elsif new.checked then
    new.checked_by := coalesce(auth.uid(), new.checked_by,
                               case when tg_op = 'INSERT' then new.created_by end);
    new.checked_at := now();
  else
    new.checked_by := null;
    new.checked_at := null;
  end if;
  return new;
end;
$$;

create trigger touch_row before insert or update on public.shopping_category
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.catalog_item
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.checklist
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.checklist_item
  for each row execute function private.touch_row();

-- Les BEFORE triggers s'enchaînent par ordre alphabétique :
-- catalog_learn, stamp_checked, touch_row.
create trigger catalog_learn before insert on public.checklist_item
  for each row execute function private.catalog_learn();
create trigger stamp_checked before insert or update of checked on public.checklist_item
  for each row execute function private.stamp_checked();

-- Journal. catalog_item n'est pas journalisé : il est tenu par catalog_learn.
create trigger log_activity after insert or update or delete on public.shopping_category
  for each row execute function private.log_activity('shopping');
create trigger log_activity after insert or update or delete on public.checklist
  for each row execute function private.log_activity('shopping', 'private.checklist_tool_key');
create trigger log_activity after insert or update or delete on public.checklist_item
  for each row execute function private.log_activity('shopping', 'private.checklist_tool_key');

-- -----------------------------------------------------------------------------
-- RLS, policies, privilèges
-- -----------------------------------------------------------------------------
alter table public.shopping_category enable row level security;
alter table public.catalog_item enable row level security;
alter table public.checklist enable row level security;
alter table public.checklist_item enable row level security;

create policy membres_du_foyer on public.shopping_category
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.catalog_item
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.checklist
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.checklist_item
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

revoke all on public.shopping_category, public.catalog_item, public.checklist, public.checklist_item
  from public, anon, authenticated;
grant select, insert, update on public.shopping_category, public.catalog_item,
                               public.checklist, public.checklist_item
  to authenticated;
grant all on public.shopping_category, public.catalog_item, public.checklist, public.checklist_item
  to service_role;

revoke execute on function private.checklist_tool_key(jsonb), private.catalog_learn(), private.stamp_checked()
  from public, anon;

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
  foreach t in array array['shopping_category', 'catalog_item', 'checklist', 'checklist_item'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
