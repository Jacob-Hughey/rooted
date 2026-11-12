import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { onSyncFailure, unsynced, useOutbox, type OutboxEntry } from "@/data/outbox";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine);

function describe(list: OutboxEntry[]) {
  const n = list.length;
  const allWaterings = list.every((e) => e.op.kind === "log" && e.op.event.type === "water");
  return allWaterings ? `${n} watering${n === 1 ? "" : "s"}` : `${n} change${n === 1 ? "" : "s"}`;
}

const FAILED: Record<OutboxEntry["op"]["kind"], string> = { log: "an entry", delete: "an undo", note: "a note" };

/**
 * A quiet line at the top of the page when the connection is out, or when saved care is
 * taking a while to sync. Nothing at all when everything is up to date.
 */
export function SyncStatus() {
  const online = useOnline();
  const waiting = unsynced(useOutbox());
  const toast = useToast();
  const [, tick] = useState(0);

  // Re-check every couple of seconds while something waits, so a slow sync shows up.
  useEffect(() => {
    if (waiting.length === 0) return;
    const t = window.setInterval(() => tick((n) => n + 1), 2000);
    return () => window.clearInterval(t);
  }, [waiting.length]);

  useEffect(
    () =>
      onSyncFailure(({ entry }) => {
        const what =
          entry.op.kind === "log" && entry.op.event.type === "water" ? "the watering" : FAILED[entry.op.kind];
        toast(`Couldn’t save ${what} for ${entry.plantName}. It may have been removed on another device.`);
      }),
    [toast],
  );

  const slow = waiting.some((e) => e.attempts > 0 || Date.now() - e.queuedAt > 4000);

  // Long form for the strip above the phone tab bar; short form for the iPad side rail.
  let message: string | null = null;
  let short = "";
  if (!online && waiting.length > 0) {
    message = `Offline · ${describe(waiting)} will sync later`;
    short = `Offline · ${waiting.length} to sync`;
  } else if (!online) {
    message = "Offline · showing your last sync";
    short = "Offline";
  } else if (slow) {
    message = `Syncing ${describe(waiting)}…`;
    short = `Syncing ${waiting.length}`;
  }
  if (!message) return null;

  const Icon = online ? RefreshCw : CloudOff;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 border-b px-4 py-1.5 text-sm text-muted-foreground",
        "md:absolute md:inset-x-0 md:bottom-6 md:flex-col md:gap-1 md:border-0 md:px-1 md:py-0 md:text-center md:text-xs",
      )}
    >
      <Icon className={cn("size-4 shrink-0", online && "animate-spin [animation-duration:2.5s]")} />
      <span className="md:hidden">{message}</span>
      <span className="hidden md:block">{short}</span>
    </div>
  );
}
