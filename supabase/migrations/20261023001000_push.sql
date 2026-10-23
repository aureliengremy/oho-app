-- =============================================================================
-- OhO · Lot 10 · Notifications push
-- push_subscription (un appareil d'une personne), notification_pref (par membre
-- et par outil), push_digest (les notifications regroupées en attente d'envoi).
-- Source : docs/cadrage/modele-donnees.html (socle), PLAN lot 10, DECISIONS P5.
--
-- Trajet : une ligne de activity_log (seule source des push) → trigger
-- queue_push → un résumé ouvert par destinataire et par outil (push_digest),
-- qui grossit pendant digest_minutes → pg_cron appelle la fonction « push-send »
-- chaque minute → claim_push_digests() rend les résumés échus et leurs appareils.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- push_subscription : un navigateur abonné. Appartient à une personne, sans foyer.
-- -----------------------------------------------------------------------------
create table public.push_subscription (
  id uuid primary key default private.uuid_generate_v7(),
  user_id uuid not null references public.profile (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_agent text check (char_length(user_agent) <= 200),
  last_seen_at timestamptz,
  failure_count smallint not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscription_endpoint_key unique (endpoint)
);

create index push_subscription_user_id_idx on public.push_subscription (user_id);

-- -----------------------------------------------------------------------------
-- notification_pref : couper un outil, régler la fenêtre de regroupement.
-- Sans ligne, un outil notifie, regroupé sur 5 minutes.
-- -----------------------------------------------------------------------------
create table public.notification_pref (
  household_id uuid not null,
  user_id uuid not null,
  tool_key text not null check (tool_key ~ '^[a-z][a-z0-9_]{1,30}$'),
  enabled boolean not null default true,
  digest_minutes smallint not null default 5 check (digest_minutes between 0 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id, tool_key),
  foreign key (household_id, user_id) references public.membership (household_id, user_id) on delete cascade
);

create index notification_pref_user_id_idx on public.notification_pref (user_id);

-- -----------------------------------------------------------------------------
-- push_digest : un résumé en attente, par destinataire et par outil.
-- Écrit par trigger, lu par le service ; personne ne le lit depuis l'app.
-- -----------------------------------------------------------------------------
create table public.push_digest (
  id uuid primary key default private.uuid_generate_v7(),
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid not null references public.profile (id) on delete cascade,
  tool_key text not null,
  item_count integer not null default 0 check (item_count >= 0),
  actor_ids uuid[] not null default '{}',
  labels text[] not null default '{}',
  entity_types text[] not null default '{}',
  due_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index push_digest_open_key on public.push_digest (user_id, tool_key) where sent_at is null;
create index push_digest_due_idx on public.push_digest (due_at) where sent_at is null;
create index push_digest_household_id_idx on public.push_digest (household_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- updated_at des deux tables ; created_at reste figé. (Pas touch_updated_at, qui sert
-- profile et vérifie une colonne id que notification_pref n'a pas.)
create or replace function private.touch_push_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_push_row before update on public.push_subscription
  for each row execute function private.touch_push_row();
create trigger touch_push_row before update on public.notification_pref
  for each row execute function private.touch_push_row();

-- Anti-spam : seules les créations notifient (un ajout, pas chaque case cochée),
-- jamais pour ses propres actions, seulement vers qui a un appareil abonné,
-- un outil activé pour l'espace et pas coupé dans ses préférences.
create or replace function private.queue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.action <> 'created' or new.actor_id is null then
    return null;
  end if;
  if not exists (
    select 1 from public.tool_activation t
    where t.household_id = new.household_id and t.tool_key = new.tool_key and t.enabled and t.deleted_at is null
  ) then
    return null;
  end if;

  for r in
    select m.user_id, coalesce(p.digest_minutes, 5) as digest_minutes
    from public.membership m
    left join public.notification_pref p
      on p.household_id = m.household_id and p.user_id = m.user_id and p.tool_key = new.tool_key
    where m.household_id = new.household_id
      and m.deleted_at is null
      and m.user_id <> new.actor_id
      and coalesce(p.enabled, true)
      and exists (select 1 from public.push_subscription s where s.user_id = m.user_id)
  loop
    -- La fenêtre part du premier ajout : un flot continu n'empêche pas l'envoi.
    insert into public.push_digest as d
      (household_id, user_id, tool_key, item_count, actor_ids, labels, entity_types, due_at)
    values (
      new.household_id, r.user_id, new.tool_key, 1, array[new.actor_id],
      case when new.entity_label is null then '{}' else array[left(new.entity_label, 80)] end,
      array[new.entity_type],
      now() + make_interval(mins => r.digest_minutes)
    )
    on conflict (user_id, tool_key) where sent_at is null do update set
      item_count = d.item_count + 1,
      actor_ids = case when new.actor_id = any (d.actor_ids) then d.actor_ids else d.actor_ids || new.actor_id end,
      -- Les cinq premiers libellés suffisent au message.
      labels = case when new.entity_label is null or cardinality(d.labels) >= 5 then d.labels else d.labels || left(new.entity_label, 80) end,
      entity_types = case when new.entity_type = any (d.entity_types) then d.entity_types else d.entity_types || new.entity_type end;
  end loop;
  return null;
end;
$$;

create trigger queue_push after insert on public.activity_log
  for each row execute function private.queue_push();

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Abonner ce navigateur au compte connecté. Un même navigateur qui change de
-- compte passe au nouveau compte (l'endpoint est unique), d'où security definer.
create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'connexion requise' using errcode = '42501';
  end if;
  insert into public.push_subscription as s (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    failure_count = 0
  returning s.id into v_id;
  return v_id;
end;
$$;

-- Pour la fonction « push-send » (service_role) : marque envoyés les résumés
-- échus et les rend avec les noms et les appareils à toucher.
create or replace function public.claim_push_digests(p_limit integer default 100)
returns table (
  digest_id uuid,
  tool_key text,
  item_count integer,
  actor_names text[],
  labels text[],
  entity_types text[],
  subscriptions jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    update public.push_digest d set sent_at = now()
    where d.id in (
      select x.id from public.push_digest x
      where x.sent_at is null and x.due_at <= now()
      order by x.due_at
      limit p_limit
      for update skip locked
    )
    returning d.*
  )
  select
    due.id,
    due.tool_key,
    due.item_count,
    array(select p.display_name from unnest(due.actor_ids) with ordinality a(id, n)
          join public.profile p on p.id = a.id order by a.n),
    due.labels,
    due.entity_types,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscription s where s.user_id = due.user_id
    ), '[]'::jsonb)
  from due;
end;
$$;

-- Les envois livrés et ratés : 404 / 410 ou trois échecs retirent l'appareil.
create or replace function public.report_push(p_ok uuid[], p_gone uuid[], p_failed uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_subscription set last_seen_at = now(), failure_count = 0 where id = any (p_ok);
  delete from public.push_subscription where id = any (p_gone);
  update public.push_subscription set failure_count = failure_count + 1 where id = any (p_failed);
  delete from public.push_subscription where id = any (p_failed) and failure_count >= 3;
  -- Les résumés envoyés ne servent plus après une journée.
  delete from public.push_digest where sent_at < now() - interval '1 day';
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS, policies, privilèges
-- -----------------------------------------------------------------------------
alter table public.push_subscription enable row level security;
alter table public.notification_pref enable row level security;
alter table public.push_digest enable row level security;

-- Ses appareils à soi : les lister, en retirer un. L'ajout passe par register_push.
create policy mes_appareils on public.push_subscription
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy retirer_mes_appareils on public.push_subscription
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy mes_preferences on public.notification_pref
  for all to authenticated
  using (user_id = (select auth.uid()) and private.is_member(household_id))
  with check (user_id = (select auth.uid()) and private.is_member(household_id));

-- push_digest : aucune policy, donc aucun accès depuis l'app.

revoke all on public.push_subscription, public.notification_pref, public.push_digest from public, anon, authenticated;
grant select, delete on public.push_subscription to authenticated;
grant select, insert, update on public.notification_pref to authenticated;
grant all on public.push_subscription, public.notification_pref, public.push_digest to service_role;

revoke execute on function public.register_push(text, text, text, text) from public, anon;
grant execute on function public.register_push(text, text, text, text) to authenticated;
revoke execute on function public.claim_push_digests(integer), public.report_push(uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.claim_push_digests(integer), public.report_push(uuid[], uuid[], uuid[]) to service_role;
revoke execute on function private.queue_push(), private.touch_push_row() from public, anon;

-- Les préférences se lisent en direct sur l'autre téléphone (réglages partagés par appareil).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found, skipping';
    return;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_pref'
  ) then
    alter publication supabase_realtime add table public.notification_pref;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Planification : chaque minute, pg_net appelle la fonction « push-send ».
-- L'URL du projet et le secret partagé sont lus dans Vault à chaque passage
-- (secrets « project_url » et « push_cron_secret », voir docs/LOT-10.md) :
-- tant qu'ils manquent, le job ne fait rien. Sans pg_cron ou pg_net (Postgres
-- nu des tests), rien n'est planifié.
-- -----------------------------------------------------------------------------
create or replace function private.trigger_push_send()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_digest where sent_at is null and due_at <= now()) then
    return;
  end if;
  execute $q$select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url'),
      (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')$q$
    into v_url, v_secret;
  if v_url is null or v_secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using v_url || '/functions/v1/push-send',
          jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret),
          '{}'::jsonb;
end;
$$;

revoke execute on function private.trigger_push_send() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron or pg_net not available, push sending not scheduled';
    return;
  end if;
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.schedule('oho_push_send', '* * * * *', $job$select private.trigger_push_send()$job$);
end $$;
