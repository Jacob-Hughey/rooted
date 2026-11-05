import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthState = { session: Session | null; loading: boolean };
const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      if (event === "SIGNED_IN" && session) {
        // Keep the profile's time zone in sync with the device so reminders land at the right local time.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        supabase.from("profiles").update({ timezone: tz }).eq("id", session.user.id).then(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
