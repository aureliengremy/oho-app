-- =============================================================================
-- OhO · Lot 13 · Dépenses partagées (façon Tricount)
-- expense_book, expense, expense_share, settlement ; vues expense_balance et
-- trip_budget_view ; RPC save_expense.
-- Source : docs/cadrage/modele-donnees.html (onglet VII), DECISIONS M14–M22, D4, D5.
-- Montants en centièmes de la devise (bigint), jamais en flottant.
-- =============================================================================

create type public.expense_split_mode as enum ('equal', 'amounts', 'weights');

-- -----------------------------------------------------------------------------
-- expense_book : un carnet de comptes, sa devise, un voyage en option (M18, M20).
-- -----------------------------------------------------------------------------
create table public.expense_book (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  currency char(3) not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  trip_id uuid,
  sort_order double precision not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint expense_book_household_id_id_key unique (household_id, id),
  -- L'argent survit au voyage : supprimer le voyage détache le carnet.
  constraint expense_book_trip_fkey foreign key (household_id, trip_id)
    references public.trip (household_id, id) on delete set null (trip_id)
);

create unique index expense_book_trip_id_key on public.expense_book (trip_id)
  where trip_id is not null and deleted_at is null;
create index expense_book_household_id_updated_at_idx on public.expense_book (household_id, updated_at);
create index expense_book_household_trip_idx on public.expense_book (household_id, trip_id);
create index expense_book_created_by_idx on public.expense_book (created_by);
create index expense_book_updated_by_idx on public.expense_book (updated_by);

-- -----------------------------------------------------------------------------
-- expense : qui a payé quoi, au taux figé à la saisie (M15, M17).
-- -----------------------------------------------------------------------------
create table public.expense (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  book_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  paid_by uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(18, 8) not null default 1 check (fx_rate > 0),
  book_amount_cents bigint generated always as (round(amount_cents * fx_rate)::bigint) stored,
  spent_on date not null default current_date,
  category public.expense_category not null default 'other',
  split_mode public.expense_split_mode not null default 'equal',
  note text check (char_length(note) <= 2000),
  booking_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  constraint expense_household_id_id_key unique (household_id, id),
  foreign key (household_id, book_id) references public.expense_book (household_id, id) on delete cascade,
  -- On ne retire pas un membre qui figure dans des comptes.
  constraint expense_paid_by_fkey foreign key (household_id, paid_by)
    references public.membership (household_id, user_id) on delete restrict,
  constraint expense_booking_fkey foreign key (household_id, booking_id)
    references public.booking (household_id, id) on delete set null (booking_id)
);

create index expense_book_id_spent_on_idx on public.expense (book_id, spent_on desc) where deleted_at is null;
create unique index expense_booking_id_key on public.expense (booking_id) where booking_id is not null and deleted_at is null;
create index expense_household_id_updated_at_idx on public.expense (household_id, updated_at);
create index expense_household_book_idx on public.expense (household_id, book_id);
create index expense_household_paid_by_idx on public.expense (household_id, paid_by);
create index expense_household_booking_idx on public.expense (household_id, booking_id);
create index expense_created_by_idx on public.expense (created_by);
create index expense_updated_by_idx on public.expense (updated_by);

-- -----------------------------------------------------------------------------
-- expense_share : la part de chacun, en devise du carnet ; la somme fait foi.
-- -----------------------------------------------------------------------------
create table public.expense_share (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  expense_id uuid not null,
  user_id uuid not null,
  weight numeric(6, 2) check (weight > 0),
  share_cents bigint not null check (share_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  foreign key (household_id, expense_id) references public.expense (household_id, id) on delete cascade,
  constraint expense_share_user_fkey foreign key (household_id, user_id)
    references public.membership (household_id, user_id) on delete restrict
);

create unique index expense_share_expense_user_key on public.expense_share (expense_id, user_id) where deleted_at is null;
create index expense_share_household_user_idx on public.expense_share (household_id, user_id);
create index expense_share_household_expense_idx on public.expense_share (household_id, expense_id);
create index expense_share_household_id_updated_at_idx on public.expense_share (household_id, updated_at);
create index expense_share_created_by_idx on public.expense_share (created_by);
create index expense_share_updated_by_idx on public.expense_share (updated_by);

-- -----------------------------------------------------------------------------
-- settlement : un remboursement, marqué fait (M21) ; le virement se fait hors de l'app.
-- -----------------------------------------------------------------------------
create table public.settlement (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  book_id uuid not null,
  from_user uuid not null,
  to_user uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  settled_on date not null default current_date,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  deleted_at timestamptz,
  foreign key (household_id, book_id) references public.expense_book (household_id, id) on delete cascade,
  constraint settlement_from_fkey foreign key (household_id, from_user)
    references public.membership (household_id, user_id) on delete restrict,
  constraint settlement_to_fkey foreign key (household_id, to_user)
    references public.membership (household_id, user_id) on delete restrict,
  constraint settlement_distinct_check check (from_user <> to_user)
);

create index settlement_household_book_idx on public.settlement (household_id, book_id);
create index settlement_household_from_idx on public.settlement (household_id, from_user);
create index settlement_household_to_idx on public.settlement (household_id, to_user);
create index settlement_household_id_updated_at_idx on public.settlement (household_id, updated_at);
create index settlement_created_by_idx on public.settlement (created_by);
create index settlement_updated_by_idx on public.settlement (updated_by);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Même devise que le carnet : le taux vaut 1, quoi qu'envoie le client.
create or replace function private.expense_same_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency = (select b.currency from public.expense_book b where b.id = new.book_id) then
    new.fx_rate := 1;
  end if;
  return new;
end;
$$;

-- À la validation : les parts vivantes d'une dépense vivante totalisent son montant converti.
create or replace function private.check_shares_sum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense uuid := case when tg_table_name = 'expense' then new.id else (to_jsonb(new) ->> 'expense_id')::uuid end;
  v_total bigint;
  v_sum bigint;
begin
  select e.book_amount_cents into v_total
  from public.expense e
  where e.id = v_expense and e.deleted_at is null;
  if v_total is null then
    return null; -- dépense supprimée : plus rien à vérifier
  end if;
  select coalesce(sum(s.share_cents), 0) into v_sum
  from public.expense_share s
  where s.expense_id = v_expense and s.deleted_at is null;
  if v_sum <> v_total then
    raise exception 'les parts (% centièmes) ne totalisent pas la dépense (% centièmes)', v_sum, v_total
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create trigger touch_row before insert or update on public.expense_book
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.expense
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.expense_share
  for each row execute function private.touch_row();
create trigger touch_row before insert or update on public.settlement
  for each row execute function private.touch_row();

create trigger expense_same_currency before insert or update of currency, fx_rate, book_id on public.expense
  for each row execute function private.expense_same_currency();

create constraint trigger check_shares_sum after insert or update on public.expense
  deferrable initially deferred
  for each row execute function private.check_shares_sum();
create constraint trigger check_shares_sum after insert or update on public.expense_share
  deferrable initially deferred
  for each row execute function private.check_shares_sum();

create trigger log_activity after insert or update or delete on public.expense_book
  for each row execute function private.log_activity('expenses');
create trigger log_activity after insert or update or delete on public.expense
  for each row execute function private.log_activity('expenses');
create trigger log_activity after insert or update or delete on public.settlement
  for each row execute function private.log_activity('expenses');

-- -----------------------------------------------------------------------------
-- save_expense : une dépense et ses parts, d'un bloc, en une transaction (M19).
-- p_expense : les colonnes de la dépense (id compris, généré par le client).
-- p_shares  : [{ user_id, share_cents, weight }], calculées par le client (plus fort reste, M16).
-- -----------------------------------------------------------------------------
create or replace function public.save_expense(p_expense jsonb, p_shares jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce((p_expense ->> 'id')::uuid, private.uuid_generate_v7());
  v_hh uuid := (p_expense ->> 'household_id')::uuid;
  v_share jsonb;
begin
  if jsonb_typeof(p_shares) is distinct from 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'une dépense se partage entre au moins une personne' using errcode = '22023';
  end if;

  insert into public.expense as e
    (id, household_id, book_id, label, paid_by, amount_cents, currency, fx_rate,
     spent_on, category, split_mode, note, booking_id)
  values
    (v_id, v_hh, (p_expense ->> 'book_id')::uuid, p_expense ->> 'label', (p_expense ->> 'paid_by')::uuid,
     (p_expense ->> 'amount_cents')::bigint, p_expense ->> 'currency',
     coalesce((p_expense ->> 'fx_rate')::numeric, 1),
     coalesce((p_expense ->> 'spent_on')::date, current_date),
     coalesce((p_expense ->> 'category')::public.expense_category, 'other'),
     coalesce((p_expense ->> 'split_mode')::public.expense_split_mode, 'equal'),
     p_expense ->> 'note', (p_expense ->> 'booking_id')::uuid)
  on conflict (id) do update set
    label = excluded.label,
    paid_by = excluded.paid_by,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    fx_rate = excluded.fx_rate,
    spent_on = excluded.spent_on,
    category = excluded.category,
    split_mode = excluded.split_mode,
    note = excluded.note,
    booking_id = excluded.booking_id
  where e.household_id = v_hh and e.deleted_at is null;

  if not found then
    raise exception 'dépense introuvable' using errcode = 'P0002';
  end if;

  -- Les anciennes parts deviennent des pierres tombales, les nouvelles les remplacent.
  update public.expense_share s set deleted_at = now()
  where s.expense_id = v_id and s.deleted_at is null;

  for v_share in select * from jsonb_array_elements(p_shares) loop
    insert into public.expense_share (household_id, expense_id, user_id, share_cents, weight)
    values (v_hh, v_id, (v_share ->> 'user_id')::uuid, (v_share ->> 'share_cents')::bigint,
            (v_share ->> 'weight')::numeric);
  end loop;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vues (security_invoker : la RLS des tables lues s'applique)
-- -----------------------------------------------------------------------------

-- Solde par membre et par carnet : payé − dû + remboursé − reçu ; positif = on lui doit.
create view public.expense_balance with (security_invoker = true) as
with flux as (
  select e.household_id, e.book_id, e.paid_by as user_id, e.book_amount_cents as cents
  from public.expense e where e.deleted_at is null
  union all
  select e.household_id, e.book_id, s.user_id, -s.share_cents
  from public.expense_share s join public.expense e on e.id = s.expense_id
  where e.deleted_at is null and s.deleted_at is null
  union all
  select t.household_id, t.book_id, t.from_user, t.amount_cents
  from public.settlement t where t.deleted_at is null
  union all
  select t.household_id, t.book_id, t.to_user, -t.amount_cents
  from public.settlement t where t.deleted_at is null
)
select f.household_id, f.book_id, f.user_id, sum(f.cents)::bigint as balance_cents
from flux f
join public.expense_book b on b.id = f.book_id and b.deleted_at is null
group by f.household_id, f.book_id, f.user_id;

-- Dépensé par poste pour un voyage (M11), dans la devise du carnet lié.
create view public.trip_budget_view with (security_invoker = true) as
select b.household_id, b.trip_id, b.id as book_id, b.currency, e.category,
       sum(e.book_amount_cents)::bigint as spent_cents
from public.expense_book b
join public.expense e on e.book_id = b.id and e.deleted_at is null
where b.trip_id is not null and b.deleted_at is null
group by b.household_id, b.trip_id, b.id, b.currency, e.category;

-- -----------------------------------------------------------------------------
-- RLS, policies, privilèges
-- -----------------------------------------------------------------------------
alter table public.expense_book enable row level security;
alter table public.expense enable row level security;
alter table public.expense_share enable row level security;
alter table public.settlement enable row level security;

create policy membres_du_foyer on public.expense_book
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.expense
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.expense_share
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

create policy membres_du_foyer on public.settlement
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

revoke all on public.expense_book, public.expense, public.expense_share, public.settlement
  from public, anon, authenticated;
grant select, insert, update on public.expense_book, public.expense, public.expense_share, public.settlement
  to authenticated;
grant all on public.expense_book, public.expense, public.expense_share, public.settlement to service_role;

revoke all on public.expense_balance, public.trip_budget_view from public, anon, authenticated;
grant select on public.expense_balance, public.trip_budget_view to authenticated, service_role;

revoke execute on function public.save_expense(jsonb, jsonb) from public, anon;
grant execute on function public.save_expense(jsonb, jsonb) to authenticated, service_role;
revoke execute on function private.expense_same_currency(), private.check_shares_sum() from public, anon;

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
  foreach t in array array['expense_book', 'expense', 'expense_share', 'settlement'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
