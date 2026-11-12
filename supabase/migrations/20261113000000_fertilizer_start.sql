-- Fertilizer reminders get a starting point when she turns them on for a plant with no feeding logged.
-- Same function as in 20261105000000_init.sql; only the fertilizer branch changes.
-- (Undoing the only feeding keeps the existing due date instead of resetting it.)
create or replace function public.plants_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hemi text;
begin
  select h.hemisphere into hemi from public.households h where h.id = new.household_id;

  if new.last_watered_at is not null then
    new.next_water_at := public.compute_next_water(new.last_watered_at, new.water_interval_days, new.water_adjust, coalesce(hemi, 'north'));
  elsif tg_op = 'INSERT' and new.next_water_at is null then
    new.next_water_at := now();   -- brand-new plant with unknown history: check it today
  elsif tg_op = 'UPDATE' and old.last_watered_at is not null then
    new.next_water_at := now();   -- last watering was undone and none remain: check it today
  end if;

  -- Fertilizer reminders are opt-in (null interval = off).
  -- With no feeding logged yet, count from the day the reminder is turned on or changed,
  -- rather than waiting silently for a first "Fertilized" tap.
  if new.fertilize_interval_days is null then
    new.next_fertilize_at := null;
  elsif new.last_fertilized_at is not null then
    new.next_fertilize_at := new.last_fertilized_at + make_interval(days => new.fertilize_interval_days);
  elsif tg_op = 'INSERT'
     or new.next_fertilize_at is null
     or old.fertilize_interval_days is distinct from new.fertilize_interval_days then
    new.next_fertilize_at := now() + make_interval(days => new.fertilize_interval_days);
  end if;

  new.updated_at := now();
  return new;
end;
$$;
