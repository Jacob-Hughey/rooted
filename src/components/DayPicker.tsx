import { format, isToday, isYesterday, startOfDay, subDays } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Which day care happened, for when she waters first and logs it later.
 * `null` means today. Past days are always a calendar day; the time is filled in by `dayToTimestamp`.
 */
export type CareDay = Date | null;

/** "today", "yesterday", "on Nov 9" — reads after a verb: "watered yesterday". */
export function dayPhrase(day: CareDay) {
  if (!day || isToday(day)) return "today";
  if (isYesterday(day)) return "yesterday";
  return `on ${format(day, "MMM d")}`;
}

/** Timestamp to store, or undefined for "now". Past days are logged at noon so the day is right in any time zone shift. */
export function dayToTimestamp(day: CareDay): string | undefined {
  if (!day || isToday(day)) return undefined;
  const noon = startOfDay(day);
  noon.setHours(12);
  return noon.toISOString();
}

const chip =
  "relative flex h-10 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-medium transition-colors";
const on = "border-foreground bg-foreground text-background";
const off = "border-input/60 text-foreground hover:bg-muted";

export function DayPicker({ value, onChange, disabled }: { value: CareDay; onChange: (d: CareDay) => void; disabled?: boolean }) {
  const today = !value || isToday(value);
  const yesterday = !!value && isYesterday(value);
  const earlier = !today && !yesterday;
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div role="group" aria-label="Which day was this?" className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={today} disabled={disabled} onClick={() => onChange(null)} className={cn(chip, today ? on : off)}>
        Today
      </button>
      <button
        type="button"
        aria-pressed={yesterday}
        disabled={disabled}
        onClick={() => onChange(startOfDay(subDays(new Date(), 1)))}
        className={cn(chip, yesterday ? on : off)}
      >
        Yesterday
      </button>
      {/* The native date input sits invisibly over the chip, so tapping it opens the phone's own date picker. */}
      <label className={cn(chip, "cursor-pointer focus-within:ring-2 focus-within:ring-ring", earlier ? on : off)}>
        <CalendarDays className="size-4" aria-hidden="true" />
        {earlier ? format(value!, "EEE, MMM d") : "Earlier…"}
        <input
          type="date"
          aria-label="Pick an earlier day"
          max={todayStr}
          disabled={disabled}
          value={value ? format(value, "yyyy-MM-dd") : ""}
          onChange={(e) => {
            if (!e.target.value) return onChange(null);
            const [y, m, d] = e.target.value.split("-").map(Number);
            const picked = new Date(y, m - 1, d);
            onChange(picked > new Date() ? null : picked); // never the future
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
