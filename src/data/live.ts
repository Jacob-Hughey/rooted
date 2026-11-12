import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { keys, useHousehold } from "@/data/queries";

const TABLES = ["care_events", "plants", "plant_photos", "rooms", "locations"] as const;

/**
 * Live sync between devices: when anything in the household changes (her iPhone, her iPad,
 * your phone), refresh what's on screen. Row-level security limits the events to her household.
 * Needs the tables in the supabase_realtime publication (migration 20261112000000_realtime.sql).
 *
 * Without a connection this simply does nothing; the app refetches on reconnect and on reopen.
 */
export function useLiveSync() {
  const qc = useQueryClient();
  const { data: household } = useHousehold();
  const householdId = household?.id;

  useEffect(() => {
    if (!householdId) return;
    let timer: number | undefined;
    // A watering round sends a burst of changes: refresh once at the end of it.
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        qc.invalidateQueries({ queryKey: keys.plants });
        qc.invalidateQueries({ queryKey: ["history"] });
        qc.invalidateQueries({ queryKey: ["photos"] });
        qc.invalidateQueries({ queryKey: keys.places });
      }, 400);
    };

    const channel = supabase.channel(`household-${householdId}`);
    for (const table of TABLES) channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    let connectedBefore = false;
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (connectedBefore) refresh(); // reconnected: changes made meanwhile weren't delivered
      connectedBefore = true;
    });

    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
