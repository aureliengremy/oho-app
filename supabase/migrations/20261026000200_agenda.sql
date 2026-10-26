-- =============================================================================
-- Lot 15 — Agenda : l'agenda Google commun, en lecture seule.
-- Aucune table : la fonction « agenda » lit l'adresse secrète iCal (secret AGENDA_ICAL_URL)
-- à chaque demande. Cette migration ne fait qu'activer l'outil pour chaque espace et lui
-- donner l'onglet de Voyages dans la barre du bas ; Voyages passe dans la grille de l'accueil.
-- =============================================================================

insert into public.tool_activation (household_id, tool_key, enabled, sort_order)
select h.id, 'agenda', true, 2
from public.household h
where h.deleted_at is null
  and not exists (
    select 1 from public.tool_activation t
    where t.household_id = h.id and t.tool_key = 'agenda' and t.deleted_at is null
  );

-- Voyages après les quatre onglets (Courses, Agenda, À regarder, Dépenses), décision D1.
update public.tool_activation
set sort_order = 5
where tool_key = 'trips' and deleted_at is null and sort_order < 5;
