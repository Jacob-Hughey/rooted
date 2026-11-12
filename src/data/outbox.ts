/**
 * The outbox: care she logs (waterings, check-ins, notes, undo) is saved on the device first
 * and sent to Supabase in the background, retrying until it gets through.
 *
 * - Every entry is written to localStorage before the tap is acknowledged, so closing the app,
 *   losing Wi-Fi or the phone going to sleep can't lose it.
 * - Care events get their id on the device, and inserts are "insert unless it already exists",
 *   so a retry after a timeout (where the first try actually landed) never creates a duplicate.
 * - Screens show server data with the outbox laid on top (see overlayPlants / overlayHistory),
 *   so a refetch while something is still waiting never makes it vanish from the screen.
 * - Two devices logging offline merge cleanly: the database derives "last watered" from the
 *   whole history, whatever order the events arrive in.
 */
import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { computeNextWater } from "@/lib/watering";
import type { CareEvent, Household, Plant, PlantWithPlace } from "@/lib/types";

/** Schedule fields a care event changes, as they were just before it was logged (for offline undo). */
export type Prior = Pick<Plant, "last_watered_at" | "next_water_at" | "water_adjust" | "last_fertilized_at" | "next_fertilize_at">;

export type OutboxOp =
  | { kind: "log"; event: CareEvent; prior?: Prior }
  | { kind: "delete"; event: CareEvent; prior?: Prior }
  | { kind: "note"; event: CareEvent; note: string };

export interface OutboxEntry {
  key: string;
  op: OutboxOp;
  userId: string;
  plantName: string;
  queuedAt: number;
  attempts: number;
  nextTryAt: number;
  /** Sent successfully at this time; kept as an overlay until the screens have refetched. */
  syncedAt?: number;
}

export type SyncFailure = { entry: OutboxEntry; message: string };

const STORAGE_KEY = "rooted.outbox.v1";
const REQUEST_TIMEOUT = 15_000;
const BACKOFF = [2, 5, 15, 30, 60, 120].map((s) => s * 1000);

// ---- State -------------------------------------------------------------------

let entries: OutboxEntry[] = load();
let userId: string | null = null;
let qc: QueryClient | null = null;
let inFlight: string | null = null;
let running = false;
let rerun = false; // flush() was called while running
let kickedAt = 0; // last "try now" (connection back, app reopened…)
let needsRefresh = true; // also refresh once at startup, for entries synced just before the app closed
let timer: number | undefined;
const listeners = new Set<() => void>();
const failureListeners = new Set<(f: SyncFailure) => void>();
/** Priors of events logged this session, so an undo after they synced can still restore the plant. */
const priors = new Map<string, Prior>();

function load(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function commit(next: OutboxEntry[]) {
  entries = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error("Couldn't save the outbox", err); // storage full / disabled; the in-memory copy still syncs
  }
  listeners.forEach((l) => l());
}

const mine = (e: OutboxEntry) => e.userId === userId;
const waiting = (e: OutboxEntry) => !e.syncedAt && e.key !== inFlight;

// ---- Queueing ------------------------------------------------------------------

function add(op: OutboxOp, plantName: string) {
  if (!userId) throw new Error("Not signed in");
  commit([
    ...entries,
    { key: crypto.randomUUID(), op, userId, plantName, queuedAt: Date.now(), attempts: 0, nextTryAt: 0 },
  ]);
  void flush();
}

export function queueLog(event: CareEvent, plantName: string, prior?: Prior) {
  if (prior) priors.set(event.id, prior);
  add({ kind: "log", event, prior }, plantName);
}

export function queueDelete(event: CareEvent, plantName: string) {
  const pendingLog = entries.find((e) => mine(e) && waiting(e) && e.op.kind === "log" && e.op.event.id === event.id);
  // Drop notes for this event that haven't been sent; they'd be pointless.
  const rest = entries.filter((e) => !(mine(e) && waiting(e) && e.op.kind === "note" && e.op.event.id === event.id));
  if (pendingLog) {
    // Never reached the server: forget it entirely.
    commit(rest.filter((e) => e !== pendingLog));
    return;
  }
  if (rest.length !== entries.length) commit(rest);
  const prior = priors.get(event.id) ?? findLoggedPrior(event.id);
  add({ kind: "delete", event, prior }, plantName);
}

export function queueNote(event: CareEvent, note: string, plantName: string) {
  // Only the newest unsent entry for this event can absorb the edit; anything older would be overwritten after it.
  const forEvent = entries.filter((e) => mine(e) && !e.syncedAt && e.op.event.id === event.id);
  const target = forEvent[forEvent.length - 1];
  if (target && waiting(target) && (target.op.kind === "log" || target.op.kind === "note")) {
    // Fold the edit into the waiting insert or note update.
    const cur = target.op;
    const op: OutboxOp =
      cur.kind === "log" ? { ...cur, event: { ...cur.event, note } } : { kind: "note", event: cur.event, note };
    commit(entries.map((e) => (e === target ? { ...e, op } : e)));
    return;
  }
  add({ kind: "note", event, note }, plantName);
}

function findLoggedPrior(eventId: string): Prior | undefined {
  const e = entries.find((x) => x.op.kind === "log" && x.op.event.id === eventId);
  return e?.op.kind === "log" ? e.op.prior : undefined;
}

// ---- Sending -------------------------------------------------------------------

type Result = { error: { message: string; code?: string } | null; status: number };

function timeoutSignal(ms: number): AbortSignal {
  if ("timeout" in AbortSignal) return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

async function send(op: OutboxOp): Promise<Result> {
  const signal = timeoutSignal(REQUEST_TIMEOUT);
  const table = supabase.from("care_events");
  const ev = op.event;
  switch (op.kind) {
    case "log":
      return table
        .upsert(
          {
            id: ev.id,
            household_id: ev.household_id,
            plant_id: ev.plant_id,
            type: ev.type,
            note: ev.note,
            performed_at: ev.performed_at,
          },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .abortSignal(signal);
    case "delete":
      return table.delete().eq("id", ev.id).abortSignal(signal);
    case "note":
      return table.update({ note: op.note }).eq("id", ev.id).abortSignal(signal);
  }
}

/** Worth trying again later: no connection, a timeout, an expired sign-in, or a server hiccup. */
function isTransient({ error, status }: Result) {
  if (!error) return false;
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500 || !!error.code?.startsWith("PGRST3");
}

async function flush(): Promise<void> {
  if (!userId) return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  window.clearTimeout(timer);
  try {
    for (;;) {
      const entry = entries.find((e) => mine(e) && !e.syncedAt);
      if (!entry) break;
      const wait = entry.nextTryAt - Date.now();
      if (wait > 0) {
        timer = window.setTimeout(() => void flush(), wait);
        break;
      }

      inFlight = entry.key;
      const startedAt = Date.now();
      let result: Result;
      try {
        result = await send(entry.op);
      } catch (err) {
        result = { error: { message: String(err) }, status: 0 };
      } finally {
        inFlight = null;
      }

      if (!result.error) {
        commit(entries.map((e) => (e.key === entry.key ? { ...e, syncedAt: Date.now() } : e)));
        needsRefresh = true;
        continue;
      }
      if (isTransient(result)) {
        const attempts = entry.attempts + 1;
        // The connection came back while this request was failing: try again straight away.
        const retryNow = kickedAt >= startedAt;
        const delay = retryNow ? 0 : BACKOFF[Math.min(attempts - 1, BACKOFF.length - 1)];
        commit(entries.map((e) => (e.key === entry.key ? { ...e, attempts, nextTryAt: Date.now() + delay } : e)));
        if (retryNow) {
          kickedAt = 0;
          continue;
        }
        timer = window.setTimeout(() => void flush(), delay);
        break;
      }
      // The server said no (e.g. the plant was deleted on another device). Retrying won't help.
      console.error("Outbox entry rejected", entry, result.error);
      commit(entries.filter((e) => e.key !== entry.key));
      failureListeners.forEach((l) => l({ entry, message: result.error!.message }));
    }
  } finally {
    running = false;
  }
  if (rerun) {
    rerun = false;
    return flush();
  }
  if (needsRefresh) {
    needsRefresh = false;
    await refreshAfterSync();
  }
}

/** Refetch what the synced entries touched. The entries stay as overlays until that data arrives (see prune). */
async function refreshAfterSync() {
  const synced = entries.filter((e) => mine(e) && e.syncedAt);
  if (!qc || synced.length === 0) return;
  const plantIds = new Set(synced.map((e) => e.op.event.plant_id));
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["plants"], exact: true }),
    ...[...plantIds].flatMap((id) => [
      qc!.invalidateQueries({ queryKey: ["plants", id], exact: true }),
      qc!.invalidateQueries({ queryKey: ["history", id], exact: true }),
    ]),
  ]).catch(() => {});
  prune();
}

/** Remove synced entries once every cached screen they affect has data newer than the sync. */
function prune() {
  if (!qc) return;
  const cache = qc.getQueryCache();
  const fresh = (key: readonly unknown[], since: number) => {
    const q = cache.find({ queryKey: key, exact: true });
    return !q || q.state.dataUpdatedAt > since;
  };
  const done = (e: OutboxEntry) => {
    if (!e.syncedAt) return false;
    if (Date.now() - e.syncedAt > 60 * 60 * 1000) return true;
    const id = e.op.event.plant_id;
    return fresh(["plants"], e.syncedAt) && fresh(["plants", id], e.syncedAt) && fresh(["history", id], e.syncedAt);
  };
  if (entries.some(done)) commit(entries.filter((e) => !done(e)));
}

/** Try now: called when the connection comes back, the app is reopened, or the sign-in refreshes. */
export function kickOutbox() {
  kickedAt = Date.now();
  if (entries.some((e) => mine(e) && !e.syncedAt && e.nextTryAt > Date.now())) {
    commit(entries.map((e) => (mine(e) && !e.syncedAt ? { ...e, nextTryAt: 0 } : e)));
  }
  void flush();
}

export function setOutboxUser(id: string | null) {
  if (id === userId) return kickOutbox();
  userId = id;
  listeners.forEach((l) => l());
  if (id) kickOutbox();
}

/** Wire the outbox to the app. Call once at startup. */
export function startOutbox(client: QueryClient) {
  qc = client;
  // Prune whenever fresh data arrives.
  client.getQueryCache().subscribe((e) => {
    if (e.type === "updated" && e.action.type === "success") prune();
  });
  window.addEventListener("online", kickOutbox);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && kickOutbox());
  // A slow safety net for Wi-Fi that's "connected" but not really working.
  window.setInterval(() => entries.some((e) => mine(e) && !e.syncedAt) && void flush(), 60_000);
}

export function onSyncFailure(cb: (f: SyncFailure) => void) {
  failureListeners.add(cb);
  return () => void failureListeners.delete(cb);
}

// ---- Reading -------------------------------------------------------------------

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
let snapshot: { all: OutboxEntry[]; user: string | null; mine: OutboxEntry[] } = { all: [], user: null, mine: [] };
function getMine() {
  if (snapshot.all !== entries || snapshot.user !== userId) {
    snapshot = { all: entries, user: userId, mine: entries.filter(mine) };
  }
  return snapshot.mine;
}

/** This person's outbox entries (waiting and recently synced). Re-renders when it changes. */
export const useOutbox = () => useSyncExternalStore(subscribe, getMine);

/** Same as useOutbox, outside React. */
export const outboxEntries = () => getMine();

/** Entries not yet on the server. */
export const unsynced = (list: OutboxEntry[]) => list.filter((e) => !e.syncedAt);

// ---- Overlays: server data + what's still in the outbox --------------------------

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : -Infinity);
const later = (a: string | null, b: string) => (time(b) > time(a) ? b : a);

function applyOp(
  p: PlantWithPlace,
  e: OutboxEntry,
  hemisphere: Household["hemisphere"],
  history: CareEvent[] | undefined,
): PlantWithPlace {
  const op = e.op;
  const ev = op.event;
  if (op.kind === "log") {
    switch (ev.type) {
      case "water":
        if (time(ev.performed_at) <= time(p.last_watered_at)) return p; // already applied, or an older watering
        return {
          ...p,
          last_watered_at: ev.performed_at,
          next_water_at: computeNextWater(ev.performed_at, p.water_interval_days, p.water_adjust, hemisphere),
        };
      case "check_moist": {
        if (time(ev.performed_at) <= time(p.last_watered_at)) return p;
        const snooze = new Date(time(ev.performed_at) + 2 * 86_400_000).toISOString();
        return {
          ...p,
          next_water_at: later(p.next_water_at ?? p.created_at, snooze),
          water_adjust: e.syncedAt ? p.water_adjust : Math.min(1.6, p.water_adjust + 0.05),
        };
      }
      case "fertilize": {
        const last = later(p.last_fertilized_at, ev.performed_at);
        const next =
          p.fertilize_interval_days && last
            ? new Date(time(last) + p.fertilize_interval_days * 86_400_000).toISOString()
            : p.next_fertilize_at;
        return { ...p, last_fertilized_at: last, next_fertilize_at: next };
      }
      default:
        return p;
    }
  }

  if (op.kind === "delete") {
    const { prior } = op;
    // Only while the plant still shows this watering, so it's a no-op once the server has caught up.
    if (ev.type === "water" && p.last_watered_at && time(p.last_watered_at) === time(ev.performed_at)) {
      if (prior) return { ...p, last_watered_at: prior.last_watered_at, next_water_at: prior.next_water_at };
      if (history) {
        const prev = history
          .filter((h) => h.type === "water" && h.id !== ev.id)
          .reduce<string | null>((m, h) => later(m, h.performed_at), null);
        return {
          ...p,
          last_watered_at: prev,
          next_water_at: prev
            ? computeNextWater(prev, p.water_interval_days, p.water_adjust, hemisphere)
            : new Date().toISOString(),
        };
      }
    }
    if (e.syncedAt) return p;
    if (ev.type === "check_moist" && prior) return { ...p, next_water_at: prior.next_water_at, water_adjust: prior.water_adjust };
    if (ev.type === "fertilize" && prior) {
      return { ...p, last_fertilized_at: prior.last_fertilized_at, next_fertilize_at: prior.next_fertilize_at };
    }
  }
  return p;
}

export function overlayPlant(
  p: PlantWithPlace,
  list: OutboxEntry[],
  hemisphere: Household["hemisphere"] = "north",
  history?: CareEvent[],
): PlantWithPlace {
  return list.filter((e) => e.op.event.plant_id === p.id).reduce((acc, e) => applyOp(acc, e, hemisphere, history), p);
}

export function overlayPlants(
  plants: PlantWithPlace[],
  list: OutboxEntry[],
  hemisphere: Household["hemisphere"] = "north",
  historyFor?: (plantId: string) => CareEvent[] | undefined,
): PlantWithPlace[] {
  if (list.length === 0) return plants;
  const touched = new Set(list.map((e) => e.op.event.plant_id));
  return plants.map((p) => (touched.has(p.id) ? overlayPlant(p, list, hemisphere, historyFor?.(p.id)) : p));
}

export function overlayHistory(history: CareEvent[] | undefined, list: OutboxEntry[], plantId: string): CareEvent[] | undefined {
  const ops = list.filter((e) => e.op.event.plant_id === plantId);
  if (ops.length === 0) return history;
  let out = [...(history ?? [])];
  for (const { op } of ops) {
    if (op.kind === "log") {
      if (!out.some((h) => h.id === op.event.id)) out.push(op.event);
    } else if (op.kind === "delete") {
      out = out.filter((h) => h.id !== op.event.id);
    } else {
      out = out.map((h) => (h.id === op.event.id ? { ...h, note: op.note } : h));
    }
  }
  return out.sort((a, b) => time(b.performed_at) - time(a.performed_at));
}
