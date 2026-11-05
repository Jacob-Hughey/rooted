import { useState } from "react";
import { Leaf, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from "@/auth/AuthProvider";

export default function SignIn() {
  const [mode, setMode] = useState<"google" | "email" | "code">("google");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ error: unknown }>, next?: () => void) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error instanceof Error ? error.message : "Something went wrong");
    else next?.();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-[radial-gradient(ellipse_at_top,var(--secondary),transparent_60%)] px-6 pb-safe pt-safe">
      <div />
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <Leaf className="size-8" strokeWidth={1.75} />
        </div>
        <h1 className="text-4xl">Rooted</h1>
        <p className="mt-2 text-muted-foreground">Every leaf, looked after.</p>

        <div className="mt-10 space-y-3">
          {mode === "google" && (
            <>
              <Button size="lg" className="w-full" disabled={busy} onClick={() => run(signInWithGoogle)}>
                Continue with Google
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode("email")}>
                <Mail /> Use an email code instead
              </Button>
            </>
          )}

          {mode === "email" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => sendEmailCode(email), () => setMode("code"));
              }}
            >
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-full border bg-card px-5 text-base outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="lg" className="w-full" disabled={busy}>
                Send me a code
              </Button>
            </form>
          )}

          {mode === "code" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => verifyEmailCode(email, code));
              }}
            >
              <p className="text-sm text-muted-foreground">We sent a code to {email}</p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 w-full rounded-full border bg-card px-5 text-center text-xl tracking-[0.4em] outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="lg" className="w-full" disabled={busy || code.length < 6}>
                Sign in
              </Button>
            </form>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>
      <p className="pb-6 text-xs text-muted-foreground">Made with love, for one very lucky plant collection.</p>
    </div>
  );
}
