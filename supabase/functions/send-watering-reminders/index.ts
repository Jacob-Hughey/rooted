// Supabase Edge Function (Deno). Runs hourly via pg_cron (see supabase/sql/schedule_reminders.sql).
// For everyone whose local reminder time has passed and who has plants due today,
// send one Web Push to each of their devices, then log it so they only get one per day.
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com), CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

type BatchRow = { user_id: string; local_date: string; due_count: number; plant_names: string[] };

function message(row: BatchRow) {
  const names = row.plant_names;
  const extra = row.due_count - names.length;
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")}${extra > 0 ? ", " : " and "}${names[names.length - 1]}`;
  const body =
    row.due_count === 1
      ? `${list} is ready for a drink.`
      : `${list}${extra > 0 ? ` and ${extra} more` : ""} are ready for a drink.`;
  return { title: "Watering day 🌿", body, url: "/", tag: `water-${row.local_date}`, badge_count: row.due_count };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data: batch, error } = await supabase.rpc("reminder_batch");
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const row of (batch ?? []) as BatchRow[]) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", row.user_id);

    const payload = JSON.stringify(message(row));
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 6,
          urgency: "normal",
        });
        sent++;
        await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = the device unsubscribed or the app was removed from the home screen
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("push failed", status, e);
        }
      }
    }

    // Log even with zero devices so we don't re-evaluate this person all day.
    await supabase
      .from("reminder_log")
      .upsert({ user_id: row.user_id, local_date: row.local_date, due_count: row.due_count });
  }

  return Response.json({ people: batch?.length ?? 0, sent });
});
