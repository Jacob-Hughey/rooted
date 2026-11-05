# Rooted 🌿

A photo-first plant care app — plant profiles, smart watering reminders, rooms, care history, and a Today dashboard. Built as an installable web app (PWA) for iPhone and iPad.

**Stack:** React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui-ready · TanStack Query · React Router · Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) · Web Push

> "Rooted" is a working name — search the repo for it (index.html, vite.config.ts, SignIn.tsx, sw.ts) to rename.

---

## What's here

```
src/
  main.tsx, App.tsx          app entry, routes, auth gate
  index.css                  botanical theme (shadcn token names, light + dark)
  sw.ts                      service worker: offline shell + push + notification taps
  auth/AuthProvider.tsx      Google sign-in, email-code fallback, session
  data/queries.ts            all Supabase reads/writes as TanStack Query hooks
  lib/                       supabase client, push, photos (resize + upload), watering helpers, types
  components/                AppShell (tab bar / iPad rail), PlantCard, PlantPhoto, ui/button
  pages/                     Today, Plants, PlantDetail, NewPlant, Rooms, Settings, SignIn
supabase/
  migrations/…_init.sql      schema, smart-watering triggers, RLS, storage bucket, new-user bootstrap
  functions/send-watering-reminders/   hourly push sender
  sql/schedule_reminders.sql pg_cron job (run once by hand)
```

### Design decisions worth knowing
- **Households.** Every row belongs to a household, so you can both use it. Invite her email in Settings *before* her first sign-in and she lands in your Rooted.
- **Watering is event-driven.** Tapping "Watered" inserts a `care_events` row; a trigger updates `last_watered_at` / `next_water_at`. Deleting the event (Undo) rolls it back. History is never lost.
- **"Smart" schedule.** `next = last watered + interval × seasonal factor × learned adjust`. Winter stretches intervals (×1.4 in Dec–Jan), summer shortens them. "Still damp" check-ins snooze 2 days and nudge that plant's interval up 5% (capped at +60%).
- **Photos** are resized to 1600px JPEG in the browser, stored in a private bucket under `{household_id}/…`, and shown with signed URLs.
- **Reminders:** one push per person per day at their chosen local time, only if something is due.

---

## Setup

### 1. Install & run
```bash
npm install
cp .env.example .env.local     # fill in after step 2
npm run dev
```
Optional shadcn components later: `npx shadcn@latest add dialog sheet input select` (config is already in `components.json`).

### 2. Supabase project
1. Create a project at supabase.com. Copy the **Project URL** and **anon/publishable key** into `.env.local`.
2. Apply the schema — either paste `supabase/migrations/20261105000000_init.sql` into the SQL editor, or:
   ```bash
   npx supabase login
   npx supabase init          # creates supabase/config.toml
   npx supabase link --project-ref YOUR-REF
   npx supabase db push
   ```

### 3. Google sign-in
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
2. Authorized redirect URI: `https://YOUR-REF.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google: paste client ID + secret.
4. Supabase → Authentication → URL Configuration: add `http://localhost:5173`, your LAN dev URL, and your production URL to **Redirect URLs**.

The sign-in screen also offers a 6-digit **email code**. Keep it: it's the dependable path inside the home-screen app if a Google redirect ever lands in Safari instead of the installed app. (Make sure the Supabase "Magic Link" email template includes `{{ .Token }}`.)

### 4. Push notifications
```bash
npx web-push generate-vapid-keys
```
- Public key → `VITE_VAPID_PUBLIC_KEY` in `.env.local` (and in your hosting env vars).
- Secrets for the function:
  ```bash
  npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=$(openssl rand -hex 24)
  npx supabase functions deploy send-watering-reminders --no-verify-jwt
  ```
- Enable **pg_cron** and **pg_net** (Database → Extensions), then edit and run `supabase/sql/schedule_reminders.sql` in the SQL editor.

**iPhone/iPad rules (Apple's, not ours):** web push works only after the site is added to the Home Screen from Safari (Share → Add to Home Screen) and opened from there; permission must be requested from a tap (the Settings toggle does this); each device subscribes separately. Push requires HTTPS, so test it on the deployed URL, not `localhost` over LAN.

### 5. Deploy
Either host works — the app is a static SPA and all scheduling lives in Supabase.
- **Vercel:** import the repo, framework "Vite", add the three `VITE_*` env vars. `vercel.json` handles SPA routes.
- **Cloudflare Pages:** build `npm run build`, output `dist`, same env vars. `public/_headers` keeps the service worker fresh.

Then add the production URL to Supabase redirect URLs, open it in Safari on her phone, Add to Home Screen, sign in, Settings → turn on reminders.

---

## Testing the reminder pipeline quickly
```sql
-- in the SQL editor: make yourself due now and allow a resend today
update profiles set reminder_time = '00:00';
delete from reminder_log;
update plants set next_water_at = now() - interval '1 day' where name = 'Monstera';
```
then trigger the function: `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://YOUR-REF.supabase.co/functions/v1/send-watering-reminders`

## Next steps
- Edit plant / room screens, room photos, archiving ("RIP")
- Photo timeline (`plant_photos` table is ready)
- Fertilizing reminders (`next_fertilize_at` is already computed)
- `npm run db:types` → typed Supabase client
