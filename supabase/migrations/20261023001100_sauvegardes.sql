-- =============================================================================
-- OhO · Lot 11 · Sauvegardes, export, journal d'erreurs
-- export_household : tout l'espace en un JSON (bouton de l'app et sauvegarde
-- hebdomadaire). import_household : restaure un export à l'identique (upsert par
-- id, horodatages compris, triggers coupés le temps de l'écriture). client_error : journal léger des erreurs de l'app.
-- Bucket privé « backups » : les sauvegardes hebdomadaires (S16), en lecture
-- pour les membres, écrites par la fonction « backup ».
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Les tables de l'espace, dans l'ordre des clés étrangères (parents d'abord).
-- external_media (cache global, pour lire l'export) et activity_log (immuable)
-- sont exportés à part et ne sont jamais réimportés.
-- -----------------------------------------------------------------------------
create or replace function private.backup_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'tool_activation', 'shopping_category', 'catalog_item', 'trip', 'checklist', 'checklist_item',
    'trip_activity', 'booking', 'trip_budget_line', 'attachment',
    'watch_platform', 'watch_item', 'watch_rating',
    'expense_book', 'expense', 'expense_share', 'settlement',
    'notification_pref'
  ]
$$;

-- Appel du service (Edge Function avec la clé service) : pas de compte, rôle service_role.
create or replace function private.is_service()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;

-- -----------------------------------------------------------------------------
-- export_household : un membre (ou le service) exporte tout son espace.
-- -----------------------------------------------------------------------------
create or replace function public.export_household(p_household uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tables jsonb := '{}';
  v_rows jsonb;
  v_table text;
begin
  if not (private.is_member(p_household) or private.is_service()) then
    raise exception 'espace introuvable' using errcode = '42501';
  end if;

  foreach v_table in array private.backup_tables() || array['activity_log'] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), ''[]'') from public.%I x where x.household_id = $1',
      v_table) using p_household into v_rows;
    v_tables := v_tables || jsonb_build_object(v_table, v_rows);
  end loop;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]') into v_rows
  from public.external_media m
  where m.id in (select w.media_id from public.watch_item w where w.household_id = p_household);
  v_tables := v_tables || jsonb_build_object('external_media', v_rows);

  return jsonb_build_object(
    'format', 'oho-export',
    'version', 1,
    'exported_at', now(),
    'household_id', p_household,
    'household', (select to_jsonb(h) from public.household h where h.id = p_household),
    -- Pour lire l'export à la main : qui est qui. Les comptes ne sont jamais réimportés.
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'display_name', p.display_name, 'initials', p.initials)
                                order by m.joined_at), '[]')
      from public.membership m join public.profile p on p.id = m.user_id
      where m.household_id = p_household and m.deleted_at is null
    ),
    'tables', v_tables
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- import_household : restaure un export de son propre espace.
-- Chaque ligne est réécrite telle qu'exportée (upsert par clé, horodatages et
-- pierres tombales compris). Une ligne créée après l'export reste en place.
-- Tout ou rien : la moindre ligne refusée annule la restauration.
-- -----------------------------------------------------------------------------
create or replace function public.import_household(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hh uuid := (p_data ->> 'household_id')::uuid;
  v_table text;
  v_rows jsonb;
  v_cols text;
  v_key text;
  v_count bigint;
  v_counts jsonb := '{}';
begin
  if p_data ->> 'format' is distinct from 'oho-export' or (p_data ->> 'version')::int is distinct from 1 then
    raise exception 'ce fichier n''est pas un export OhO' using errcode = '22023';
  end if;
  if v_hh is null or not private.is_member(v_hh) then
    raise exception 'cet export vient d''un autre espace' using errcode = '42501';
  end if;

  alter table public.household disable trigger user;
  update public.household h
     set name = coalesce(p_data -> 'household' ->> 'name', h.name),
         timezone = coalesce(p_data -> 'household' ->> 'timezone', h.timezone),
         updated_at = coalesce((p_data -> 'household' ->> 'updated_at')::timestamptz, h.updated_at),
         updated_by = (p_data -> 'household' ->> 'updated_by')::uuid
   where h.id = v_hh;
  alter table public.household enable trigger user;

  foreach v_table in array private.backup_tables() loop
    v_rows := coalesce(p_data -> 'tables' -> v_table, '[]');
    if jsonb_typeof(v_rows) <> 'array' then
      raise exception 'table % mal formée', v_table using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(v_rows) r where (r ->> 'household_id')::uuid is distinct from v_hh) then
      raise exception 'une ligne de % appartient à un autre espace', v_table using errcode = '42501';
    end if;
    -- Le cache TMDB est partagé entre espaces : on ne l'écrit jamais depuis un fichier.
    -- Une fiche qui n'y est plus (cas rare) laisse le titre sans fiche.
    if v_table = 'watch_item' then
      select coalesce(jsonb_agg(case
               when r ->> 'media_id' is null or exists (select 1 from public.external_media m where m.id = (r ->> 'media_id')::uuid) then r
               else jsonb_set(r, '{media_id}', 'null') end), '[]')
        into v_rows from jsonb_array_elements(v_rows) r;
    end if;

    -- Colonnes écrites : toutes sauf les colonnes calculées par la base.
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_attribute a
    where a.attrelid = format('public.%I', v_table)::regclass
      and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';
    v_key := case when v_table = 'notification_pref' then 'household_id, user_id, tool_key' else 'id' end;

    -- Les triggers de la table se taisent le temps de l'écriture : ni horodatage réécrit,
    -- ni journal ligne à ligne (donc ni push), ni catalogue ou coche recalculés. Les clés
    -- étrangères et les contraintes restent vérifiées ; la somme des parts l'est plus bas.
    -- Le verrou pris par ALTER TABLE ne dure que la transaction.
    execute format('alter table public.%I disable trigger user', v_table);
    execute format(
      'insert into public.%1$I as t (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)
       on conflict (%3$s) do update set (%2$s) = row(%4$s) where t.household_id = $2',
      v_table, v_cols, v_key,
      (select string_agg('excluded.' || c, ', ') from unnest(string_to_array(v_cols, ', ')) c))
    using v_rows, v_hh;
    get diagnostics v_count = row_count;
    execute format('alter table public.%I enable trigger user', v_table);
    v_counts := v_counts || jsonb_build_object(v_table, v_count);
  end loop;

  -- Le contrôle différé des parts était coupé avec les triggers : on le refait d'un coup.
  if exists (
    select 1 from public.expense e
    where e.household_id = v_hh and e.deleted_at is null
      and e.book_amount_cents is distinct from (
        select coalesce(sum(s.share_cents), 0) from public.expense_share s where s.expense_id = e.id and s.deleted_at is null)
  ) then
    raise exception 'les parts d''une dépense ne totalisent pas son montant' using errcode = '23514';
  end if;

  insert into public.activity_log (household_id, actor_id, tool_key, action, entity_type, entity_id, entity_label)
  values (v_hh, auth.uid(), 'system', 'imported', 'household', v_hh,
          to_char((p_data ->> 'exported_at')::timestamptz at time zone 'UTC', 'YYYY-MM-DD'));

  return v_counts;
end;
$$;

revoke execute on function public.export_household(uuid), public.import_household(jsonb) from public, anon;
grant execute on function public.export_household(uuid), public.import_household(jsonb) to authenticated, service_role;
revoke execute on function private.backup_tables(), private.is_service() from public, anon;

-- -----------------------------------------------------------------------------
-- client_error : journal léger des erreurs de l'app (à la place de Sentry).
-- Écrit par chaque membre pour lui-même, lu par les membres de l'espace sur la
-- page « État du système ». Purgé après 30 jours.
-- -----------------------------------------------------------------------------
create table public.client_error (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid default auth.uid() references public.profile (id) on delete set null,
  message text not null check (char_length(message) between 1 and 1000),
  stack text check (char_length(stack) <= 4000),
  path text check (char_length(path) <= 300),
  user_agent text check (char_length(user_agent) <= 300),
  release text check (char_length(release) <= 60),
  created_at timestamptz not null default now()
);

create index client_error_household_id_created_at_idx on public.client_error (household_id, created_at desc);
create index client_error_user_id_idx on public.client_error (user_id);

alter table public.client_error enable row level security;

create policy membres_lisent on public.client_error
  for select to authenticated
  using (private.is_member(household_id));
create policy chacun_signale on public.client_error
  for insert to authenticated
  with check (private.is_member(household_id) and user_id = (select auth.uid()));

revoke all on public.client_error from public, anon, authenticated;
grant select, insert on public.client_error to authenticated;
grant all on public.client_error to service_role;

create or replace function private.purge_client_errors()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.client_error where created_at < now() - interval '30 days';
$$;

revoke execute on function private.purge_client_errors() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Bucket privé « backups » : {household_id}/{AAAA-MM-JJ}.json, lisible par les
-- membres ; seule la fonction « backup » (service) y écrit.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    raise notice 'storage schema not found, skipping backups bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('backups', 'backups', false, 50 * 1024 * 1024)
  on conflict (id) do nothing;

  execute $p$
    create policy backups_membres_lisent on storage.objects
      for select to authenticated
      using (bucket_id = 'backups'
             and private.is_member(private.try_uuid(split_part(name, '/', 1))))
  $p$;
end $$;

-- -----------------------------------------------------------------------------
-- Planification : sauvegarde le dimanche à 4 h UTC (fonction « backup », même
-- secret partagé que l'envoi des push), purge du journal d'erreurs chaque nuit.
-- -----------------------------------------------------------------------------
create or replace function private.trigger_backup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  execute $q$select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url'),
      (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')$q$
    into v_url, v_secret;
  if v_url is null or v_secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using v_url || '/functions/v1/backup',
          jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
          '{}'::jsonb;
end;
$$;

revoke execute on function private.trigger_backup() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available, backups and error purge not scheduled';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.schedule('oho_purge_client_errors', '45 3 * * *', $job$select private.purge_client_errors()$job$);
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    perform cron.schedule('oho_backup', '0 4 * * 0', $job$select private.trigger_backup()$job$);
  end if;
end $$;
