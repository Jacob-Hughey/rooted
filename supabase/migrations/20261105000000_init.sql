-- =============================================================================
-- Rooted — initial schema
-- Households (so you and your wife share one garden), locations → rooms → plants,
-- an append-only care history, and push subscriptions for watering reminders.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'member');
create type public.light_level as enum ('low', 'medium', 'bright_indirect', 'direct');
create type public.care_type as enum (
  'water',        -- resets the watering clock
  'check_moist',  -- "checked, soil still damp" → snooze + learn a slightly longer interval
  'fertilize',
  'mist',
  'repot',
  'prune',
  'rotate',
  'note',
  'photo'
);

-- ---------------------------------------------------------------------------
-- People & households
-- ---------------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Our home',
  hemisphere  text not null default 'north' check (hemisphere in ('north', 'south')),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  avatar_url         text,
  timezone           text not null default 'America/New_York',
  reminder_time      time not null default '08:30',
  reminders_enabled  boolean not null default true,
  created_at         timestamptz not null default now()
);

create table public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.member_role not null default 'member',
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

-- Invite someone by email *before* they sign in for the first time;
-- on first sign-in they join this household instead of getting a new one.
create table public.household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  email         text not null,
  invited_by    uuid references auth.users (id) on delete set null,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index household_invites_open_email on public.household_invites (lower(email)) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Places
-- ---------------------------------------------------------------------------
create table public.locations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index on public.locations (household_id);

create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  location_id   uuid not null references public.locations (id) on delete cascade,
  name          text not null,
  light         public.light_level,
  photo_path    text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index on public.rooms (household_id);
create index on public.rooms (location_id);

-- ---------------------------------------------------------------------------
-- Plants
-- ---------------------------------------------------------------------------
create table public.plants (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households (id) on delete cascade,
  room_id                  uuid references public.rooms (id) on delete set null,
  name                     text not null,              -- "Monstera"
  nickname                 text,                       -- "Monty"
  species                  text,                       -- "Monstera deliciosa"
  cover_photo_path         text,                       -- storage path in bucket plant-photos
  notes                    text,
  acquired_on              date,

  -- watering ("smart" schedule)
  water_interval_days      int not null default 7 check (water_interval_days between 1 and 120),
  water_adjust             numeric(4,2) not null default 1.00 check (water_adjust between 0.5 and 2.0),
  last_watered_at          timestamptz,
  next_water_at            timestamptz,               -- maintained by triggers below

  -- feeding
  fertilize_interval_days  int check (fertilize_interval_days between 1 and 365),
  last_fertilized_at       timestamptz,
  next_fertilize_at        timestamptz,

  archived_at              timestamptz,               -- "RIP" / given away; hidden but history kept
  created_by               uuid references auth.users (id) on delete set null default auth.uid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index on public.plants (household_id) where archived_at is null;
create index on public.plants (next_water_at) where archived_at is null;
create index on public.plants (room_id);

create table public.plant_photos (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  plant_id      uuid not null references public.plants (id) on delete cascade,
  path          text not null,
  caption       text,
  taken_at      timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null default auth.uid()
);
create index on public.plant_photos (plant_id, taken_at desc);

-- Append-only history. Inserting a 'water' event is how the app "waters" a plant.
create table public.care_events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  plant_id      uuid not null references public.plants (id) on delete cascade,
  type          public.care_type not null,
  performed_at  timestamptz not null default now(),
  performed_by  uuid references auth.users (id) on delete set null default auth.uid(),
  note          text,
  photo_path    text,
  created_at    timestamptz not null default now()
);
create index on public.care_events (plant_id, performed_at desc);
create index on public.care_events (household_id, performed_at desc);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);
create index on public.push_subscriptions (user_id);

-- One reminder per person per local day
create table public.reminder_log (
  user_id     uuid not null references auth.users (id) on delete cascade,
  local_date  date not null,
  due_count   int not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, local_date)
);

-- =============================================================================
-- Watering logic
-- =============================================================================

-- Plants drink less in winter. Multiplier applied to the base interval by month.
create or replace function public.seasonal_factor(at_time timestamptz, hemisphere text default 'north')
returns numeric
language sql immutable
set search_path = ''
as $$
  select case
    -- shift months by 6 for the southern hemisphere
    (((extract(month from at_time)::int - 1 + case when hemisphere = 'south' then 6 else 0 end) % 12) + 1)
    when 12 then 1.40 when 1 then 1.40 when 2 then 1.30
    when 3  then 1.10 when 4 then 1.00
    when 5  then 0.90 when 6 then 0.85 when 7 then 0.85 when 8 then 0.90
    when 9  then 1.00 when 10 then 1.10 when 11 then 1.25
  end::numeric
$$;

create or replace function public.compute_next_water(
  last_watered timestamptz, interval_days int, adjust numeric, hemisphere text default 'north'
) returns timestamptz
language sql immutable
set search_path = ''
as $$
  select case
    when last_watered is null then null
    else last_watered
         + make_interval(days => greatest(1, round(interval_days * adjust * public.seasonal_factor(last_watered, hemisphere))::int))
  end
$$;

-- Keep next_water_at / next_fertilize_at correct whenever a plant's schedule fields change.
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

  if new.fertilize_interval_days is not null and new.last_fertilized_at is not null then
    new.next_fertilize_at := new.last_fertilized_at + make_interval(days => new.fertilize_interval_days);
  elsif new.fertilize_interval_days is null then
    new.next_fertilize_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger plants_before_write
  before insert or update of last_watered_at, water_interval_days, water_adjust,
                             last_fertilized_at, fertilize_interval_days, household_id
  on public.plants
  for each row execute function public.plants_before_write();

-- Apply care events to the plant (and undo cleanly when an event is deleted).
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

  if ev.type = 'water' then
    update public.plants p
       set last_watered_at = (select max(c.performed_at) from public.care_events c
                               where c.plant_id = ev.plant_id and c.type = 'water')
     where p.id = ev.plant_id and p.household_id = ev.household_id;

  elsif ev.type = 'fertilize' then
    update public.plants p
       set last_fertilized_at = (select max(c.performed_at) from public.care_events c
                                  where c.plant_id = ev.plant_id and c.type = 'fertilize')
     where p.id = ev.plant_id and p.household_id = ev.household_id;

  elsif ev.type = 'check_moist' and tg_op = 'INSERT' then
    -- Soil was still damp: snooze 2 days and learn a slightly longer interval (max +60%).
    update public.plants p
       set water_adjust = least(1.60, p.water_adjust + 0.05)
     where p.id = ev.plant_id and p.household_id = ev.household_id;
    update public.plants p
       set next_water_at = greatest(p.next_water_at, ev.performed_at + interval '2 days')
     where p.id = ev.plant_id and p.household_id = ev.household_id;
  end if;

  return null;
end;
$$;

create trigger care_events_apply
  after insert or delete on public.care_events
  for each row execute function public.care_events_apply();

-- Today dashboard helper: plant + room + status in one row.
create or replace view public.plant_status
with (security_invoker = true) as
select
  p.*,
  r.name  as room_name,
  l.name  as location_name,
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

-- =============================================================================
-- Row Level Security
-- =============================================================================

create or replace function public.is_member(hid uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  )
$$;

alter table public.households         enable row level security;
alter table public.profiles           enable row level security;
alter table public.household_members  enable row level security;
alter table public.household_invites  enable row level security;
alter table public.locations          enable row level security;
alter table public.rooms              enable row level security;
alter table public.plants             enable row level security;
alter table public.plant_photos       enable row level security;
alter table public.care_events        enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log       enable row level security;

-- households
create policy "members read household"   on public.households for select using (public.is_member(id));
create policy "members update household" on public.households for update using (public.is_member(id));

-- profiles: see yourself and your housemates
create policy "read own and housemates profiles" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "update own profile" on public.profiles for update using (id = auth.uid());

-- membership
create policy "members read membership" on public.household_members for select using (public.is_member(household_id));

-- invites
create policy "members manage invites" on public.household_invites for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- household-scoped data: one policy per table, same rule
do $$
declare t text;
begin
  foreach t in array array['locations', 'rooms', 'plants', 'plant_photos', 'care_events'] loop
    execute format(
      'create policy "household members full access" on public.%I for all
         using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
  end loop;
end $$;

-- push subscriptions are per-user
create policy "own push subscriptions" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reminder_log: service role only (no policies → no access for users)

-- =============================================================================
-- New-user bootstrap: profile + household (or join an invited household)
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.household_invites;
  hid uuid;
  loc uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  select * into inv from public.household_invites i
   where lower(i.email) = lower(new.email) and i.accepted_at is null
   limit 1;

  if found then
    insert into public.household_members (household_id, user_id, role) values (inv.household_id, new.id, 'member');
    update public.household_invites set accepted_at = now() where id = inv.id;
  else
    insert into public.households default values returning id into hid;
    insert into public.household_members (household_id, user_id, role) values (hid, new.id, 'owner');
    insert into public.locations (household_id, name) values (hid, 'Home') returning id into loc;
    insert into public.rooms (household_id, location_id, name, light, sort_order) values
      (hid, loc, 'Living room', 'bright_indirect', 0),
      (hid, loc, 'Kitchen',     'medium',          1),
      (hid, loc, 'Bedroom',     'medium',          2);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Reminder batch (called by the send-watering-reminders edge function)
-- Returns one row per person whose local reminder time has passed today,
-- who hasn't been reminded yet today, and who has plants due by end of their day.
-- =============================================================================
create or replace function public.reminder_batch()
returns table (user_id uuid, local_date date, due_count int, plant_names text[])
language sql stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    (now() at time zone pr.timezone)::date,
    count(pl.id)::int,
    (array_agg(coalesce(pl.nickname, pl.name) order by pl.next_water_at))[1:3]
  from public.profiles pr
  join public.household_members hm on hm.user_id = pr.id
  join public.plants pl on pl.household_id = hm.household_id and pl.archived_at is null
  where pr.reminders_enabled
    and (now() at time zone pr.timezone)::time >= pr.reminder_time
    and not exists (
      select 1 from public.reminder_log rl
      where rl.user_id = pr.id and rl.local_date = (now() at time zone pr.timezone)::date
    )
    and pl.next_water_at < (((now() at time zone pr.timezone)::date + 1)::timestamp at time zone pr.timezone)
  group by pr.id, pr.timezone
$$;

revoke execute on function public.reminder_batch() from public, anon, authenticated;
grant execute on function public.reminder_batch() to service_role;

-- =============================================================================
-- Storage: private bucket, files live under {household_id}/...
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plant-photos', 'plant-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "household photos read" on storage.objects for select
  using (bucket_id = 'plant-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "household photos write" on storage.objects for insert
  with check (bucket_id = 'plant-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "household photos update" on storage.objects for update
  using (bucket_id = 'plant-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "household photos delete" on storage.objects for delete
  using (bucket_id = 'plant-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
