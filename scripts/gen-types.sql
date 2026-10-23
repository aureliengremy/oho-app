-- Catalogue du schéma public en JSON, lu par scripts/gen-types.mjs.
select json_build_object(
  'tables', (
    select coalesce(json_agg(t order by t.name), '[]') from (
      select c.relname as name, c.relkind as kind,
        (select json_agg(json_build_object(
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'typtype', ty.typtype,
            'elem', case when ty.typcategory = 'A' then (select json_build_object('name', e.typname, 'typtype', e.typtype) from pg_type e where e.oid = ty.typelem) end,
            'udt', ty.typname,
            'nullable', not a.attnotnull,
            'hasDefault', a.atthasdef or a.attidentity <> '',
            'generated', a.attgenerated <> ''
          ) order by a.attname)
          from pg_attribute a join pg_type ty on ty.oid = a.atttypid
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
        (select coalesce(json_agg(json_build_object(
            'name', con.conname,
            'columns', (select json_agg(att.attname order by k.ord) from unnest(con.conkey) with ordinality k(n, ord) join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.n),
            'refTable', rc.relname,
            'refColumns', (select json_agg(att.attname order by k.ord) from unnest(con.confkey) with ordinality k(n, ord) join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k.n),
            'oneToOne', exists (
              select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique and i.indpred is null
                and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x) = (select array_agg(x order by x) from unnest(con.conkey) x))
          ) order by con.conname), '[]')
          from pg_constraint con join pg_class rc on rc.oid = con.confrelid join pg_namespace rn on rn.oid = rc.relnamespace
          where con.conrelid = c.oid and con.contype = 'f' and rn.nspname = 'public') as fks
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v')
    ) t
  ),
  'enums', (
    select coalesce(json_object_agg(t.typname, (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)), '{}')
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  ),
  'functions', (
    select coalesce(json_agg(json_build_object(
        'name', p.proname,
        'argNames', coalesce(p.proargnames, '{}'),
        'argModes', coalesce(p.proargmodes::text[], '{}'),
        'argTypes', (select coalesce(json_agg(json_build_object('udt', ty.typname, 'typtype', ty.typtype) order by k.ord), '[]')
                     from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality k(oid, ord) join pg_type ty on ty.oid = k.oid),
        'defaults', p.pronargdefaults,
        'returns', json_build_object('udt', rt.typname, 'typtype', rt.typtype),
        'setof', p.proretset
      ) order by p.proname), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and rt.typname <> 'trigger'
  )
);
