import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_STORAGE_KEY, supabase } from "@/lib/supabase";
import { clearPersistedCache } from "@/data/persist";
import { setOutboxUser } from "@/data/outbox";

type AuthState = { session: Session | null; loading: boolean };
const AuthContext = createContext<AuthState>({ session: null, loading: true });

/**
 * The session saved on the device, even if its access token has expired.
 * supabase-js reports "no session" when it can't refresh an expired token, which is exactly
 * what happens when the app opens without a connection. The refresh token is still there and
 * still good, so she stays signed in and sees her saved plants; supabase-js refreshes the token
 * as soon as it can. A real sign-out (or a revoked sign-in) removes the stored session.
 */
function storedSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    return s?.refresh_token && s?.user?.id ? (s as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const qc = useQueryClient();

  useEffect(() => {
    const apply = (session: Session | null) => {
      setOutboxUser(session?.user.id ?? null);
      setState({ session, loading: false });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session ?? storedSession()));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      apply(session ?? (event === "SIGNED_OUT" ? null : storedSession()));
      if (event === "SIGNED_OUT") {
        // Don't leave her plants on the device for whoever signs in next.
        qc.clear();
        void clearPersistedCache();
      }
      if (event === "SIGNED_IN" && session) {
        // Keep the profile's time zone in sync with the device so reminders land at the right local time.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        supabase.from("profiles").update({ timezone: tz }).eq("id", session.user.id).then(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

/** Fallback for the home-screen app: a 6-digit code works without leaving the app. */
export function sendEmailCode(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
}
export function verifyEmailCode(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: "email" });
}

export const signOut = () => supabase.auth.signOut();
