import { useEffect, useState } from "react";
import { Bell, BellOff, Share, SquarePlus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/auth/AuthProvider";
import { useHousehold, useInvite, useProfile, useUpdateProfile } from "@/data/queries";
import { currentPushState, disablePush, enablePush, type PushState } from "@/lib/push";
import { isIOS, isStandalone } from "@/lib/pwa";

const card = "rounded-[var(--radius-xl)] bg-card p-5 shadow-sm space-y-4";

export default function Settings() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mx-auto max-w-lg space-y-4">
        <NotificationsCard />

        <section className={card}>
          <h2 className="text-xl">Daily reminder</h2>
          <label className="flex items-center justify-between gap-4">
            <span>Remind me at</span>
            <input
              type="time"
              value={profile?.reminder_time.slice(0, 5) ?? "08:30"}
              onChange={(e) => update.mutate({ reminder_time: e.target.value })}
              className="h-11 rounded-full border bg-background px-4"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            One gentle nudge a day, only when something needs water. Time zone: {profile?.timezone}
          </p>
        </section>

        <InviteCard />

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </>
  );
}

function NotificationsCard() {
  const ios = isIOS();
  const standalone = isStandalone();
  const [state, setState] = useState<PushState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentPushState(standalone, ios).then(setState);
  }, [ios, standalone]);

  async function toggle() {
    setError(null);
    try {
      if (state === "on") await disablePush();
      else await enablePush();
      setState(await currentPushState(standalone, ios));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change notifications");
    }
  }

  return (
    <section className={card}>
      <h2 className="text-xl">Notifications</h2>
      {state === "needs-install" ? (
        <div className="space-y-3 text-sm">
          <p>To get watering reminders on this {navigator.userAgent.includes("iPad") ? "iPad" : "iPhone"}, add Rooted to the Home Screen first:</p>
          <ol className="space-y-2">
            <li className="flex items-center gap-2"><Share className="size-4 text-primary" /> Tap Share in Safari</li>
            <li className="flex items-center gap-2"><SquarePlus className="size-4 text-primary" /> Choose “Add to Home Screen”</li>
            <li className="flex items-center gap-2"><Bell className="size-4 text-primary" /> Open it from the Home Screen and come back here</li>
          </ol>
        </div>
      ) : state === "unsupported" ? (
        <p className="text-sm text-muted-foreground">This browser doesn't support push notifications.</p>
      ) : state === "denied" ? (
        <p className="text-sm text-muted-foreground">Notifications are blocked. Turn them on in system Settings → Notifications → Rooted.</p>
      ) : (
        <Button variant={state === "on" ? "outline" : "default"} className="w-full" onClick={toggle} disabled={!state}>
          {state === "on" ? <><BellOff /> Turn off on this device</> : <><Bell /> Turn on watering reminders</>}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Each device (iPhone, iPad) is turned on separately.</p>
    </section>
  );
}

function InviteCard() {
  const { data: household } = useHousehold();
  const invite = useInvite();
  const [email, setEmail] = useState("");

  return (
    <section className={card}>
      <h2 className="text-xl">Share the Rooted</h2>
      <p className="text-sm text-muted-foreground">
        Invite someone by email before they sign in for the first time — they'll join this Rooted.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (household) invite.mutate({ household_id: household.id, email }, { onSuccess: () => setEmail("") });
        }}
      >
        <input
          type="email"
          required
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4"
        />
        <Button size="icon" aria-label="Send invite" disabled={invite.isPending}>
          <UserPlus />
        </Button>
      </form>
      {invite.isSuccess && <p className="text-sm text-primary">Invite saved. They can sign in now.</p>}
      {invite.isError && <p className="text-sm text-destructive">Couldn't save that invite.</p>}
    </section>
  );
}
