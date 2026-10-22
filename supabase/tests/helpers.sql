-- Outils des tests (schéma tests, jamais créé hors du cluster de test).
-- Chaque test est un bloc DO : une transaction, donc une identité posée par
-- tests.login() ne déborde pas sur le test suivant.

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Identifiants fixes du seed
create or replace function tests.hh() returns uuid language sql immutable
  as $$ select '0192f000-0000-7000-8000-000000000001'::uuid $$;
create or replace function tests.list() returns uuid language sql immutable
  as $$ select '0192f000-0000-7000-8000-0000000d0001'::uuid $$;

-- Crée un compte comme le ferait Supabase Auth (handle_new_user fait le profil).
create or replace function tests.create_user(p_email text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
            case when p_name is null then '{}'::jsonb else jsonb_build_object('display_name', p_name) end);
  end if;
  return v_id;
end;
$$;

create or replace function tests.user_id(p_email text) returns uuid
language sql stable security definer set search_path = ''
as $$ select id from auth.users where email = p_email $$;

-- Prend l'identité d'un compte connecté pour la fin de la transaction.
create or replace function tests.login(p_email text) returns uuid
language plpgsql
as $$
declare
  v_id uuid := tests.user_id(p_email);
begin
  if v_id is null then
    raise exception 'tests.login: unknown user %', p_email;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
  return v_id;
end;
$$;

create or replace function tests.login_anon() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Revient au superutilisateur de la session.
create or replace function tests.logout() returns void
language plpgsql
as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function tests.assert(p_ok boolean, p_message text) returns void
language plpgsql
as $$
begin
  if p_ok is not true then
    raise exception 'ÉCHEC : %', p_message;
  end if;
end;
$$;

create or replace function tests.ok(p_message text) returns void
language plpgsql
as $$
begin
  raise notice 'ok - %', p_message;
end;
$$;

-- Exécute p_sql et vérifie qu'il échoue avec le SQLSTATE attendu.
create or replace function tests.throws(p_sql text, p_sqlstate text, p_message text) returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then
      return;
    end if;
    raise exception 'ÉCHEC : % (attendu %, obtenu % : %)', p_message, p_sqlstate, sqlstate, sqlerrm;
  end;
  raise exception 'ÉCHEC : % (aucune erreur, attendu %)', p_message, p_sqlstate;
end;
$$;

-- Exécute p_sql (UPDATE ...) et renvoie le nombre de lignes touchées.
create or replace function tests.affected(p_sql text) returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  execute p_sql;
  get diagnostics v = row_count;
  return v;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;
