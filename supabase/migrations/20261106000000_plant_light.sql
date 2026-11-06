-- Per-plant light. NULL means "same as the room" — the room's light is the default,
-- and a plant only stores its own when its spot differs (e.g. across the room from the window).
alter table public.plants add column light public.light_level;

-- plant_status selects p.*, which Postgres expands when the view is created,
-- so it has to be rebuilt to include the new column. Dropped and recreated
-- (not "create or replace") because the new column lands in the middle.
drop view public.plant_status;

create view public.plant_status
with (security_invoker = true) as
select
  p.*,
  r.name  as room_name,
  l.name  as location_name,
  r.light as room_light,
  coalesce(p.light, r.light) as effective_light,
  case
    when p.next_water_at is null                       then 'unknown'
    when p.next_water_at < date_trunc('day', now())    then 'overdue'
    when p.next_water_at < date_trunc('day', now()) + interval '1 day' then 'today'
    when p.next_water_at < date_trunc('day', now()) + interval '3 days' then 'soon'
    else 'ok'
  end as water_status
from public.plants p
left join public.rooms r on r.id = p.room_id
left join public.locations l on l.id = r.location_id;
-- NB: day boundaries above are in the DB session time zone (UTC). The client
-- computes exact local-day buckets; this column is a convenience for quick lists.
