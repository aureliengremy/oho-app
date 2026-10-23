-- =============================================================================
-- OhO · Lot 4 · Courses : vider les cochés en une action
-- clear_checked(liste) range d'un coup les items cochés (pierres tombales) et
-- écrit une seule ligne « cleared » dans le journal au lieu d'un « deleted »
-- par item. log_activity apprend à se taire pendant une action groupée.
-- =============================================================================

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
  -- Une action groupée (ex. clear_checked) écrit sa propre ligne de journal.
  if current_setting('oho.bulk', true) = 'on' then
    return null;
  end if;

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

create or replace function public.clear_checked(p_checklist_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list public.checklist;
  v_count integer;
begin
  select * into v_list from public.checklist c
  where c.id = p_checklist_id and c.deleted_at is null;

  if v_list.id is null or not private.is_member(v_list.household_id) then
    raise exception 'checklist not found' using errcode = '42501';
  end if;

  perform set_config('oho.bulk', 'on', true);
  update public.checklist_item i
     set deleted_at = now()
   where i.household_id = v_list.household_id
     and i.checklist_id = v_list.id
     and i.checked
     and i.deleted_at is null;
  get diagnostics v_count = row_count;
  perform set_config('oho.bulk', 'off', true);

  if v_count > 0 then
    insert into public.activity_log
      (household_id, actor_id, tool_key, action, entity_type, entity_id, entity_label, payload)
    values (
      v_list.household_id, auth.uid(),
      private.checklist_tool_key(to_jsonb(v_list)),
      'cleared', 'checklist', v_list.id, v_list.name,
      jsonb_build_object('count', v_count)
    );
  end if;

  return v_count;
end;
$$;

revoke all on function public.clear_checked(uuid) from public;
grant execute on function public.clear_checked(uuid) to authenticated, service_role;
