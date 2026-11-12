import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { idbDel, idbGet, idbSet } from "@/lib/idb";

/**
 * Keeps the React Query cache on the device, so the app opens with her plants
 * (and the last-known schedule) even with no connection. Fresh data replaces it as soon as it loads.
 */
const KEY = "query-cache";
const VERSION = 1; // bump when the shape of cached data changes, to drop old caches
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

type Saved = { v: number; at: number; state: ReturnType<typeof dehydrate> };

export async function restoreQueryCache(qc: QueryClient) {
  try {
    const saved = await withTimeout(idbGet<Saved>(KEY), 1500);
    if (saved && saved.v === VERSION && Date.now() - saved.at < MAX_AGE) hydrate(qc, saved.state);
  } catch (err) {
    console.warn("Couldn't restore saved data", err);
  }
}

export function persistQueryCache(qc: QueryClient) {
  let timer: number | undefined;

  const save = () => {
    window.clearTimeout(timer);
    const state = dehydrate(qc, { shouldDehydrateQuery: (q) => q.state.status === "success" });
    idbSet(KEY, { v: VERSION, at: Date.now(), state } satisfies Saved).catch((err) =>
      console.warn("Couldn't save data for offline use", err),
    );
  };

  const unsubscribe = qc.getQueryCache().subscribe((e) => {
    if ((e.type === "updated" && e.action.type === "success") || e.type === "removed") {
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 1000);
    }
  });
  // iOS can stop a home-screen app any time after it's backgrounded: save right away.
  const onHide = () => document.visibilityState === "hidden" && save();
  document.addEventListener("visibilitychange", onHide);

  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onHide);
    window.clearTimeout(timer);
  };
}

export const clearPersistedCache = () => idbDel(KEY).catch(() => {});

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}
