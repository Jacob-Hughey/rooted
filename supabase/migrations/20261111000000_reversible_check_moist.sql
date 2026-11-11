-- "Soil still damp" used to nudge plants.water_adjust up and snooze next_water_at on INSERT only,
-- so undoing or deleting the check-in left both changes behind.
-- Now the watering schedule is derived from the remaining history whenever a 'water' or
-- 'check_moist' event is added or removed, so deleting an event always reverses it.

create or replace function public.recompute_watering(pid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hemi text;
begin
  -- 1. Last watering, and the learned stretch: +5% per "still damp" check-in, capped at +60%.
  --    Updating these fires plants_before_write, which recomputes next_water_at from the last watering.
  update public.plants p
     set last_watered_at = (select max(c.performed_at) from public.care_events c
                             where c.plant_id = pid and c.type = 'water'),
         water_adjust    = least(1.60, 1.00 + 0.05 * (select count(*) from public.care_events c
                                                      where c.plant_id = pid and c.type = 'check_moist'))
   where p.id = pid;

  -- 2. Snooze: a "still damp" check-in since the last watering pushes the next one to at least 2 days after it.
  --    A plant that has never been watered is due from the day it was added.
  select h.hemisphere into hemi
    from public.plants p join public.households h on h.id = p.household_id
   where p.id = pid;

  update public.plants p
     set next_water_at = greatest(
           coalesce(public.compute_next_water(p.last_watered_at, p.water_interval_days, p.water_adjust, coalesce(hemi, 'north')),
                    p.created_at),
           (select max(c.performed_at) + interval '2 days'
              from public.care_events c
             where c.plant_id = pid
               and c.type = 'check_moist'
               and c.performed_at > coalesce(p.last_watered_at, '-infinity'::timestamptz))
         )                                   -- greatest() ignores the null when there's no check-in
   where p.id = pid;
end;
$$;

-- Internal helper for the trigger only; not callable from the app.
revoke execute on function public.recompute_watering(uuid) from public, anon, authenticated;

create or replace function public.care_events_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.care_events;
begin
  if tg_op = 'DELETE' then ev := old; else ev := new; end if;

  if ev.type in ('water', 'check_moist') then
    perform public.recompute_watering(ev.plant_id);

  elsif ev.type = 'fertilize' then
    update public.plants p
       set last_fertilized_at = (select max(c.performed_at) from public.care_events c
                                  where c.plant_id = ev.plant_id and c.type = 'fertilize')
     where p.id = ev.plant_id and p.household_id = ev.household_id;
  end if;

  return null;
end;
$$;

-- Bring existing plants in line with their history (fixes any check-ins that were already undone).
select public.recompute_watering(id) from public.plants;
