-- Live sync between devices: publish household data changes to Supabase Realtime.
-- Row-level security still applies, so each person only receives their own household's changes.
-- (The app's src/data/live.ts listens and refreshes the screens.)
do $$
declare
  t text;
begin
  foreach t in array array['care_events', 'plants', 'plant_photos', 'rooms', 'locations'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
