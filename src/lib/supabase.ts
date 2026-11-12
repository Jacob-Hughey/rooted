import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local");
}

/**
 * Data requests without her sign-in would come back empty (row-level security hides everything),
 * and an empty plant list must never replace the saved one. That happens when the app opens on
 * a bad connection and the sign-in can't be refreshed yet, so fail those requests instead.
 * They're retried once the sign-in refreshes.
 */
const guardedFetch: typeof fetch = (input, init) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/\/(rest|storage)\/v1\//.test(href)) {
    const auth = new Headers(init?.headers).get("Authorization");
    if (!auth || auth === `Bearer ${key}`) {
      return Promise.reject(new TypeError("Not signed in right now (no connection to refresh the sign-in)"));
    }
  }
  return fetch(input, init);
};

// Tip: once the schema settles, run `npm run db:types` and pass <Database> here for end-to-end types.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
  global: { fetch: guardedFetch },
});

/** Where supabase-js keeps the session in localStorage (its default key). */
export const AUTH_STORAGE_KEY = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
export const SUPABASE_URL = url;

export const PHOTO_BUCKET = "plant-photos";
