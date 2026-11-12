import { useState } from "react";
import { Link } from "react-router";
import { addDays, differenceInCalendarDays, format, formatDistanceStrict, startOfDay } from "date-fns";
import { Droplet } from "lucide-react";
import { PlantPhoto } from "@/components/PlantPhoto";
import { useHousehold, useLatestPhotoDates, usePlantPhotos } from "@/data/queries";
import { daysUntilWater, displayName, isFeedingRest } from "@/lib/watering";
import type { PlantWithPlace } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Featured plant: one plant a day, shown big, for quiet days           */
/* ------------------------------------------------------------------ */

/** Same plant all day, a different one tomorrow. Plants with a photo go first. */
export function pickFeatured(plants: PlantWithPlace[], now = new Date()) {
  const withPhoto = plants.filter((p) => p.cover_photo_path);
  const pool = withPhoto.length ? withPhoto : plants;
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const day = differenceInCalendarDays(now, new Date(2026, 0, 1));
  return sorted[((day % sorted.length) + sorted.length) % sorted.length];
}

export function FeaturedPlant({ plant }: { plant: PlantWithPlace }) {
  const { data: photos = [] } = usePlantPhotos(plant.id);
  const name = displayName(plant);
  const latest = photos[0];
  const first = photos[photos.length - 1];
  const canCompare = photos.length >= 2 && differenceInCalendarDays(new Date(latest.taken_at), new Date(first.taken_at)) >= 7;

  return (
    <Link to={`/plants/${plant.id}`} className="block rounded-[var(--radius-xl)]">
      {canCompare ? (
        <div className="grid grid-cols-2 gap-2">
          {[first, latest].map((ph) => (
            <figure key={ph.id}>
              <PlantPhoto path={ph.path} alt="" className="aspect-[4/5] max-h-[42dvh] w-full rounded-[var(--radius-lg)]" />
              <figcaption className="mt-1 text-sm text-muted-foreground">{format(new Date(ph.taken_at), "MMM d, yyyy")}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <PlantPhoto path={plant.cover_photo_path} alt="" className="aspect-[4/5] max-h-[50dvh] w-full rounded-[var(--radius-xl)]" />
      )}
      <div className="mt-3">
        <h2 className="text-[1.75rem]">{name}</h2>
        <p className="text-muted-foreground">
          {canCompare
            ? `${formatDistanceStrict(new Date(latest.taken_at), new Date(first.taken_at), { roundingMethod: "floor" })} of growth`
            : [plant.room_name, latest && `photo from ${format(new Date(latest.taken_at), "MMMM d")}`]
                .filter(Boolean)
                .join(", ")
                .replace(/^photo/, "Photo")}
        </p>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Week ahead: seven days, a droplet where something needs water        */
/* ------------------------------------------------------------------ */

export function WeekAhead({ plants, includeToday = true }: { plants: PlantWithPlace[]; includeToday?: boolean }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const names = plants
      .filter((p) => {
        const d = daysUntilWater(p);
        if (d === null) return false;
        return i === 0 ? includeToday && d <= 0 : d === i;
      })
      .map(displayName);
    return { i, date: addDays(today, i), names };
  });

  const firstBusy = days.find((d) => d.i > 0 && d.names.length)?.i ?? 1;
  const [selected, setSelected] = useState(firstBusy);
  const sel = days[selected];
  const selLabel = sel.i === 0 ? "Today" : sel.i === 1 ? "Tomorrow" : format(sel.date, "EEEE");

  if (!days.some((d) => d.i > 0 && d.names.length)) return null;

  return (
    <section>
      <h2 className="mb-3 text-xl">This week</h2>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <button
            key={d.i}
            onClick={() => setSelected(d.i)}
            aria-pressed={selected === d.i}
            aria-label={`${format(d.date, "EEEE, MMMM d")}: ${d.names.length ? `${d.names.length} to water` : "nothing to water"}`}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-[var(--radius)] py-2 transition-colors",
              selected === d.i ? "bg-card" : "hover:bg-muted",
            )}
          >
            <span className={cn("text-xs", d.i === 0 ? "font-bold" : "text-muted-foreground")}>
              {d.i === 0 ? "Today" : format(d.date, "EEE")}
            </span>
            <span className={cn("text-lg leading-tight", d.i === 0 && "font-bold")}>{format(d.date, "d")}</span>
            <Droplet
              aria-hidden="true"
              className={cn("size-4", d.names.length ? "text-water" : "text-muted-foreground")}
              fill={d.names.length ? "currentColor" : "none"}
              strokeWidth={d.names.length ? 2 : 1.5}
            />
          </button>
        ))}
      </div>
      <p className="mt-3" aria-live="polite">
        <span className="font-bold">{selLabel}:</span>{" "}
        {sel.names.length ? sel.names.join(", ") : <span className="text-muted-foreground">nothing to water</span>}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Nudges: real, small things worth doing. Hidden when there are none. */
/* ------------------------------------------------------------------ */

const PHOTO_STALE_DAYS = 90;

export function Nudges({ plants }: { plants: PlantWithPlace[] }) {
  const { data: latestPhoto } = useLatestPhotoDates();
  const { data: household } = useHousehold();
  const now = new Date();
  const items: { key: string; to: string; text: string }[] = [];

  // Fertilizer nudges sleep through winter; anything that came due then shows up once in spring.
  for (const p of isFeedingRest(now, household?.hemisphere) ? [] : plants) {
    const n = displayName(p);
    if (p.next_fertilize_at && differenceInCalendarDays(new Date(p.next_fertilize_at), now) <= 0)
      items.push({ key: `fert-${p.id}`, to: `/plants/${p.id}`, text: `${n} is due for fertilizer` });
  }
  for (const p of plants) {
    if (!p.cover_photo_path) items.push({ key: `nophoto-${p.id}`, to: `/plants/${p.id}`, text: `Add a photo of ${displayName(p)}` });
  }
  if (latestPhoto) {
    for (const p of plants) {
      const last = latestPhoto.get(p.id);
      if (p.cover_photo_path && last && differenceInCalendarDays(now, new Date(last)) >= PHOTO_STALE_DAYS)
        items.push({
          key: `stale-${p.id}`,
          to: `/plants/${p.id}`,
          text: `${displayName(p)} hasn’t had a photo since ${format(new Date(last), "MMMM")}`,
        });
    }
  }
  for (const p of plants) {
    if (!p.room_id) items.push({ key: `room-${p.id}`, to: `/plants/${p.id}/edit`, text: `Choose a room for ${displayName(p)}` });
  }

  if (!items.length) return null;

  return (
    <section>
      <h2 className="mb-1 text-xl">When you have a minute</h2>
      <ul>
        {items.slice(0, 3).map((it) => (
          <li key={it.key} className="border-b last:border-b-0">
            <Link to={it.to} className="flex min-h-12 items-center py-2">
              {it.text}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
